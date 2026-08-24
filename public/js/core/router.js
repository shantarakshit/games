/**
 * View Router & Header Status Manager
 */

function updateHeaderUserBadge() {
  const userBadge = document.getElementById('headerUserBadge');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerPlayerName = document.getElementById('headerPlayerName');

  if (userBadge && ClientState.playerName) {
    if (headerAvatar) headerAvatar.innerText = ClientState.avatar || '😎';
    if (headerPlayerName) headerPlayerName.innerText = ClientState.playerName;
    userBadge.classList.remove('hidden');
  }
}

function updateHeaderHostBadge(room) {
  const hostBadge = document.getElementById('headerHostBadge');
  const hostNameEl = document.getElementById('headerHostName');
  if (!hostBadge || !hostNameEl) return;

  if (room && room.players && room.players.length > 0) {
    const hostPlayer = room.players.find(p => p.isHost);
    if (hostPlayer) {
      hostNameEl.innerText = hostPlayer.name;
      hostBadge.classList.remove('hidden');
      return;
    }
  }
  hostBadge.classList.add('hidden');
}

function showView(viewId) {
  const viewHome = document.getElementById('viewHome');
  const viewLobby = document.getElementById('viewLobby');
  const viewCodenames = document.getElementById('viewCodenames');
  const viewSpy = document.getElementById('viewSpy');
  const viewMafia = document.getElementById('viewMafia');

  [viewHome, viewLobby, viewCodenames, viewSpy, viewMafia].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.remove('hidden');

  // Header Share Link button visibility
  const isRoomActive = viewId !== 'viewHome' && ClientState.roomCode;
  const qrHeader = document.getElementById('btnQRHeader');
  if (qrHeader) qrHeader.classList.toggle('hidden', !isRoomActive);

  // Update header badges
  updateHeaderUserBadge();
  updateHeaderHostBadge(ClientState.currentRoom);
}
