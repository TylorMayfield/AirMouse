import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SocketProvider } from '@/lib/SocketContext';

export default function RootLayout() {
  return (
    <PaperProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SocketProvider>
    </PaperProvider>
  );
}
