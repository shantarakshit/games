/**
 * Lobby UI Controller
 * Manages player roster rendering, team assignments, game selector cards, and host controls.
 */

const LobbyUI = {
  serverInfo: null,

  init(serverInfoRef) {
    this.serverInfo = serverInfoRef;

    const btnStartGame = document.getElementById('btnStartGame');
    const btnLeaveRoom = document.getElementById('btnLeaveRoom');
    const btnJoinRed = document.getElementById('btnJoinRed');
    const btnJoinBlue = document.getElementById('btnJoinBlue');
    const btnClaimRedSpyLobby = document.getElementById('btnClaimRedSpyLobby');
    const btnClaimBlueSpyLobby = document.getElementById('btnClaimBlueSpyLobby');

    if (btnStartGame) {
      btnStartGame.onclick = () => {
        SoundFX.playChime();
        if (ClientState.isHost) {
          socket.emit('start_game');
        }
      };
    }

    if (btnLeaveRoom) {
      btnLeaveRoom.onclick = () => {
        SoundFX.playClick();
        if (typeof SessionManager !== 'undefined') {
          SessionManager.clearSession();
        }
        socket.emit('leave_room', () => {
          ClientState.roomCode = null;
          showView('viewHome');
        });
        setTimeout(() => {
          ClientState.roomCode = null;
          showView('viewHome');
        }, 300);
      };
    }

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
  },

  setServerInfo(info) {
    this.serverInfo = info;
  },

  render(room) {
    if (!room) return;

    const playerCount = document.getElementById('playerCount');
    if (playerCount) playerCount.innerText = room.players.length;
    updateHeaderHostBadge(room);

    // Update Nickname Banner
    const lobbyNicknameAvatar = document.getElementById('lobbyNicknameAvatar');
    const lobbyNicknameText = document.getElementById('lobbyNicknameText');
    if (lobbyNicknameAvatar) lobbyNicknameAvatar.innerText = ClientState.avatar || '😎';
    if (lobbyNicknameText) lobbyNicknameText.innerText = ClientState.playerName || 'Player';

    // Render Players
    const playersList = document.getElementById('playersList');
    if (playersList) {
      playersList.innerHTML = '';
      room.players.forEach(p => {
        const isAway = Boolean(p.isAway || p.connected === false);
        const offlineBadge = isAway ? `<span class="offline-pill away-pill" title="Player is Away. Game can only start when everyone is active.">😴 Away</span>` : '';

        const card = document.createElement('div');
        card.className = `player-card${isAway ? ' player-card-away' : ''}${p.isHost ? ' player-card-host' : ''}`;
        const roleTag = (room.gameId === 'codenames') ? `${p.team.toUpperCase()} (${p.role.toUpperCase()})` : (p.isHost ? 'Host 👑' : 'Player');
        
        let hostActions = '';
        if (ClientState.isHost && !p.isHost && p.id !== socket.id) {
          hostActions = `
            <div class="host-player-actions">
              <button class="btn btn-warning btn-xs btn-make-host" data-player-id="${p.id}" data-player-name="${p.name}">👑 Host</button>
              <button class="btn btn-danger btn-xs btn-kick-player" data-player-id="${p.id}" data-player-name="${p.name}">❌ Remove</button>
            </div>
          `;
        }

        card.innerHTML = `
          <span class="player-avatar">${p.avatar}</span>
          <div class="player-info">
            <div class="player-name-row">
              <span class="player-name">${p.name} ${p.isHost ? '👑' : ''}</span>
              ${offlineBadge}
            </div>
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
    this.renderCodenamesLobbyRoster(room);

    // Render Lobby Game Selector Grid
    this.renderGameSelector(room);

    // Host Action Buttons Visibility
    const btnStartGame = document.getElementById('btnStartGame');
    const btnOpenSettings = document.getElementById('btnOpenSettings');

    if (ClientState.isHost) {
      if (btnStartGame) btnStartGame.classList.toggle('hidden', !room.gameId);
      if (btnOpenSettings) btnOpenSettings.classList.toggle('hidden', !room.gameId);
    } else {
      if (btnStartGame) btnStartGame.classList.add('hidden');
      if (btnOpenSettings) btnOpenSettings.classList.add('hidden');
    }
  },

  renderCodenamesLobbyRoster(room) {
    const lobbyTeamRoster = document.getElementById('lobbyTeamRoster');
    const btnStartGame = document.getElementById('btnStartGame');
    if (!lobbyTeamRoster) return;

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
      const selectedGame = (this.serverInfo && this.serverInfo.games) ? this.serverInfo.games.find(g => g.id === room.gameId) : null;
      const minReq = selectedGame ? (selectedGame.minPlayers || 4) : 4;
      const hasMinPlayers = room.players.length >= minReq;
      const hasAwayPlayers = room.players.some(p => p.isAway || p.connected === false);
      const canStart = bothClaimed && hasMinPlayers && !hasAwayPlayers;

      let warningMsg = '';
      if (hasAwayPlayers) {
        warningMsg = `⚠️ Cannot start game while players are Away. Wait for them to reconnect or Host can Remove them.`;
      } else if (!hasMinPlayers) {
        warningMsg = `⚠️ Codenames requires at least ${minReq} players to start (currently ${room.players.length} in room).`;
      } else if (!bothClaimed) {
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
      const selectedGame = (this.serverInfo && this.serverInfo.games) ? this.serverInfo.games.find(g => g.id === room.gameId) : null;
      const minReq = selectedGame ? (selectedGame.minPlayers || 3) : 3;
      const hasMinPlayers = room.players.length >= minReq;
      const hasAwayPlayers = room.players.some(p => p.isAway || p.connected === false);
      const canStart = hasMinPlayers && !hasAwayPlayers;

      let warningMsg = '';
      if (hasAwayPlayers) {
        warningMsg = `⚠️ Cannot start game while players are Away. Wait for them to reconnect or Host can Remove them.`;
      } else if (!hasMinPlayers && room.gameId === 'spy') {
        warningMsg = `⚠️ The Imposter Game requires at least ${minReq} players to start (currently ${room.players.length} in room).`;
      } else if (!hasMinPlayers && room.gameId === 'mafia') {
        warningMsg = `⚠️ Mafia requires at least ${minReq} players to start (currently ${room.players.length} in room).`;
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
    }
  },

  renderGameSelector(room) {
    const lobbyGamesList = document.getElementById('lobbyGamesList');
    if (!lobbyGamesList) return;

    lobbyGamesList.innerHTML = '';
    const availableGames = (this.serverInfo && this.serverInfo.games && this.serverInfo.games.length > 0)
      ? this.serverInfo.games
      : [
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
};

window.updateLobbyUI = (room) => LobbyUI.render(room);
