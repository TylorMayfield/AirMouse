import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TextInput, Text, useTheme, Card } from 'react-native-paper';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSocket } from '@/lib/SocketContext';
import { CameraView } from '@/components/QRScanner';

export default function ConnectScreen() {
  const theme = useTheme();
  const { setServerUrl, setRoomId, connect, disconnect, connected } = useSocket();
  const [server, setServer] = useState(__DEV__ ? 'http://192.168.1.1:3000' : '');
  const [room, setRoom] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      const url = event.url;
      if (url.startsWith('airmouse://connect')) {
        try {
          const u = new URL(url);
          const s = u.searchParams.get('server') || '';
          const r = u.searchParams.get('room') || '';
          if (s) setServer(s);
          if (r) setRoom(r);
          setServerUrl(s);
          setRoomId(r);
          connect({ serverUrl: s, roomId: r });
        } catch (_) {}
      }
    });
    return () => sub.remove();
  }, []);

  const handleConnect = () => {
    setError('');
    const s = server.trim();
    const r = room.trim();
    if (!s || !r) {
      setError('Enter server URL and room code');
      return;
    }
    setServerUrl(s);
    setRoomId(r);
    connect();
  };

  useEffect(() => {
    if (connected) router.replace('/mouse');
  }, [connected]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Air Mouse
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Connect to your computer
        </Text>

        {showScanner ? (
          <View style={styles.scannerWrap}>
            <CameraView
              onScan={(url) => {
                try {
                  const u = new URL(url);
                  if (u.protocol === 'airmouse:') {
                    const s = u.searchParams.get('server') || '';
                    const r = u.searchParams.get('room') || '';
                    if (s) setServer(s);
                    if (r) setRoom(r);
                    setServerUrl(s);
                    setRoomId(r);
                    setShowScanner(false);
                    connect({ serverUrl: s, roomId: r });
                  }
                } catch (_) {}
              }}
              onClose={() => setShowScanner(false)}
            />
          </View>
        ) : (
          <>
            <Card style={styles.card}>
              <TextInput
                label="Server URL"
                value={server}
                onChangeText={setServer}
                placeholder="http://192.168.1.x:3000"
                mode="outlined"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <TextInput
                label="Room code"
                value={room}
                onChangeText={setRoom}
                placeholder="e.g. abc123"
                mode="outlined"
                autoCapitalize="characters"
                style={styles.input}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Card>

            <Button mode="outlined" onPress={() => setShowScanner(true)} style={styles.btn}>
              Scan QR code
            </Button>
            <Button mode="contained" onPress={handleConnect} style={styles.btn}>
              Connect
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: 32,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    color: '#b00020',
    marginTop: 8,
  },
  btn: {
    marginBottom: 12,
  },
});
