import { io, Socket } from 'socket.io-client';
import { JWT_STORAGE_KEY } from '@/api/client';
import { SOCKET_SERVER_URL } from '@/config/env';
import type { SocketEventMap } from '@/types';

type SocketEventKey = keyof SocketEventMap;
type SocketEventHandler<K extends SocketEventKey> = (data: SocketEventMap[K]) => void;

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  // Components (e.g. useSocketEvent) may call `on()` before the underlying
  // Socket.IO client exists yet — e.g. their effect runs before
  // SocketProvider's own effect calls connect() (React fires child effects
  // before parent effects), or before the user is authenticated at all.
  // Keep every registered handler here so it can be (re)attached to whatever
  // socket instance is active — both on first connect() and on any future
  // reconnect cycle (e.g. logout then login again creates a fresh Socket).
  private handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    const authToken = localStorage.getItem(JWT_STORAGE_KEY);

    this.socket = io(SOCKET_SERVER_URL, {
      auth: { token: authToken },
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

    // Re-attach any handlers that were registered before this socket
    // instance existed (or that belonged to a previous instance).
    for (const [event, eventHandlers] of this.handlers) {
      for (const handler of eventHandlers) {
        this.socket.on(event, handler);
      }
    }

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on<K extends SocketEventKey>(event: K, handler: SocketEventHandler<K>): void {
    const key = event as string;
    const wrappedHandler = handler as (...args: unknown[]) => void;

    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(wrappedHandler);

    this.socket?.on(key, wrappedHandler);
  }

  off<K extends SocketEventKey>(event: K, handler?: SocketEventHandler<K>): void {
    const key = event as string;

    if (handler) {
      const wrappedHandler = handler as (...args: unknown[]) => void;
      this.handlers.get(key)?.delete(wrappedHandler);
      this.socket?.off(key, wrappedHandler);
    } else {
      this.handlers.delete(key);
      this.socket?.off(key);
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
