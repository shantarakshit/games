// Client Socket.io Connection & State Manager
const socket = io();

const ClientState = {
  playerName: '',
  avatar: localStorage.getItem('party_last_avatar') || '😎',
  roomCode: null,
  isHost: false,
  myPlayerId: null,
  currentRoom: null,
  currentGame: null,
  spymasterPasscode: false
};

socket.on('connect', () => {
  ClientState.myPlayerId = socket.id;
  console.log('🔌 Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.warn('⚡ Disconnected from server');
});
