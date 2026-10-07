import { io, type Socket } from "socket.io-client";

const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? "";

export function connectTrackingSocket(token: string): Socket {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
}
