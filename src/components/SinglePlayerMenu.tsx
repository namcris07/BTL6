import { useState } from 'react';
import {
  Button,
  Stack,
  Text,
  Select,
  Paper,
  Title,
  Group,
  Badge,
  SegmentedControl,
} from '@mantine/core';
import { Icon } from '@iconify/react';
import styles from './SinglePlayerMenu.module.css';

interface SinglePlayerMenuProps {
  onStartGame: (botCount: number) => void;
  onBack: () => void;
}

const BOT_COUNT_OPTIONS = [
  { value: '1', label: '1 Bot' },
  { value: '2', label: '2 Bots' },
  { value: '3', label: '3 Bots' },
  { value: '4', label: '4 Bots' },
  { value: '5', label: '5 Bots' },
];

export default function SinglePlayerMenu({ onStartGame, onBack }: SinglePlayerMenuProps) {
  const [botCount, setBotCount] = useState('3');

  const handleStart = () => {
    onStartGame(parseInt(botCount, 10));
  };

  return (
    <Stack gap="xl" className={styles.container}>
      <Title order={2} ta="center" className={styles.title}>
        Single Player
      </Title>

      <Paper p="lg" withBorder className={styles.infoPanel}>
        <Stack gap="md">
          <Text size="sm" c="dimmed" className={styles.description}>
            Play against AI bots in offline mode. Bots have different behaviors:
          </Text>
          <Group gap="sm" justify="center" className={styles.badgeGroup}>
            <Badge 
              color="red" 
              variant="light" 
              size="lg" 
              className={styles.badge}
              leftSection={<Icon icon="fluent-emoji:angry-face" style={{ fontSize: '16px' }} />}
            >
              Aggressive
            </Badge>
            <Badge 
              color="blue" 
              variant="light" 
              size="lg" 
              className={styles.badge}
              leftSection={<Icon icon="fluent-emoji:shield" style={{ fontSize: '16px' }} />}
            >
              Defensive
            </Badge>
            <Badge 
              color="yellow" 
              variant="light" 
              size="lg" 
              className={styles.badge}
              leftSection={<Icon icon="fluent-emoji:balance-scale" style={{ fontSize: '16px' }} />}
            >
              Balanced
            </Badge>
          </Group>
        </Stack>
      </Paper>

      <Stack gap="md" className={styles.selectContainer}>
        <Text size="sm" fw={600} c="dimmed" className={styles.label}>
          Number of Bots
        </Text>
        <Select
          value={botCount}
          onChange={(value) => setBotCount(value || '3')}
          data={BOT_COUNT_OPTIONS}
          allowDeselect={false}
          placeholder="Select number of bots"
          size="md"
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 10000 }}
          styles={{
            root: {
              width: '100%',
            },
            input: {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontSize: '16px',
              padding: '14px 16px',
              minHeight: '48px',
              borderRadius: '12px',
            },
            rightSection: {
              color: 'rgba(255, 255, 255, 0.7)',
              pointerEvents: 'none',
            },
            dropdown: {
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
            },
            option: {
              backgroundColor: 'transparent',
              color: '#fff',
            },
            optionHovered: {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        />
      </Stack>

      <Group grow gap="md" className={styles.buttonGroup}>
        <Button 
          variant="light" 
          onClick={onBack}
          className={styles.backButton}
          leftSection={<Icon icon="tabler:arrow-left" style={{ fontSize: '18px' }} />}
        >
          Back
        </Button>
        <Button 
          onClick={handleStart}
          className={styles.startButton}
          leftSection={<Icon icon="tabler:player-play" style={{ fontSize: '18px' }} />}
        >
          Start Game
        </Button>
      </Group>
    </Stack>
  );
}

