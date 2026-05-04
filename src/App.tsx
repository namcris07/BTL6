import { useState, useEffect, useRef, useCallback } from 'react';
import { NetworkManager } from './network/NetworkManager';
import { GameClient } from './client/GameClient';
import Menu from './components/Menu';
import HUD from './components/HUD';
import Settings from './components/Settings';
import Scoreboard from './components/Scoreboard';
import ResultsScreen from './components/ResultsScreen';
import GameModeDisplay from './components/GameModeDisplay';
import Minimap from './components/Minimap';
import MobileControls from './components/MobileControls';
import ActiveEffects from './components/ActiveEffects';
import { isMobileDevice } from './utils/deviceDetection';
import { SkillType } from './common/constants';
import type { GameState, MapConfig } from './common/types';
import styles from './App.module.css';
import { notifications } from '@mantine/notifications';

// Extend Window interface to include networkManager property
declare global {
  interface Window {
    networkManager?: NetworkManager;
  }
}

function App() {
  const [networkManager] = useState(() => new NetworkManager());
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [scoreboardOpened, setScoreboardOpened] = useState(false);
  const [resultsOpened, setResultsOpened] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const gameClientInitialized = useRef(false);

  useEffect(() => {
    // Detect mobile device
    setIsMobile(isMobileDevice());
    
    // Make networkManager available globally for components that need it
    window.networkManager = networkManager;

    // Initialize GameClient after React has rendered the DOM elements
    // Use a small delay to ensure DOM is ready
    if (!gameClientInitialized.current) {
      const timer = setTimeout(() => {
        const client = new GameClient(networkManager);

        // Set up callbacks for settings and scoreboard
        client.setOnSettingsToggle(() => {
          setSettingsOpened(prev => !prev);
        });
        client.setOnScoreboardToggle(() => {
          setScoreboardOpened(true);
        });
        client.setOnScoreboardClose(() => {
          setScoreboardOpened(false);
        });

        setGameClient(client);
        gameClientInitialized.current = true;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [networkManager]);

  // Update gameState and localPlayerId from GameClient
  useEffect(() => {
    if (!gameClient || !gameStarted) return;

    const interval = setInterval(() => {
      const currentState = gameClient.getCurrentGameState();
      const currentPlayerId = gameClient.getLocalPlayerId();
      const currentMapConfig = gameClient.getMapConfig();
      if (currentState) {
        setGameState(currentState);
      }
      if (currentPlayerId) {
        setLocalPlayerId(currentPlayerId);
      }
      if (currentMapConfig && !mapConfig) {
        setMapConfig(currentMapConfig);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [gameClient, gameStarted]);

  useEffect(() => {
    const handleGameStarted = () => {
      setGameStarted(true);
    };

    const handleHostDisconnected = () => {
      // Host disconnected - kick all clients back to menu
      if (gameClient) {
        gameClient.stop();
      }
      
      setGameStarted(false);
      setSettingsOpened(false);
      setResultsOpened(false);
      setGameState(null);
      setLocalPlayerId(null);

      // Clear query string from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      // Show notification
      notifications.show({
        title: 'Host Disconnected',
        message: 'The host has disconnected. The game is no longer available.',
        color: 'red',
        autoClose: false,
      });

      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    const handlePlayerDisconnectedNotification = (e: CustomEvent<{ playerId: string; username?: string }>) => {
      const { username } = e.detail;
      const displayName = username || 'A player';
      
      // Show toast notification during gameplay
      notifications.show({
        title: 'Player Disconnected',
        message: `${displayName} has disconnected from the game`,
        color: 'orange',
        autoClose: 5000,
      });
    };

    const handlePlayerJoinedNotification = (e: CustomEvent<{ playerId: string; username?: string }>) => {
      const { username } = e.detail;
      const displayName = username || 'A player';
      
      // Show toast notification when a player joins
      notifications.show({
        title: 'Player Joined',
        message: `${displayName} has joined the game`,
        color: 'green',
        autoClose: 5000,
      });
    };

    window.addEventListener('game-started', handleGameStarted);
    window.addEventListener('host-disconnected', handleHostDisconnected as EventListener);
    window.addEventListener('player-disconnected-notification', handlePlayerDisconnectedNotification as EventListener);
    window.addEventListener('player-joined-notification', handlePlayerJoinedNotification as EventListener);

    return () => {
      window.removeEventListener('game-started', handleGameStarted);
      window.removeEventListener('host-disconnected', handleHostDisconnected as EventListener);
      window.removeEventListener('player-disconnected-notification', handlePlayerDisconnectedNotification as EventListener);
      window.removeEventListener('player-joined-notification', handlePlayerJoinedNotification as EventListener);
    };
  }, [gameClient]);

  const handleExitGame = useCallback(() => {
    // Stop game client and dispose audio resources
    if (gameClient) {
      gameClient.stop();
    }

    setGameStarted(false);
    setSettingsOpened(false);
    setResultsOpened(false);
    setGameState(null);
    setLocalPlayerId(null);

    // Clear query string from URL
    const newUrl = window.location.pathname;
    window.history.replaceState({ path: newUrl }, '', newUrl);

    setTimeout(() => {
      window.location.reload();
    }, 0);
  }, [gameClient]);

  // Show results screen when game is over
  useEffect(() => {
    if (!gameState) {
      setResultsOpened(false);
      return;
    }

    if (gameState.gameMode === 'GAME_OVER') {
      console.log('GAME_OVER detected, opening ResultsScreen');
      setResultsOpened(true);
    } else {
      setResultsOpened(false);
    }
  }, [gameState]);

  const handleStartGame = () => {
    if (gameClient && networkManager.isHost) {
      networkManager.sendToHost({
        type: 'START_GAME',
      });
    }
  };

  const handleRestartGame = () => {
    if (gameClient && networkManager.isHost) {
      networkManager.sendToHost({
        type: 'RESTART_GAME',
      });
    }
  };

  return (
    <div className={styles.app}>
      {!gameStarted && (
        <div className={styles.uiLayer}>
          {gameClient && <Menu networkManager={networkManager} gameClient={gameClient} />}
        </div>
      )}
      <HUD gameState={gameState} localPlayerId={localPlayerId} onLeaveGame={handleExitGame} />
      {gameStarted && <GameModeDisplay gameState={gameState} visible={gameStarted} isHost={networkManager.isHost} onStartGame={handleStartGame} />}
      {gameStarted && (
        <Minimap
          gameState={gameState}
          localPlayerId={localPlayerId}
          mapConfig={mapConfig}
        />
      )}
      {gameStarted && (
        <ActiveEffects
          gameState={gameState}
          localPlayerId={localPlayerId}
          isGameActive={gameStarted}
        />
      )}
      <ResultsScreen
        opened={resultsOpened}
        gameState={gameState}
        localPlayerId={localPlayerId}
        onReturnToLobby={handleExitGame}
        audioManager={gameClient?.getAudioManager() || null}
      />
      {gameClient && (
        <>
          <Settings
            opened={settingsOpened}
            onClose={() => setSettingsOpened(false)}
            audioManager={gameClient.getAudioManager()}
            gameClient={gameClient}
            variant="modal"
            onExitGame={handleExitGame}
          />
          <Scoreboard
            opened={scoreboardOpened}
            onClose={() => setScoreboardOpened(false)}
            gameState={gameState}
            localPlayerId={localPlayerId}
            isHost={networkManager.isHost}
            onStartGame={handleStartGame}
            onRestartGame={handleRestartGame}
          />
        </>
      )}
      {isMobile && gameStarted && gameClient && (
        <MobileControls
          onMove={(direction) => {
            if (gameClient) {
              gameClient.handleMobileMove(direction);
            }
          }}
          onStopMove={() => {
            if (gameClient) {
              gameClient.handleMobileStopMove();
            }
          }}
          onSkillPress={(skillType) => {
            if (gameClient) {
              gameClient.handleMobileSkillPress(skillType);
            }
          }}
          onSkillRelease={(skillType) => {
            if (gameClient && skillType === SkillType.TELEPORT) {
              gameClient.handleMobileSkillRelease(skillType);
            }
          }}
          isGameActive={gameStarted}
        />
      )}
      <div id="game-container"></div>
    </div>
  );
}

export default App;
