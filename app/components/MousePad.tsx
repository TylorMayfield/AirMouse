import { useRef } from 'react';
import { View, StyleSheet, PanResponder, Pressable } from 'react-native';
import { Socket } from 'socket.io-client';

const MOVE_SCALE = 1.2;
const SCROLL_SCALE = 0.5;

type MousePadProps = {
  socket: Socket;
};

export function MousePad({ socket }: MousePadProps) {
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastTapTime = useRef(0);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        lastX.current = gestureState.x0;
        lastY.current = gestureState.y0;

        // Start long press timer
        longPressTimeout.current = setTimeout(() => {
          socket.emit('mouse:click', { button: 'right' });
          longPressTimeout.current = null;
        }, 600);
      },
      onPanResponderMove: (evt, gestureState) => {
        const dx = (gestureState.moveX - lastX.current) * MOVE_SCALE;
        const dy = (gestureState.moveY - lastY.current) * MOVE_SCALE;

        lastX.current = gestureState.moveX;
        lastY.current = gestureState.moveY;

        // If moved significantly, cancel long press
        if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
          if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
          }
        }

        if (evt.nativeEvent.touches.length === 2) {
          socket.emit('mouse:scroll', { dy: dy * SCROLL_SCALE });
        } else {
          socket.emit('mouse:move', { dx, dy });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;

          // Simple tap detection
          if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
            socket.emit('mouse:click', { button: 'left' });
          }
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;
        }
      },
    })
  ).current;

  return (
    <View style={styles.pad} {...panResponder.panHandlers}>
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
