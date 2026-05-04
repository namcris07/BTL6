import { useEffect, useRef } from 'react';
import { Modal, Table, Button, Text, Stack, Group, Badge } from '@mantine/core';
import { Icon } from '@iconify/react';
import type { GameState } from '../common/types';
import type { AudioManager } from '../client/AudioManager';
import styles from './ResultsScreen.module.css';

interface ResultsScreenProps {
  opened: boolean;
  gameState: GameState | null;
  localPlayerId: string | null;
  onReturnToLobby: () => void;
  audioManager: AudioManager | null;
}

export default function ResultsScreen({
  opened,
  gameState,
  localPlayerId,
  onReturnToLobby,
  audioManager,
}: ResultsScreenProps) {
  console.log('ResultsScreen render:', { opened, hasGameState: !!gameState, gameMode: gameState?.gameMode });
  const victoryMusicPlayedRef = useRef(false);
  
  // Play victory music when results screen opens
  useEffect(() => {
    if (opened && audioManager && !victoryMusicPlayedRef.current) {
      audioManager.playVictoryMusic();
      victoryMusicPlayedRef.current = true;
    }
    
    // Reset flag when results screen closes
    if (!opened) {
      victoryMusicPlayedRef.current = false;
    }
  }, [opened, audioManager]);
  
  // Auto-return to lobby after countdown
  useEffect(() => {
    if (!gameState || !opened || !gameState.freezeTimeEnd) return;

    const now = Date.now();
    const delay = gameState.freezeTimeEnd - now;

    if (delay > 0) {
      const timer = setTimeout(() => {
        onReturnToLobby();
      }, delay);

      return () => clearTimeout(timer);
    } else {
      // Already past the delay, return immediately
      onReturnToLobby();
    }
  }, [gameState, opened, onReturnToLobby]);
  
  if (!gameState || !opened) {
    return null;
  }

  const winner = gameState.winnerId
    ? gameState.players.find(p => p.id === gameState.winnerId)
    : null;

  // Sort players by kills (descending)
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    return (b.kills || 0) - (a.kills || 0);
  });

  // Calculate match duration
  const durationSeconds = gameState.matchDuration
    ? Math.floor(gameState.matchDuration / 1000)
    : 0;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Determine end reason text
  let endReasonText = 'Match Complete';
  let endReasonColor = 'blue';
  switch (gameState.endReason) {
    case 'timer':
      endReasonText = 'Time Limit Reached';
      endReasonColor = 'orange';
      break;
    case 'target':
      endReasonText = `Target Score Reached (${gameState.targetScore} kills)`;
      endReasonColor = 'green';
      break;
    case 'rounds':
      endReasonText = 'All Rounds Complete';
      endReasonColor = 'blue';
      break;
  }

  // Calculate countdown to lobby return
  const now = Date.now();
  const remainingMs = gameState.freezeTimeEnd ? Math.max(0, gameState.freezeTimeEnd - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const rows = sortedPlayers.map((player, index) => {
    const isLocalPlayer = player.id === localPlayerId;
    const isWinner = player.id === gameState.winnerId;
    const kdRatio = (player.deaths || 0) > 0 
      ? ((player.kills || 0) / (player.deaths || 0)).toFixed(2)
      : (player.kills || 0).toString();

    return (
      <Table.Tr
        key={player.id}
        className={`${styles.playerRow} ${isLocalPlayer ? styles.localPlayerRow : ''} ${isWinner ? styles.winnerRow : ''}`}
      >
        <Table.Td className={styles.rankCell}>
          {index === 0 && <Icon icon="mdi:trophy" className={styles.trophyIcon} />}
          {index + 1}
        </Table.Td>
        <Table.Td>
          {player.username || player.id.substring(0, 8)}
          {isWinner && <Badge size="xs" color="yellow" ml="xs">WINNER</Badge>}
          {isLocalPlayer && !isWinner && <Badge size="xs" color="green" ml="xs">YOU</Badge>}
        </Table.Td>
        <Table.Td className={styles.statCell}>{player.kills || 0}</Table.Td>
        <Table.Td className={styles.statCell}>{player.deaths || 0}</Table.Td>
        <Table.Td className={styles.statCell}>{kdRatio}</Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {}} // Prevent closing by clicking outside
      title={null}
      centered
      size="xl"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withinPortal={false}
      zIndex={99999}
      classNames={{
        root: styles.modalRoot,
        overlay: styles.modalOverlay,
        inner: styles.modalInner,
        content: styles.modalContent,
      }}
      styles={{
        root: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99999 },
      }}
    >
      <Stack gap="lg">
        {/* Winner Banner */}
        <div className={styles.winnerBanner}>
          <Icon icon="mdi:trophy-variant" className={styles.winnerIcon} />
          <Text size="xl" fw={700} className={styles.winnerText}>
            {winner ? `${winner.username || winner.id.substring(0, 8)} WINS!` : 'GAME OVER'}
          </Text>
          <Icon icon="mdi:trophy-variant" className={styles.winnerIcon} />
        </div>

        {/* Match Info */}
        <Group justify="center" gap="xl">
          <div className={styles.matchInfo}>
            <Text size="sm" c="dimmed">Duration</Text>
            <Text size="lg" fw={600}>{durationText}</Text>
          </div>
          <div className={styles.matchInfo}>
            <Text size="sm" c="dimmed">End Condition</Text>
            <Badge color={endReasonColor} size="lg" variant="light">
              {endReasonText}
            </Badge>
          </div>
          {gameState.targetScore && (
            <div className={styles.matchInfo}>
              <Text size="sm" c="dimmed">Target Score</Text>
              <Text size="lg" fw={600}>{gameState.targetScore} kills</Text>
            </div>
          )}
        </Group>

        {/* Player Statistics Table */}
        <Table highlightOnHover className={styles.resultsTable}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={styles.rankHeader}>Rank</Table.Th>
              <Table.Th>Player</Table.Th>
              <Table.Th className={styles.statHeader}>Kills</Table.Th>
              <Table.Th className={styles.statHeader}>Deaths</Table.Th>
              <Table.Th className={styles.statHeader}>K/D</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>

        {/* Return to Lobby Button */}
        <Group justify="center" mt="md">
          <Button
            size="lg"
            color="blue"
            leftSection={<Icon icon="mdi:home" />}
            onClick={onReturnToLobby}
            className={styles.returnButton}
          >
            Return to Lobby
            {remainingSeconds > 0 && ` (${remainingSeconds}s)`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
