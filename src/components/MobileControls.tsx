import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { rem } from '@mantine/core';
import { SkillType } from '../common/constants';
import styles from './MobileControls.module.css';

interface MobileControlsProps {
  onMove: (direction: { x: number; z: number }) => void;
  onStopMove: () => void;
  onSkillPress: (skillType: SkillType) => void;
  onSkillRelease?: (skillType: SkillType) => void;
  isGameActive: boolean;
}

const SKILLS = [
  { type: SkillType.TELEPORT, icon: 'fluent-emoji:cyclone', label: 'TP' },
  { type: SkillType.HOMING_MISSILE, icon: 'fluent-emoji:comet', label: 'MSL' },
  { type: SkillType.LASER_BEAM, icon: 'fluent-emoji:water-pistol', label: 'LAS' },
  { type: SkillType.INVINCIBILITY, icon: 'fluent-emoji:shield', label: 'SHLD' },
] as const;

export default function MobileControls({
  onMove,
  onStopMove,
  onSkillPress,
  onSkillRelease,
  isGameActive,
}: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const getTouchPosition = useCallback((e: TouchEvent): { x: number; y: number } | null => {
    const touch = touchIdRef.current !== null
      ? Array.from(e.touches).find(t => t.identifier === touchIdRef.current)
      : e.touches[0];
    
    if (!touch) return null;
    
    return { x: touch.clientX, y: touch.clientY };
  }, []);

  const updateJoystick = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate raw deltas from touch position to center
    const rawDeltaX = clientX - centerX;
    const rawDeltaY = clientY - centerY;
    const distance = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY);
    const maxDistance = rect.width / 2 - 30; // Leave some margin for knob

    const clampedDistance = Math.min(distance, maxDistance);
    
    // Visual position should match where finger is (direct mapping)
    const visualX = distance > 0 ? (rawDeltaX / distance) * clampedDistance : 0;
    const visualY = distance > 0 ? (rawDeltaY / distance) * clampedDistance : 0;

    setJoystickPosition({ x: visualX, y: visualY });

    // Calculate movement direction (inverted Y for game coordinates)
    // In game: forward = -z, backward = +z, left = -x, right = +x
    const deltaX = rawDeltaX;
    const deltaY = centerY - clientY; // Invert Y: screen Y increases downward, but we want up = forward
    const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    const normalizedX = movementDistance > 0 ? (deltaX / movementDistance) * (clampedDistance / maxDistance) : 0;
    const normalizedZ = movementDistance > 0 ? (-deltaY / movementDistance) * (clampedDistance / maxDistance) : 0; // Forward is negative Z

    onMove({ x: normalizedX, z: normalizedZ });
  }, [onMove]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isGameActive) return;
    
    const touch = e.touches[0];
    if (!joystickRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    // Check if touch is within joystick area
    if (
      touchX >= rect.left &&
      touchX <= rect.right &&
      touchY >= rect.top &&
      touchY <= rect.bottom
    ) {
      e.preventDefault();
      touchIdRef.current = touch.identifier;
      setIsDragging(true);
      updateJoystick(touchX, touchY);
    }
  }, [isGameActive, updateJoystick]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !isGameActive) return;

    const pos = getTouchPosition(e);
    if (pos) {
      e.preventDefault();
      updateJoystick(pos.x, pos.y);
    }
  }, [isDragging, isGameActive, getTouchPosition, updateJoystick]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    // Check if the touch that ended is our tracked touch
    if (touchIdRef.current !== null) {
      const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
      if (touch) {
        e.preventDefault();
        setIsDragging(false);
        setJoystickPosition({ x: 0, y: 0 });
        touchIdRef.current = null;
        onStopMove();
      }
    }
  }, [isDragging, onStopMove]);

  useEffect(() => {
    if (!isGameActive) return;

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isGameActive, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!isGameActive) return null;

  return (
    <>
      {/* Virtual Joystick - Bottom Left */}
      <div ref={joystickRef} className={styles.joystick}>
        <div
          ref={joystickKnobRef}
          className={styles.joystickKnob}
          style={{
            transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
          }}
        />
      </div>


      {/* Mobile Skill Buttons - Bottom Right */}
      <div className={styles.mobileSkills}>
        {SKILLS.map(skill => (
          <button
            key={skill.type}
            className={styles.mobileSkillButton}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSkillPress(skill.type);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onSkillRelease && skill.type === SkillType.TELEPORT) {
                onSkillRelease(skill.type);
              }
            }}
            type="button"
          >
            <Icon icon={skill.icon} style={{ width: rem(24), height: rem(24) }} />
            <span className={styles.skillLabel}>{skill.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

