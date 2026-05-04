import { useState, useEffect } from 'react';
import { Paper, Text, Stack, Loader, Group, ThemeIcon, rem, Table, ActionIcon, Tooltip, Button } from '@mantine/core';
import { Icon } from '@iconify/react';
import type { NetworkMessage } from '../common/messages';
import type { GameState } from '../common/types';
import { GameMode } from '../common/constants';

// Import NetworkManager type - the instance is passed as prop
type NetworkManager = import('../network/NetworkManager').NetworkManager;

interface LobbyControlsProps {
  hostId: string;
  networkManager: NetworkManager;
  onLeave?: () => void;
}

interface PlayerInfo {
  id: string;
  username?: string;
  isHost: boolean;
}

export default function LobbyControls({ hostId, networkManager, onLeave }: LobbyControlsProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const handlePlayerListUpdate = (e: CustomEvent<{ from: string; data: NetworkMessage }>) => {
      const { data } = e.detail;
      if (data.type === 'PLAYER_LIST_UPDATE') {
        setPlayers(data.players);
      }
    };

    const handleGameStateUpdate = (e: CustomEvent<{ state: GameState }>) => {
      setGameState(e.detail.state);
    };

    window.addEventListener('network-data', handlePlayerListUpdate as EventListener);
    window.addEventListener('game-state-update', handleGameStateUpdate as EventListener);

    // Request player list immediately and periodically
    if (networkManager.isHost) {
      networkManager.sendToHost({
        type: 'PLAYER_LIST_REQUEST',
      });
      
      // Also request periodically to ensure we get updates
      const interval = setInterval(() => {
        networkManager.sendToHost({
          type: 'PLAYER_LIST_REQUEST',
        });
      }, 1000);
      
      return () => {
        window.removeEventListener('network-data', handlePlayerListUpdate as EventListener);
        window.removeEventListener('game-state-update', handleGameStateUpdate as EventListener);
        clearInterval(interval);
      };
    }

    return () => {
      window.removeEventListener('network-data', handlePlayerListUpdate as EventListener);
      window.removeEventListener('game-state-update', handleGameStateUpdate as EventListener);
    };
  }, [networkManager]);

  const handleKickPlayer = (playerId: string) => {
    if (networkManager.isHost && playerId !== networkManager.peerId) {
      networkManager.sendToHost({
        type: 'KICK_PLAYER',
        playerId,
      });
    }
  };

  const handleStartGame = () => {
    if (networkManager.isHost) {
      networkManager.sendToHost({
        type: 'START_GAME',
      });
    }
  };

  // Check if we should show the start button
  const isInWarmup = gameState?.gameMode === GameMode.WARMUP;
  const hasEnoughPlayers = players.length >= 2;
  const showStartButton = networkManager.isHost && isInWarmup;

  return (
    <Paper p="xl" withBorder w="100%">
      <Stack align="center" gap="lg">
        <ThemeIcon size={60} radius="md" variant="light">
          <Icon icon="tabler:server" style={{ width: rem(32), height: rem(32) }} />
        </ThemeIcon>

        <Stack gap="xs" align="center">
          <Text size="sm" c="dimmed">
            Hosting on ID
          </Text>
          <Text size="xl" fw={700} ff="monospace">
            {hostId}
          </Text>
        </Stack>

        {players.length === 0 ? (
          <Group gap="xs">
            <Loader size="sm" type="dots" />
            <Text size="sm">Waiting for players...</Text>
          </Group>
        ) : (
          <Stack gap="md" w="100%">
            <Text size="lg" fw={600} ta="center">
              Players ({players.length})
            </Text>
            <Table>
              <Table.Tbody>
                {players.map(player => (
                  <Table.Tr key={player.id}>
                    <Table.Td>
                      <Group gap="xs">
                        {player.isHost && (
                          <ThemeIcon size="sm" variant="light" color="yellow">
                            <Icon icon="tabler:crown" style={{ width: rem(12) }} />
                          </ThemeIcon>
                        )}
                        <Text>{player.username || player.id.substring(0, 8)}</Text>
                        {player.isHost && <Text size="xs" c="dimmed">(Host)</Text>}
                      </Group>
                    </Table.Td>
                    {networkManager.isHost && !player.isHost && (
                      <Table.Td>
                        <Tooltip label="Kick player">
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => handleKickPlayer(player.id)}
                          >
                            <Icon icon="tabler:user-x" style={{ width: rem(16) }} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
        
        {showStartButton && (
          <Tooltip 
            label={hasEnoughPlayers ? "Start the game" : "Need at least 2 players to start"}
            position="top"
          >
            <Button
              color="green"
              variant="filled"
              size="lg"
              leftSection={<Icon icon="tabler:player-play" style={{ width: rem(20) }} />}
              onClick={handleStartGame}
              disabled={!hasEnoughPlayers}
              fullWidth
              mt="md"
            >
              Start Game
            </Button>
          </Tooltip>
        )}
        
        {onLeave && (
          <Button
            color="red"
            variant="light"
            leftSection={<Icon icon="tabler:door-exit" style={{ width: rem(16) }} />}
            onClick={onLeave}
            mt="md"
          >
            Leave Game
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
