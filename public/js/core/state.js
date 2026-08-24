/**
 * Client State Store
 * Holds reactive player session state, room info, and local storage caches.
 */
const ClientState = {
  playerName: localStorage.getItem('party_last_name') || '',
  avatar: localStorage.getItem('party_last_avatar') || '😎',
  roomCode: null,
  isHost: false,
  myPlayerId: null,
  currentRoom: null,
  currentGame: null,
  spymasterPasscode: false
};

// Save player name & avatar credentials to storage and state
function savePlayerCredentials(name, avatar) {
  if (name !== undefined) ClientState.playerName = name.trim() || 'Player';
  if (avatar !== undefined) ClientState.avatar = avatar || '😎';

  localStorage.setItem('party_last_name', ClientState.playerName);
  localStorage.setItem('party_last_avatar', ClientState.avatar);
}
