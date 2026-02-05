import React, { createContext, useContext, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type ConnectOverride = { serverUrl?: string; roomId?: string };

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  setServerUrl: (url: string) => void;
  setRoomId: (id: string) => void;
  connect: (override?: ConnectOverride) => void;
  disconnect: () => void;
};

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrlState] = useState('');
  const [roomId, setRoomIdState] = useState('');

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      socket.removeAllListeners();
      setSocket(null);
    }
    setConnected(false);
  }, [socket]);

  const connect = useCallback((override?: ConnectOverride) => {
    const url = (override?.serverUrl ?? serverUrl).trim();
    const room = (override?.roomId ?? roomId).trim();
    if (!url || !room) return;

    disconnect();
    const wsUrl = url.replace(/^http/, 'ws');
    const s = io(url, { transports: ['websocket', 'polling'] });

    s.on('connect', () => {
      s.emit('join', { identity: 'phone', roomId: room });
    });

    s.on('joined', () => {
      setSocket(s);
      setConnected(true);
    });

    s.on('paired', () => {
      setConnected(true);
    });

    s.on('error', (err: { message?: string }) => {
      console.error('Socket error:', err?.message);
    });

    s.on('disconnect', () => {
      setConnected(false);
      setSocket(null);
    });

    setSocket(s);
  }, [serverUrl, roomId, disconnect]);

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url);
  }, []);

  const setRoomId = useCallback((id: string) => {
    setRoomIdState(id);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        setServerUrl,
        setRoomId,
        connect,
        disconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
