import { useState, useEffect } from 'react';
import { Modal, Slider, Text, Title, Stack, Paper, Button, Group } from '@mantine/core';
import { AudioManager } from '../client/AudioManager';
import { GameClient } from '../client/GameClient';
import styles from './Settings.module.css';

interface SettingsProps {
  opened: boolean;
  onClose: () => void;
  audioManager: AudioManager | null;
  gameClient?: GameClient | null;
  variant?: 'modal' | 'inline';
  onExitGame?: () => void;
}

export default function Settings({
  opened,
  onClose,
  audioManager,
  gameClient,
  variant = 'modal',
  onExitGame,
}: SettingsProps) {
  const [bgmVolume, setBgmVolume] = useState(() =>
    audioManager ? Math.round(audioManager.getBgmVolume() * 100) : 100
  );
  const [sfxVolume, setSfxVolume] = useState(() =>
    audioManager ? Math.round(audioManager.getSfxVolume() * 100) : 100
  );
  const [cameraSensitivity, setCameraSensitivity] = useState(() =>
    gameClient ? gameClient.getCameraSensitivity() : 50
  );

  // Load current settings from managers
  useEffect(() => {
    if (audioManager) {
      setBgmVolume(Math.round(audioManager.getBgmVolume() * 100));
      setSfxVolume(Math.round(audioManager.getSfxVolume() * 100));
    }
    if (gameClient) {
      setCameraSensitivity(gameClient.getCameraSensitivity());
    }
  }, [audioManager, gameClient, opened]);

  // Apply changes to managers
  useEffect(() => {
    if (audioManager) {
      audioManager.setBgmVolume(bgmVolume / 100);
      audioManager.setSfxVolume(sfxVolume / 100);
    }
  }, [bgmVolume, sfxVolume, audioManager]);

  useEffect(() => {
    if (gameClient) {
      gameClient.setCameraSensitivity(cameraSensitivity);
    }
  }, [cameraSensitivity, gameClient]);

  const settingsContent = (
    <Stack gap="md">
      <Title order={2} ta="center">
        Settings
      </Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={3} size="h4">
            Audio
          </Title>

          <Stack gap="xs">
            <Text>Music Volume</Text>
            <Group justify="space-between" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <Slider
                value={bgmVolume}
                onChange={setBgmVolume}
                min={0}
                max={100}
                label={null}
                className={styles.slider}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Text className={styles.volumeText} w={55} ta="right">
                {bgmVolume}%
              </Text>
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text>SFX Volume</Text>
            <Group justify="space-between" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <Slider
                value={sfxVolume}
                onChange={setSfxVolume}
                min={0}
                max={100}
                label={null}
                className={styles.slider}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Text className={styles.volumeText} w={55} ta="right">
                {sfxVolume}%
              </Text>
            </Group>
          </Stack>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={3} size="h4">
            Camera
          </Title>

          <Stack gap="xs">
            <Text>Camera Sensitivity</Text>
            <Group justify="space-between" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <Slider
                value={cameraSensitivity}
                onChange={setCameraSensitivity}
                min={0}
                max={100}
                label={null}
                className={styles.slider}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Text className={styles.volumeText} w={55} ta="right">
                {cameraSensitivity}%
              </Text>
            </Group>
          </Stack>
        </Stack>
      </Paper>

      {variant === 'modal' && (
        <Stack gap="sm">
          {onExitGame && (
            <Button variant="filled" color="red" onClick={onExitGame} fullWidth>
              Exit Game
            </Button>
          )}
          <Button variant="light" onClick={onClose} fullWidth>
            Close
          </Button>
        </Stack>
      )}
      {variant === 'inline' && (
        <Button variant="light" onClick={onClose} fullWidth>
          Back to Menu
        </Button>
      )}
    </Stack>
  );

  if (variant === 'modal') {
    if (!opened) {
      return null;
    }

    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="Settings"
        centered
        zIndex={10000}
        withinPortal={false}
        classNames={{
          root: styles.modalRoot,
          overlay: styles.modalOverlay,
          inner: styles.modalInner,
          content: styles.modalContent,
        }}
      >
        {settingsContent}
      </Modal>
    );
  }

  return settingsContent;
}
