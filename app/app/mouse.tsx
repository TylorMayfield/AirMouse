import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { MousePad } from '@/components/MousePad';

export default function MouseScreen() {
  const theme = useTheme();
  const { socket, connected } = useSocket();

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
        <Text variant="titleMedium" style={styles.headerText}>
          Touch to move • Tap click • Long-press right-click
        </Text>
      </View>
      <MousePad socket={socket} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerText: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
