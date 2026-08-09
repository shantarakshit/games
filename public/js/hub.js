document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const inputPlayerName = document.getElementById('inputPlayerName');
  const selectAvatar = document.getElementById('selectAvatar');
  const inputRoomCode = document.getElementById('inputRoomCode');
  const btnOpenCreate = document.getElementById('btnOpenCreate');
  const btnJoinRoom = document.getElementById('btnJoinRoom');
  const gamesContainer = document.getElementById('gamesContainer');

  const viewHome = document.getElementById('viewHome');
  const viewLobby = document.getElementById('viewLobby');
  const viewCodenames = document.getElementById('viewCodenames');
  const viewSpy = document.getElementById('viewSpy');

  const lobbyRoomCode = document.getElementById('lobbyRoomCode');
  const playersList = document.getElementById('playersList');
  const playerCount = document.getElementById('playerCount');
  const lobbyGamesList = document.getElementById('lobbyGamesList');
  const btnStartGame = document.getElementById('btnStartGame');
  const btnLeaveRoom = document.getElementById('btnLeaveRoom');
  const btnOpenSettings = document.getElementById('btnOpenSettings');

  const modalQR = document.getElementById('modalQR');
  const modalQRImg = document.getElementById('modalQRImg');
  const modalUrlInput = document.getElementById('modalUrlInput');
  const btnCopyUrl = document.getElementById('btnCopyUrl');
  const btnMessengerShare = document.getElementById('btnMessengerShare');
  const btnCloseQR = document.getElementById('btnCloseQR');
  const btnQRHeader = document.getElementById('btnQRHeader');

  const modalSettings = document.getElementById('modalSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const settingsSchemaContainer = document.getElementById('settingsSchemaContainer');

  const btnToggleMute = document.getElementById('btnToggleMute');
  const soundIcon = document.getElementById('soundIcon');

  let serverInfo = null;

  // Restore Mute State
  if (SoundFX && SoundFX.muted && soundIcon) soundIcon.innerText = '🔇';
  if (btnToggleMute) {
    btnToggleMute.onclick = () => {
      const isMuted = SoundFX.toggleMute();
      if (soundIcon) soundIcon.innerText = isMuted ? '🔇' : '🔊';
    };
  }

  // Pre-fill last typed name for convenience, but always require user to enter hub
  const lastName = localStorage.getItem('party_last_name') || '';
  if (lastName && inputPlayerName) inputPlayerName.value = lastName;

  // Fetch Server Info & Auto-detect IP
  fetch('/api/info')
    .then(res => res.json())
    .then(info => {
      serverInfo = info;
      const netIpText = document.getElementById('networkIpText');
      if (netIpText) netIpText.innerText = info.primaryIP ? `Wi-Fi: ${info.primaryIP}:${info.port}` : 'Local Server';
      renderGamesGallery(info.games);
    })
    .catch(err => {
      console.warn('Could not fetch server info:', err);
      const netIpText = document.getElementById('networkIpText');
      if (netIpText) netIpText.innerText = 'Local Server';
    });

  // Check URL path for auto-joining room (e.g. /join/CODE)
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] === 'join' && pathParts[2] && inputRoomCode) {
    inputRoomCode.value = pathParts[2].toUpperCase();
  }

  // Render Available Games Gallery
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

  // Switch View Helper
  function showView(viewId) {
    [viewHome, viewLobby, viewCodenames, viewSpy].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.remove('hidden');

    // Header Share Link button visibility
    const isRoomActive = viewId !== 'viewHome' && ClientState.roomCode;
    const qrHeader = document.getElementById('btnQRHeader');
    if (qrHeader) qrHeader.classList.toggle('hidden', !isRoomActive);
    
    const roomBadge = document.getElementById('headerRoomBadge');
    const roomCodeEl = document.getElementById('headerRoomCode');
    if (isRoomActive) {
      if (roomCodeEl) roomCodeEl.innerText = ClientState.roomCode;
      if (roomBadge) roomBadge.classList.remove('hidden');
    } else {
      if (roomBadge) roomBadge.classList.add('hidden');
    }

    // Always keep the player hostname badge visible after login
    updateHeaderUserBadge();
    updateHeaderHostBadge(ClientState.currentRoom);
  }

  // Update Header Host Pill Badge (shows current Host next to Wi-Fi pill)
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

  // Update Header User Badge
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

  // Save Player Credentials
  function savePlayerCredentials() {
    ClientState.playerName = (inputPlayerName ? inputPlayerName.value.trim() : '') || 'Player';
    ClientState.avatar = selectAvatar ? selectAvatar.value : '😎';
    localStorage.setItem('party_last_name', ClientState.playerName);
    localStorage.setItem('party_last_avatar', ClientState.avatar);
    updateHeaderUserBadge();
  }

  if (ClientState.playerName) updateHeaderUserBadge();

  // Allow clicking header user badge to logout
  const userBadgeEl = document.getElementById('headerUserBadge');
  if (userBadgeEl) {
    userBadgeEl.style.cursor = 'pointer';
    userBadgeEl.title = 'Tap to logout';
    userBadgeEl.onclick = () => {
      SoundFX.playClick();
      window.location.reload();
    };
  }

  // Single 1-Tap Enter Hub Button (Explicit Nickname Login & Reconnection)
  const btnEnterHub = document.getElementById('btnEnterHub');
  if (btnEnterHub) {
    btnEnterHub.onclick = () => {
      SoundFX.playClick();
      savePlayerCredentials();

      socket.emit('join_room', {
        roomCode: 'MAIN',
        playerName: ClientState.playerName,
        avatar: ClientState.avatar
      }, (res) => {
        if (res && res.success) {
          ClientState.roomCode = res.room.code;
          ClientState.isHost = res.room.hostId === socket.id;
          updateLobbyUI(res.room);
          if (res.room.gameState === 'playing' && res.room.gameId) {
            showView(res.room.gameId === 'codenames' ? 'viewCodenames' : 'viewSpy');
          } else {
            showView('viewLobby');
          }
        } else {
          // No active room exists yet, auto-create room!
          socket.emit('create_room', {
            playerName: ClientState.playerName,
            avatar: ClientState.avatar
          }, (cRes) => {
            if (cRes && cRes.success) {
              ClientState.roomCode = cRes.roomCode;
              ClientState.isHost = true;
              updateLobbyUI(cRes.room);
              showView('viewLobby');
            }
          });
        }
      });
    };
  }

  // Socket Listener: Room Updated
  socket.on('room_updated', (room) => {
    ClientState.currentRoom = room;
    ClientState.isHost = room.hostId === socket.id;

    if (room.gameState === 'lobby') {
      updateLobbyUI(room);
      showView('viewLobby');
    }
  });

  // Socket Listener: Kicked From Room
  socket.on('kicked_from_room', (data) => {
    ClientState.roomCode = null;
    showView('viewHome');
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Removed from Lobby', data.message || 'You were removed from the lobby by the Host.');
    }
  });

  // Socket Listener: Server Reset
  socket.on('server_reset', (data) => {
    ClientState.roomCode = null;
    showView('viewHome');
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Server Reset', data.message || 'The server has been reset. Please rejoin.');
    }
  });

  // Socket Listener: System Warning / Notice Message
  socket.on('system_message', (data) => {
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Notice', data.text || 'System message received.');
    }
  });

  // Custom In-Game Modal Helper
  window.showCustomConfirm = function(title, message, onConfirm) {
    const modal = document.getElementById('modalConfirm');
    const titleEl = document.getElementById('modalConfirmTitle');
    const msgEl = document.getElementById('modalConfirmMessage');
    const btnCancel = document.getElementById('btnModalCancel');
    const btnConfirm = document.getElementById('btnModalConfirm');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;

    if (modal) modal.classList.remove('hidden');

    if (btnCancel) {
      btnCancel.onclick = () => {
        SoundFX.playClick();
        if (modal) modal.classList.add('hidden');
      };
    }

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        SoundFX.playClick();
        if (modal) modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
      };
    }
  };

  // Socket Listener: Timer Tick
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
      }
    }
  });

  // Socket Listener: Game State Updated
  socket.on('game_state_updated', (gameState) => {
    ClientState.currentGame = gameState;

    if (gameState.gameId === 'codenames') {
      showView('viewCodenames');
      CodenamesUI.render(gameState);
    } else if (gameState.gameId === 'spy') {
      showView('viewSpy');
      SpyUI.render(gameState);
    }
  });

  // Update Lobby UI
  function updateLobbyUI(room) {
    if (playerCount) playerCount.innerText = room.players.length;
    updateHeaderHostBadge(room);

    // Update Nickname Banner
    const lobbyNicknameAvatar = document.getElementById('lobbyNicknameAvatar');
    const lobbyNicknameText = document.getElementById('lobbyNicknameText');
    if (lobbyNicknameAvatar) lobbyNicknameAvatar.innerText = ClientState.avatar || '😎';
    if (lobbyNicknameText) lobbyNicknameText.innerText = ClientState.playerName || 'Player';

    // Render Players
    if (playersList) {
      playersList.innerHTML = '';
      room.players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card';
        const roleTag = (room.gameId === 'codenames') ? `${p.team.toUpperCase()} (${p.role.toUpperCase()})` : (p.isHost ? 'Host 👑' : 'Player');
        
        let hostActions = '';
        if (ClientState.isHost && !p.isHost && p.id !== socket.id) {
          hostActions = `
            <div class="host-player-actions" style="display: flex; gap: 4px; margin-left: auto; flex-shrink: 0;">
              <button class="btn btn-warning btn-xs btn-make-host" data-player-id="${p.id}" data-player-name="${p.name}">👑 Host</button>
              <button class="btn btn-danger btn-xs btn-kick-player" data-player-id="${p.id}" data-player-name="${p.name}">❌ Remove</button>
            </div>
          `;
        }

        card.innerHTML = `
          <span class="player-avatar">${p.avatar}</span>
          <div class="player-info">
            <span class="player-name">${p.name} ${p.isHost ? '👑' : ''}</span>
            <span class="player-role-tag">${roleTag}</span>
          </div>
          ${hostActions}
        `;

        const hostBtnEl = card.querySelector('.btn-make-host');
        if (hostBtnEl) {
          hostBtnEl.onclick = () => {
            const targetId = hostBtnEl.dataset.playerId;
            const targetName = hostBtnEl.dataset.playerName;
            if (typeof window.showCustomConfirm === 'function') {
              window.showCustomConfirm('Transfer Host Privileges?', `Make ${targetName} the new Host of this room?`, () => {
                socket.emit('transfer_host', { targetId });
              });
            } else {
              socket.emit('transfer_host', { targetId });
            }
          };
        }

        const kickBtnEl = card.querySelector('.btn-kick-player');
        if (kickBtnEl) {
          kickBtnEl.onclick = () => {
            const targetId = kickBtnEl.dataset.playerId;
            const targetName = kickBtnEl.dataset.playerName;
            if (typeof window.showCustomConfirm === 'function') {
              window.showCustomConfirm('Remove Player from Lobby?', `Are you sure you want to remove ${targetName} from the lobby?`, () => {
                socket.emit('kick_player', { targetId });
              });
            } else {
              socket.emit('kick_player', { targetId });
            }
          };
        }

        playersList.appendChild(card);
      });
    }

    // Render Team Roster Panel for Codenames
    const lobbyTeamRoster = document.getElementById('lobbyTeamRoster');
    if (lobbyTeamRoster) {
      if (room.gameId === 'codenames') {
        lobbyTeamRoster.classList.remove('hidden');

        const redPlayers = room.players.filter(p => p.team === 'red');
        const bluePlayers = room.players.filter(p => p.team === 'blue');
        const redSpy = room.players.find(p => p.team === 'red' && p.role === 'spymaster');
        const blueSpy = room.players.find(p => p.team === 'blue' && p.role === 'spymaster');

        const redSpyName = document.getElementById('redSpymasterName');
        const blueSpyName = document.getElementById('blueSpymasterName');
        if (redSpyName) redSpyName.innerText = redSpy ? redSpy.name : 'Vacant';
        if (blueSpyName) blueSpyName.innerText = blueSpy ? blueSpy.name : 'Vacant';

        const redList = document.getElementById('redPlayersList');
        const blueList = document.getElementById('bluePlayersList');

        if (redList) {
          redList.innerHTML = '';
          redPlayers.forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'team-player-tag';
            tag.innerText = `${p.avatar} ${p.name} ${p.role === 'spymaster' ? '🕵️ (Spymaster)' : ''}`;
            redList.appendChild(tag);
          });
        }

        if (blueList) {
          blueList.innerHTML = '';
          bluePlayers.forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'team-player-tag';
            tag.innerText = `${p.avatar} ${p.name} ${p.role === 'spymaster' ? '🕵️ (Spymaster)' : ''}`;
            blueList.appendChild(tag);
          });
        }

        // Team Join & Spymaster Claim Buttons Enable/Disable Rules
        const myPlayer = room.players.find(p => p.id === socket.id);
        const myTeam = myPlayer ? myPlayer.team : 'red';

        const btnJoinRed = document.getElementById('btnJoinRed');
        const btnJoinBlue = document.getElementById('btnJoinBlue');
        const btnClaimRed = document.getElementById('btnClaimRedSpyLobby');
        const btnClaimBlue = document.getElementById('btnClaimBlueSpyLobby');

        if (btnJoinRed) {
          const isMeRed = myTeam === 'red';
          btnJoinRed.disabled = isMeRed;
          btnJoinRed.innerText = isMeRed ? '✓ Joined' : 'Join Red';
          btnJoinRed.style.opacity = isMeRed ? '0.5' : '1';
        }

        if (btnJoinBlue) {
          const isMeBlue = myTeam === 'blue';
          btnJoinBlue.disabled = isMeBlue;
          btnJoinBlue.innerText = isMeBlue ? '✓ Joined' : 'Join Blue';
          btnJoinBlue.style.opacity = isMeBlue ? '0.5' : '1';
        }

        if (btnClaimRed) {
          const isMeRed = myTeam === 'red';
          const isMeSpy = redSpy && redSpy.id === socket.id;
          if (!isMeRed) {
            btnClaimRed.disabled = true;
            btnClaimRed.innerText = 'Red Only';
            btnClaimRed.style.opacity = '0.5';
          } else if (isMeSpy) {
            btnClaimRed.disabled = true;
            btnClaimRed.innerText = '🔒 You are Spymaster';
            btnClaimRed.style.opacity = '0.7';
          } else if (redSpy) {
            btnClaimRed.disabled = true;
            btnClaimRed.innerText = '🔒 Claimed';
            btnClaimRed.style.opacity = '0.5';
          } else {
            btnClaimRed.disabled = false;
            btnClaimRed.innerText = 'Claim';
            btnClaimRed.style.opacity = '1';
          }
        }

        if (btnClaimBlue) {
          const isMeBlue = myTeam === 'blue';
          const isMeSpy = blueSpy && blueSpy.id === socket.id;
          if (!isMeBlue) {
            btnClaimBlue.disabled = true;
            btnClaimBlue.innerText = 'Blue Only';
            btnClaimBlue.style.opacity = '0.5';
          } else if (isMeSpy) {
            btnClaimBlue.disabled = true;
            btnClaimBlue.innerText = '🔒 You are Spymaster';
            btnClaimBlue.style.opacity = '0.7';
          } else if (blueSpy) {
            btnClaimBlue.disabled = true;
            btnClaimBlue.innerText = '🔒 Claimed';
            btnClaimBlue.style.opacity = '0.5';
          } else {
            btnClaimBlue.disabled = false;
            btnClaimBlue.innerText = 'Claim';
            btnClaimBlue.style.opacity = '1';
          }
        }

        // Spymaster Requirement Badge
        const reqBadge = document.getElementById('spymasterReqBadge');
        const bothClaimed = redSpy && blueSpy;
        if (reqBadge) {
          reqBadge.innerText = bothClaimed ? '✅ Both Spymasters Ready!' : '⚠️ Claim Both Spymasters to Start';
          reqBadge.className = bothClaimed ? 'requirement-badge ready-badge' : 'requirement-badge warning-badge';
        }

        // Check min players requirement & spymaster requirement
        const lobbyStartWarning = document.getElementById('lobbyStartWarning');
        const selectedGame = (serverInfo && serverInfo.games) ? serverInfo.games.find(g => g.id === room.gameId) : null;
        const minReq = selectedGame ? (selectedGame.minPlayers || 4) : 4;
        const hasMinPlayers = room.players.length >= minReq || room.players.length === 1;
        const canStart = (bothClaimed || room.players.length === 1) && hasMinPlayers;

        let warningMsg = '';
        if (!hasMinPlayers) {
          warningMsg = `⚠️ Codenames requires at least ${minReq} players to start (currently ${room.players.length} in room).`;
        } else if (!bothClaimed && room.players.length > 1) {
          warningMsg = `⚠️ Claim both RED Spymaster and BLUE Spymaster positions to start!`;
        }

        if (lobbyStartWarning) {
          if (warningMsg) {
            lobbyStartWarning.innerText = warningMsg;
            lobbyStartWarning.classList.remove('hidden');
          } else {
            lobbyStartWarning.classList.add('hidden');
          }
        }

        if (ClientState.isHost && btnStartGame) {
          btnStartGame.disabled = !canStart;
          btnStartGame.title = canStart ? 'Start Game' : warningMsg;
        }
      } else {
        lobbyTeamRoster.classList.add('hidden');
        const lobbyStartWarning = document.getElementById('lobbyStartWarning');
        const selectedGame = (serverInfo && serverInfo.games) ? serverInfo.games.find(g => g.id === room.gameId) : null;
        const minReq = selectedGame ? (selectedGame.minPlayers || 3) : 3;
        const hasMinPlayers = room.players.length >= minReq || room.players.length === 1;

        let warningMsg = '';
        if (!hasMinPlayers && room.gameId === 'spy') {
          warningMsg = `⚠️ The Imposter Game requires at least ${minReq} players to start (currently ${room.players.length} in room).`;
        }

        if (lobbyStartWarning) {
          if (warningMsg) {
            lobbyStartWarning.innerText = warningMsg;
            lobbyStartWarning.classList.remove('hidden');
          } else {
            lobbyStartWarning.classList.add('hidden');
          }
        }

        if (ClientState.isHost && btnStartGame) {
          btnStartGame.disabled = !hasMinPlayers;
          btnStartGame.title = hasMinPlayers ? 'Start Game' : warningMsg;
        }
      }
    }

    // Render Lobby Game Selector Grid
    const lobbyGamesList = document.getElementById('lobbyGamesList');
    if (lobbyGamesList) {
      lobbyGamesList.innerHTML = '';
      const availableGames = (serverInfo && serverInfo.games && serverInfo.games.length > 0) ? serverInfo.games : [
        { id: 'codenames', name: 'Codenames', icon: '🕵️‍♂️', description: 'Give 1-word clues to reveal your secret agent team cards while avoiding the deadly assassin!', minPlayers: 4, maxPlayers: 16 },
        { id: 'spy', name: 'The Imposter Game', icon: '🕵️‍♀️', description: 'Find the hidden imposter among your party guests before time runs out!', minPlayers: 3, maxPlayers: 16 }
      ];

      availableGames.forEach(game => {
        const gameItem = document.createElement('div');
        const isSelected = room.gameId === game.id;
        gameItem.className = `game-card ${isSelected ? 'selected' : ''}`;
        gameItem.style.border = isSelected ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)';
        gameItem.style.cursor = ClientState.isHost ? 'pointer' : 'default';
        gameItem.innerHTML = `
          <div class="game-card-header">
            <span class="game-icon">${game.icon}</span>
            <span class="game-name">${game.name}</span>
          </div>
          <p class="game-desc">${game.description}</p>
        `;

        if (ClientState.isHost) {
          gameItem.onclick = () => {
            SoundFX.playClick();
            socket.emit('select_game', { gameId: game.id });
          };
        }
        lobbyGamesList.appendChild(gameItem);
      });
    }

    // Host Controls
    if (ClientState.isHost) {
      if (btnStartGame) btnStartGame.classList.toggle('hidden', !room.gameId);
      if (btnOpenSettings) btnOpenSettings.classList.toggle('hidden', !room.gameId);
    } else {
      if (btnStartGame) btnStartGame.classList.add('hidden');
      if (btnOpenSettings) btnOpenSettings.classList.add('hidden');
    }
  }

  // Settings Modal Handlers
  if (btnOpenSettings) {
    btnOpenSettings.onclick = () => {
      SoundFX.playClick();
      if (!ClientState.currentRoom || !ClientState.currentRoom.gameId || !serverInfo) return;

      const game = serverInfo.games.find(g => g.id === ClientState.currentRoom.gameId);
      if (!game || !game.settingsSchema) return;

      const roomSettings = (ClientState.currentRoom.settings && ClientState.currentRoom.settings[game.id]) || {};

      if (settingsSchemaContainer) {
        settingsSchemaContainer.innerHTML = '';
        game.settingsSchema.forEach(item => {
          const itemContainer = document.createElement('div');
          itemContainer.className = 'setting-item';

          const label = document.createElement('label');
          label.innerText = item.label;

          const currentValue = roomSettings[item.id] !== undefined ? roomSettings[item.id] : item.default;

          let select = document.createElement('select');
          select.className = 'form-control';
          select.dataset.settingId = item.id;

          item.options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.innerText = opt.label;
            if (String(opt.value) === String(currentValue)) {
              optionEl.selected = true;
            }
            select.appendChild(optionEl);
          });

          const desc = document.createElement('div');
          desc.className = 'setting-desc';
          desc.innerText = item.description;

          itemContainer.appendChild(label);
          itemContainer.appendChild(select);
          itemContainer.appendChild(desc);
          settingsSchemaContainer.appendChild(itemContainer);
        });
      }

      if (modalSettings) modalSettings.classList.remove('hidden');
    };
  }

  if (btnSaveSettings) {
    btnSaveSettings.onclick = () => {
      SoundFX.playChime();
      const gameId = ClientState.currentRoom.gameId;
      const newSettings = {};

      if (settingsSchemaContainer) {
        const selects = settingsSchemaContainer.querySelectorAll('select');
        selects.forEach(select => {
          const id = select.dataset.settingId;
          let val = select.value;
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(val) && val !== '') val = Number(val);
          newSettings[id] = val;
        });
      }

      socket.emit('update_settings', { gameId, settings: newSettings });
      if (modalSettings) modalSettings.classList.add('hidden');
    };
  }

  if (btnCloseSettings) btnCloseSettings.onclick = () => { if (modalSettings) modalSettings.classList.add('hidden'); };

  // Host Start Game
  if (btnStartGame) {
    btnStartGame.onclick = () => {
      SoundFX.playChime();
      if (ClientState.isHost) {
        socket.emit('start_game');
      }
    };
  }

  // Leave Room
  if (btnLeaveRoom) {
    btnLeaveRoom.onclick = () => {
      SoundFX.playClick();
      window.location.reload();
    };
  }

  // Share & QR Modal Handlers
  function getJoinUrl() {
    const host = serverInfo ? serverInfo.primaryIP : window.location.hostname;
    const port = serverInfo ? serverInfo.port : window.location.port;
    return `http://${host}:${port}/`;
  }

  function openShareModal() {
    SoundFX.playClick();
    const url = getJoinUrl();
    if (modalUrlInput) modalUrlInput.value = url;

    // Update Messenger share button — copy link then open Messenger app directly
    if (btnMessengerShare) {
      btnMessengerShare.onclick = async (e) => {
        e.preventDefault();
        // Copy the link to clipboard first
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          }
        } catch (_) {}
        // Open Messenger app via deep link (mobile) — fb-messenger:// opens the app
        // Falls back to the web Messenger on desktop
        const messengerDeepLink = `fb-messenger://share?link=${encodeURIComponent(url)}`;
        window.location.href = messengerDeepLink;
        // Fallback: open web Messenger after a short delay if the app didn't open
        setTimeout(() => {
          window.open(`https://m.me/?link=${encodeURIComponent(url)}`, '_blank');
        }, 1200);
      };
    }

    fetch(`/api/qrcode?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (modalQRImg) modalQRImg.src = data.qrDataUrl;
        if (modalQR) modalQR.classList.remove('hidden');
      });
  }

  async function triggerCopyLink(btnEl) {
    SoundFX.playClick();
    const url = getJoinUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }

    if (btnEl) {
      const origText = btnEl.innerText;
      btnEl.innerText = 'Copied! ✔️';
      setTimeout(() => {
        btnEl.innerText = origText;
      }, 2000);
    }
  }

  if (btnQRHeader) btnQRHeader.onclick = openShareModal;
  if (btnCloseQR) btnCloseQR.onclick = () => { if (modalQR) modalQR.classList.add('hidden'); };

  if (btnCopyUrl) {
    btnCopyUrl.onclick = (e) => triggerCopyLink(e.currentTarget);
  }

  // Pre-Game Team Roster Event Handlers
  const btnJoinRed = document.getElementById('btnJoinRed');
  const btnJoinBlue = document.getElementById('btnJoinBlue');
  const btnClaimRedSpyLobby = document.getElementById('btnClaimRedSpyLobby');
  const btnClaimBlueSpyLobby = document.getElementById('btnClaimBlueSpyLobby');

  if (btnJoinRed) {
    btnJoinRed.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'set_team', team: 'red' });
    };
  }

  if (btnJoinBlue) {
    btnJoinBlue.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'set_team', team: 'blue' });
    };
  }

  if (btnClaimRedSpyLobby) {
    btnClaimRedSpyLobby.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'set_team', team: 'red' });
      socket.emit('game_action', { action: 'claim_spymaster' });
    };
  }

  if (btnClaimBlueSpyLobby) {
    btnClaimBlueSpyLobby.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'set_team', team: 'blue' });
      socket.emit('game_action', { action: 'claim_spymaster' });
    };
  }

  // Register Game UI Listeners
  CodenamesUI.setupListeners();
  SpyUI.setupListeners();
});
