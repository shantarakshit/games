/**
 * Session & Auto-Reconnection Manager
 * Seamlessly restores player sessions and game state on wake/resume/reconnect.
 */
const SessionManager = {
  saveSession(roomCode, playerName, avatar, pin) {
    if (roomCode) localStorage.setItem('party_active_room_code', String(roomCode).toUpperCase().trim());
    if (playerName) localStorage.setItem('party_last_name', String(playerName).trim());
    if (avatar) localStorage.setItem('party_last_avatar', avatar);
    if (pin) localStorage.setItem('party_last_pin', String(pin).trim());
  },

  clearSession() {
    localStorage.removeItem('party_active_room_code');
  },

  getActiveSession() {
    const roomCode = localStorage.getItem('party_active_room_code');
    const playerName = localStorage.getItem('party_last_name');
    const avatar = localStorage.getItem('party_last_avatar') || '😎';
    const pin = localStorage.getItem('party_last_pin');
    if (roomCode && playerName && pin && pin.length === 4) {
      return { roomCode: roomCode.toUpperCase(), playerName, avatar, pin };
    }
    return null;
  },

  isReconnecting: false,

  trySilentReconnect() {
    const session = this.getActiveSession();
    if (!session || this.isReconnecting) return;
    if (typeof socket === 'undefined' || !socket.connected) return;

    this.isReconnecting = true;
    console.log(`⚡ Silent Auto-Reconnect attempting for "${session.playerName}" in room [${session.roomCode}]...`);

    socket.emit('join_room', {
      roomCode: session.roomCode,
      playerName: session.playerName,
      avatar: session.avatar,
      pin: session.pin
    }, (res) => {
      this.isReconnecting = false;
      if (res && res.success) {
        console.log(`✅ Silent Auto-Reconnect SUCCESS for [${session.roomCode}]!`);
        ClientState.roomCode = res.room.code;
        ClientState.isHost = res.room.hostId === socket.id;
        ClientState.currentRoom = res.room;

        if (res.room.gameState === 'lobby') {
          if (typeof LobbyUI !== 'undefined' && LobbyUI.render) {
            LobbyUI.render(res.room);
          }
          if (typeof showView === 'function') {
            showView('viewLobby');
          }
        } else if (res.room.gameState === 'playing' && res.room.gameId) {
          if (typeof WakeLockManager !== 'undefined') {
            WakeLockManager.requestLock();
          }
          if (typeof showView === 'function') {
            if (res.room.gameId === 'codenames') {
              showView('viewCodenames');
            } else if (res.room.gameId === 'spy') {
              showView('viewSpy');
            } else if (res.room.gameId === 'mafia') {
              showView('viewMafia');
            }
          }
        }
      } else if (res && res.errorCode === 'INVALID_PIN') {
        console.warn('Silent Reconnect failed: Invalid PIN stored.');
        this.clearSession();
      } else {
        console.warn('Silent Reconnect: Room does not exist or expired.');
        this.clearSession();
      }
    });
  },

  init() {
    // 1. Reconnect on socket connect / reconnect
    if (typeof socket !== 'undefined' && socket.on) {
      socket.on('connect', () => {
        this.trySilentReconnect();
      });
    }

    // 2. Reconnect on tab / screen wake (visibilitychange & pageshow & online)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.trySilentReconnect();
      }
    });

    window.addEventListener('pageshow', () => {
      this.trySilentReconnect();
    });

    window.addEventListener('online', () => {
      this.trySilentReconnect();
    });
  }
};
