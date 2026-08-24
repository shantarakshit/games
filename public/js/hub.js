/**
 * Party Games Hub - Main Frontend Application Orchestrator
 * Bootstraps modules, manages server info, and binds global socket listeners.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const inputPlayerName = document.getElementById('inputPlayerName');
  const selectAvatar = document.getElementById('selectAvatar');
  const gamesContainer = document.getElementById('gamesContainer');
  const btnToggleMute = document.getElementById('btnToggleMute');
  const soundIcon = document.getElementById('soundIcon');
  const btnHomeBrand = document.getElementById('btnHomeBrand');
  const userBadgeEl = document.getElementById('headerUserBadge');
  const btnEnterHub = document.getElementById('btnEnterHub');

  let serverInfo = null;

  // 1. Audio Mute Toggle & Restore State
  if (SoundFX && SoundFX.muted && soundIcon) soundIcon.innerText = '🔇';
  if (btnToggleMute) {
    btnToggleMute.onclick = () => {
      const isMuted = SoundFX.toggleMute();
      if (soundIcon) soundIcon.innerText = isMuted ? '🔇' : '🔊';
    };
  }

  // 2. Pre-fill User Credentials & Avatar
  const lastName = localStorage.getItem('party_last_name') || '';
  if (lastName && inputPlayerName) inputPlayerName.value = lastName;

  if (selectAvatar) {
    const options = Array.from(selectAvatar.options).map(o => o.value);
    if (options.length > 0) {
      const randomAvatar = options[Math.floor(Math.random() * options.length)];
      selectAvatar.value = randomAvatar;
      ClientState.avatar = randomAvatar;
    }
  }

  // 3. Initialize Sub-Modules
  PinAuthModal.init();
  RulesModal.init();
  SettingsModal.init(null);
  ShareModal.init();
  LobbyUI.init(null);
  CodenamesUI.setupListeners();
  SpyUI.setupListeners();
  MafiaUI.setupListeners();

  // 4. Fetch Server Info & Auto-detect Network IP
  fetch('/api/info')
    .then(res => res.json())
    .then(info => {
      serverInfo = info;
      SettingsModal.setServerInfo(info);
      LobbyUI.setServerInfo(info);

      const netIpText = document.getElementById('networkIpText');
      if (netIpText) {
        netIpText.innerText = info.primaryIP ? `Wi-Fi: ${info.primaryIP}:${info.port}` : 'Local Server';
      }
      renderGamesGallery(info.games);
    })
    .catch(err => {
      console.warn('Could not fetch server info:', err);
      const netIpText = document.getElementById('networkIpText');
      if (netIpText) netIpText.innerText = 'Local Server';
    });

  // Check URL path for auto-joining room (e.g. /join or /join/CODE)
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] === 'join' && pathParts[2]) {
    ClientState.roomCode = pathParts[2].toUpperCase();
  }

  // Render Available Games Gallery on Home screen
  function renderGamesGallery(games) {
    if (!gamesContainer || !games) return;
    gamesContainer.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <div class="game-card-header">
          <span class="game-icon">${game.icon}</span>
          <span class="game-name">${game.name}</span>
        </div>
        <p class="game-desc">${game.description}</p>
        <div class="game-meta">
          <span>👥 ${game.minPlayers}-${game.maxPlayers} Players</span>
          <span>${game.category}</span>
        </div>
      `;
      gamesContainer.appendChild(card);
    });
  }

  // Allow clicking header user badge to logout
  if (userBadgeEl) {
    userBadgeEl.style.cursor = 'pointer';
    userBadgeEl.title = 'Tap to logout';
    userBadgeEl.onclick = () => {
      SoundFX.playClick();
      socket.emit('leave_room', () => {
        ClientState.roomCode = null;
        localStorage.removeItem('party_last_pin');
        showView('viewHome');
      });
      setTimeout(() => {
        ClientState.roomCode = null;
        showView('viewHome');
      }, 300);
    };
  }

  // Brand Logo Click: Open Game Rules Modal
  if (btnHomeBrand) {
    btnHomeBrand.onclick = () => {
      SoundFX.playClick();
      openRulesModal('codenames');
    };
  }

  // Single 1-Tap Enter Hub Button (Explicit Nickname Login & PIN Verification)
  if (btnEnterHub) {
    btnEnterHub.onclick = () => {
      SoundFX.playClick();
      savePlayerCredentials(
        inputPlayerName ? inputPlayerName.value : '',
        selectAvatar ? selectAvatar.value : '😎'
      );
      updateHeaderUserBadge();

      const targetRoomCode = ClientState.roomCode || 'MAIN';
      const playerName = ClientState.playerName;
      const avatar = ClientState.avatar;

      // Check if user exists in the room
      socket.emit('check_user', { roomCode: targetRoomCode, playerName }, (checkRes) => {
        const mode = (checkRes && checkRes.exists) ? 'verify' : 'create';
        openPinAuthModal(mode, playerName, targetRoomCode, avatar);
      });
    };
  }

  // ================= GLOBAL SOCKET LISTENERS =================

  // Room Updated
  socket.on('room_updated', (room) => {
    ClientState.currentRoom = room;
    ClientState.isHost = room.hostId === socket.id;

    if (room.gameState === 'lobby') {
      LobbyUI.render(room);
      showView('viewLobby');
    }
  });

  // Kicked From Room
  socket.on('kicked_from_room', (data) => {
    ClientState.roomCode = null;
    localStorage.removeItem('party_last_pin');
    showView('viewHome');
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Removed from Lobby', data.message || 'You were removed from the lobby by the Host.');
    }
  });

  // Server Reset
  socket.on('server_reset', (data) => {
    ClientState.roomCode = null;
    localStorage.removeItem('party_last_pin');
    showView('viewHome');
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Server Reset', data.message || 'The server has been reset. Please rejoin.');
    }
  });

  // System Warning / Notice Message
  socket.on('system_message', (data) => {
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Notice', data.text || 'System message received.');
    }
  });

  // Timer Tick
  socket.on('timer_tick', (data) => {
    if (!ClientState.currentGame) return;
    ClientState.currentGame.timerSeconds = data.timerSeconds;
    const secs = data.timerSeconds;

    if (secs !== undefined && secs !== null) {
      const minsStr = Math.floor(secs / 60).toString().padStart(2, '0');
      const secsStr = (secs % 60).toString().padStart(2, '0');
      const timeFormatted = `${minsStr}:${secsStr}`;

      if (ClientState.currentGame.gameId === 'codenames') {
        const timerEl = document.getElementById('cnTimerText');
        const timerContainer = document.getElementById('cnTimerContainer');
        if (timerContainer) timerContainer.classList.remove('hidden');
        if (timerEl) timerEl.innerText = timeFormatted;
      } else if (ClientState.currentGame.gameId === 'spy') {
        const timerEl = document.getElementById('spyTimerText');
        if (timerEl) timerEl.innerText = timeFormatted;
      } else if (ClientState.currentGame.gameId === 'mafia') {
        const timerEl = document.getElementById('mafiaTimerText');
        if (timerEl) timerEl.innerText = timeFormatted;
      }
    }
  });

  // Game State Updated
  socket.on('game_state_updated', (gameState) => {
    ClientState.currentGame = gameState;

    if (gameState.gameId === 'codenames') {
      showView('viewCodenames');
      CodenamesUI.render(gameState);
    } else if (gameState.gameId === 'spy') {
      showView('viewSpy');
      SpyUI.render(gameState);
    } else if (gameState.gameId === 'mafia') {
      showView('viewMafia');
      MafiaUI.render(gameState);
    }
  });
});

