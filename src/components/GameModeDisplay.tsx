import { Text, Paper, Button, Stack, Tooltip } from '@mantine/core';
import { Icon } from '@iconify/react';
import type { GameState } from '../common/types';
import { GameMode } from '../common/constants';
import styles from './GameModeDisplay.module.css';

interface GameModeDisplayProps {
  gameState: GameState | null;
  visible: boolean;
  isHost?: boolean;
  onStartGame?: () => void;
}

export default function GameModeDisplay({ gameState, visible, isHost, onStartGame }: GameModeDisplayProps) {
  if (!gameState || !visible) {
    return null;
  }

  // Debug logging
  console.log('GameModeDisplay:', {
    gameMode: gameState.gameMode,
    matchEndTime: gameState.matchEndTime,
    targetScore: gameState.targetScore,
    useTimerMode: gameState.useTimerMode,
  });

  let modeText = '';
  const playerCount = gameState.players.length;
  const canStartGame = isHost && playerCount >= 2;
  const showStartButton = isHost && gameState.gameMode === GameMode.WARMUP;

  switch (gameState.gameMode) {
    case GameMode.WARMUP:
      if (gameState.warmupEndTime) {
        const now = Date.now();
        const remainingMs = Math.max(0, gameState.warmupEndTime - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        if (remainingSeconds > 0) {
          modeText = `Warmup (${remainingSeconds}s)`;
        } else {
          modeText = 'Warmup';
        }
      } else {
        modeText = 'Warmup';
      }
      break;
    case GameMode.WARMUP_COUNTDOWN:
      if (gameState.warmupEndTime) {
        const now = Date.now();
        const remainingMs = Math.max(0, gameState.warmupEndTime - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        modeText = `Game Starting in ${remainingSeconds}s`;
      } else {
        modeText = 'Game Starting...';
      }
      break;
    case GameMode.FREEZE_TIME:
      // Calculate remaining seconds in freeze time
      if (gameState.freezeTimeEnd) {
        const now = Date.now();
        const remainingMs = Math.max(0, gameState.freezeTimeEnd - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        modeText = `Freeze Time (${remainingSeconds}s)`;
      } else {
        modeText = 'Freeze Time';
      }
      // Show match timer if available
      if (gameState.matchEndTime) {
        const now = Date.now();
        const matchRemainingMs = Math.max(0, gameState.matchEndTime - now);
        const matchRemainingSeconds = Math.ceil(matchRemainingMs / 1000);
        const minutes = Math.floor(matchRemainingSeconds / 60);
        const seconds = matchRemainingSeconds % 60;
        modeText += ` | Match Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      // Show target score if available
      // if (gameState.targetScore) {
      //   modeText += ` | Target: ${gameState.targetScore} kills`;
      // }
      break;
    case GameMode.ROUND:
      // Always show timer if matchEndTime exists, or show round info
      if (gameState.matchEndTime) {
        const now = Date.now();
        const remainingMs = Math.max(0, gameState.matchEndTime - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        modeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      //   if (gameState.targetScore) {
      //     modeText += ` | Target: ${gameState.targetScore} kills`;
      //   }
      // } else {
      //   modeText = `Round ${gameState.currentRound}/${gameState.totalRounds}`;
      //   if (gameState.targetScore) {
      //     modeText += ` | Target: ${gameState.targetScore} kills`;
      //   }
      }
      break;
    case GameMode.ROUND_END:
      // Show who won the round
      if (gameState.roundWinnerId) {
        const winner = gameState.players.find(p => p.id === gameState.roundWinnerId);
        if (winner) {
          // Calculate remaining seconds in round end
          if (gameState.freezeTimeEnd) {
            const now = Date.now();
            const remainingMs = Math.max(0, gameState.freezeTimeEnd - now);
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            modeText = `Round ${gameState.currentRound - 1}/${gameState.totalRounds} - Player ${winner.username || winner.id.substring(0, 4)} Wins! (${remainingSeconds}s)`;
          } else {
            modeText = `Round ${gameState.currentRound - 1}/${gameState.totalRounds} - Player ${winner.username || winner.id.substring(0, 4)} Wins!`;
          }
        } else {
          modeText = `Round ${gameState.currentRound - 1}/${gameState.totalRounds} - Round End`;
        }
      } else {
        modeText = `Round ${gameState.currentRound - 1}/${gameState.totalRounds} - Round End`;
      }
      break;
    case GameMode.GAME_OVER:
      if (gameState.winnerId) {
        const winner = gameState.players.find(p => p.id === gameState.winnerId);
        let winnerText = winner
          ? `Game Over - Player ${winner.username || winner.id.substring(0, 4)} Wins!`
          : 'Game Over';
        
        // Show countdown to return to lobby
        if (gameState.freezeTimeEnd) {
          const now = Date.now();
          const remainingMs = Math.max(0, gameState.freezeTimeEnd - now);
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          if (remainingSeconds > 0) {
            winnerText += ` (Returning to lobby in ${remainingSeconds}s)`;
          }
        }
        
        modeText = winnerText;
      } else {
        modeText = 'Game Over';
      }
      break;
  }

  return (
    <Paper className={styles.gameModeDisplay} p="md" withBorder>
      <Stack gap="md" align="center">
        <Text size="xl" fw={700} ta="center">
          {modeText}
        </Text>
        
        {/* Show "Start Game" button for host in warmup */}
        {showStartButton && onStartGame && (
          <Tooltip
            label={canStartGame ? "Start the game" : `Need at least 2 players to start (${playerCount}/2)`}
            position="bottom"
          >
            <Button
              color="green"
              variant="filled"
              size="lg"
              leftSection={<Icon icon="tabler:player-play" style={{ fontSize: '20px' }} />}
              onClick={onStartGame}
              disabled={!canStartGame}
            >
              Start Game
            </Button>
          </Tooltip>
        )}
        
        {/* Show waiting message for non-host players in warmup */}
        {!isHost && gameState.gameMode === GameMode.WARMUP && (
          <Text size="sm" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
            Waiting for host to start the game...
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
