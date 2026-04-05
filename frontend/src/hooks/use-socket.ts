import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

/**
 * Subscribe to a Socket.IO event. Automatically cleans up on unmount.
 */
export function useSocket<T = unknown>(event: string, handler: (data: T) => void): void {
  useEffect(() => {
    const socket = getSocket();
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}
