import { useEffect, useRef } from 'react';
import { socketService } from '@/socket/socketClient';
import type { SocketEventMap } from '@/types';

type SocketEventKey = keyof SocketEventMap;

/**
 * Subscribe to a Socket.IO event and automatically unsubscribe on cleanup.
 */
export function useSocketEvent<K extends SocketEventKey>(
  event: K,
  handler: (data: SocketEventMap[K]) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const wrappedHandler = (data: SocketEventMap[K]) => handlerRef.current(data);
    socketService.on(event, wrappedHandler);
    return () => socketService.off(event, wrappedHandler);
  }, [event, enabled]);
}
