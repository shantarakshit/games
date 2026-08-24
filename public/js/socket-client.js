// Client Socket.io Connection & State Manager
const socket = io();

socket.on('connect', () => {
  if (typeof ClientState !== 'undefined') {
    ClientState.myPlayerId = socket.id;
  }
  console.log('🔌 Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.warn('⚡ Disconnected from server');
});
