import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { MousePad } from '@/components/MousePad';

export default function MouseScreen() {
  const theme = useTheme();
  const { socket, connected, disconnect } = useSocket();

  const handleDisconnect = () => {
    disconnect();
    router.replace('/');
  };

  if (!socket || !connected) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text>Not connected. Going back...</Text>
        <Button onPress={() => router.replace('/')}>Back</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="titleMedium" numberOfLines={2}>
          Touch to move • Tap click • Long-press right-click
        </Text>
        <Button mode="text" onPress={handleDisconnect} compact>
          Disconnect
        </Button>
      </View>
      <MousePad socket={socket} />
      <View style={styles.scrollRow}>
        <Button mode="outlined" onPress={() => socket.emit('mouse:scroll', { dy: 120 })} compact>
          Scroll up
        </Button>
        <Button mode="outlined" onPress={() => socket.emit('mouse:scroll', { dy: -120 })} compact>
          Scroll down
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  scrollRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
});
