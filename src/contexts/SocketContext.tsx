import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { socketService } from '@/socket/socketClient';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  isConnected: boolean;
  socketId: string | undefined;
}

const SocketContext = createContext<SocketContextValue>({
  isConnected: false,
  socketId: undefined,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      setIsConnected(false);
      setSocketId(undefined);
      initialized.current = false;
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      setSocketId(socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setSocketId(undefined);
    });

    return () => {
      // Keep connection alive across page navigations
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ isConnected, socketId }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextValue {
  return useContext(SocketContext);
}
