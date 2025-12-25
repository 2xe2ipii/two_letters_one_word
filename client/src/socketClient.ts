import io, { Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Create a single shared instance
export const socket: Socket = io(SERVER_URL);