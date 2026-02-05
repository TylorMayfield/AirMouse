import { useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { Socket } from 'socket.io-client';

const MOVE_SCALE = 1.2;
const LONG_PRESS_MS = 500;

type MousePadProps = {
  socket: Socket;
};

export function MousePad({ socket }: MousePadProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef<{ x: number; y: number } | null>(null);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gestureState) => {
      lastMove.current = { x: gestureState.x0, y: gestureState.y0 };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        socket.emit('mouse:click', { button: 'right' });
      }, LONG_PRESS_MS);
    },
    onPanResponderMove: (_, gestureState) => {
      if (lastMove.current) {
        const dx = (gestureState.moveX - lastMove.current.x) * MOVE_SCALE;
        const dy = (gestureState.moveY - lastMove.current.y) * MOVE_SCALE;
        lastMove.current = { x: gestureState.moveX, y: gestureState.moveY };
        socket.emit('mouse:move', { dx, dy });
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        const moved = Math.abs(gestureState.dx) + Math.abs(gestureState.dy) >= 10;
        if (!moved) socket.emit('mouse:click', { button: 'left' });
      }
      lastMove.current = null;
    },
  });

  return (
    <View style={styles.pad} {...pan.panHandlers}>
      <View style={styles.padInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  padInner: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 14,
  },
});
