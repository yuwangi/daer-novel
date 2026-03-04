import { Server } from 'socket.io';

let _io: Server | null = null;

export function setIO(io: Server) {
  _io = io;
}

export function getIO(): Server | null {
  return _io;
}
