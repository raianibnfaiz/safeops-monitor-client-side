import { io, Socket } from 'socket.io-client';
import type { SocketEventMap } from '@/types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'safeops_token';

type SocketEventKey = keyof SocketEventMap;
type SocketEventHandler<K extends SocketEventKey> = (data: SocketEventMap[K]) => void;

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    const token = localStorage.getItem(TOKEN_KEY);

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on<K extends SocketEventKey>(event: K, handler: SocketEventHandler<K>): void {
    this.socket?.on(event as string, handler as (...args: unknown[]) => void);
  }

  off<K extends SocketEventKey>(event: K, handler?: SocketEventHandler<K>): void {
    if (handler) {
      this.socket?.off(event as string, handler as (...args: unknown[]) => void);
    } else {
      this.socket?.off(event as string);
    }
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}

export const socketService = new SocketService();
