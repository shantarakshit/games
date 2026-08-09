const CodenamesUI = {
  isSpymasterView: false,
  lastWinner: null,

  render(state) {
    if (!state || state.gameId !== 'codenames') return;

    // Update Scores
    const redScore = document.getElementById('cnRedScore');
    const blueScore = document.getElementById('cnBlueScore');
    if (redScore) redScore.innerText = state.redRemaining;
    if (blueScore) blueScore.innerText = state.blueRemaining;

    // Update Turn Banner & Strict Turn Text
    const turnBanner = document.getElementById('cnTurnBanner');
    const turnText = document.getElementById('cnTurnText');
    const timerContainer = document.getElementById('cnTimerContainer');
    const timerText = document.getElementById('cnTimerText');

    const myRole = state.myPlayer ? state.myPlayer.role : 'operative';
    const myTeam = state.myPlayer ? state.myPlayer.team : 'red';
    const isHost = state.myPlayer ? state.myPlayer.isHost : false;
    const isMyTeamTurn = myTeam === state.currentTurn;

    if (state.winner) {
      if (turnText) turnText.innerText = `🏆 ${(state.winner || '').toUpperCase()} TEAM WINS! (${state.winReason || 'Game Over'})`;
      if (turnBanner) turnBanner.className = `turn-banner ${state.winner}-bg`;
      if (timerContainer) timerContainer.classList.add('hidden');

      if (this.lastWinner !== state.winner) {
        this.lastWinner = state.winner;
        if (state.winReason === 'assassin') SoundFX.playExplosion();
        else SoundFX.playVictory();
      }
    } else {
      this.lastWinner = null;
      const teamEmoji = state.currentTurn === 'red' ? '🔴' : '🔵';
      const phaseText = state.currentRole === 'spymaster' ? 'SPYMASTER (Giving Clue...)' : 'OPERATIVES (Guessing Cards...)';
      
      if (turnText) turnText.innerText = `${teamEmoji} ${state.currentTurn.toUpperCase()} ${phaseText}`;
      if (turnBanner) turnBanner.className = `turn-banner ${state.currentTurn || 'red'}-bg`;

      // Turn Timer Display - Visible to ALL players during active game
      if (timerContainer) {
        if (!state.winner) {
          timerContainer.classList.remove('hidden');
          const secs = (state.timerSeconds !== undefined && state.timerSeconds !== null) ? state.timerSeconds : 120;
          const minsStr = Math.floor(secs / 60).toString().padStart(2, '0');
          const secsStr = (secs % 60).toString().padStart(2, '0');
          if (timerText) timerText.innerText = `${minsStr}:${secsStr}`;
        } else {
          timerContainer.classList.add('hidden');
        }
      }
    }

    // Role Status Text & Spymaster Slot Lock Button
    const roleText = document.getElementById('cnMyRoleText');
    const btnClaimSpymaster = document.getElementById('btnClaimSpymaster');
    const btnCNRestart = document.getElementById('btnCNRestart');

    if (roleText) {
      const teamClass = (myTeam === 'red') ? 'red' : 'blue';
      roleText.innerHTML = `<span class="role-team-tag ${teamClass}">${(myTeam || 'red').toUpperCase()}</span> ${(myRole || 'operative').toUpperCase()}`;
    }

    // Claim Spymaster Button State
    if (btnClaimSpymaster) {
      const isClaimed = myTeam === 'red' ? state.redSpymasterClaimed : state.blueSpymasterClaimed;
      if (myRole === 'spymaster') {
        btnClaimSpymaster.innerText = '🔒 You are Spymaster';
        btnClaimSpymaster.disabled = true;
      } else if (isClaimed) {
        btnClaimSpymaster.innerText = '🔒 Spymaster Locked';
        btnClaimSpymaster.disabled = true;
      } else {
        btnClaimSpymaster.innerText = '🕵️ Claim Spymaster';
        btnClaimSpymaster.disabled = false;
      }
    }

    // Restart Button Restriction: Host ONLY
    if (btnCNRestart) {
      btnCNRestart.disabled = !isHost;
      btnCNRestart.title = isHost ? 'Restart Game' : 'Only the Host can restart';
      btnCNRestart.style.opacity = isHost ? '1' : '0.5';
      btnCNRestart.classList.toggle('hidden', !isHost);
    }

    // Lobby Button: Host ONLY
    const btnCNLeave = document.getElementById('btnCNLeave');
    if (btnCNLeave) {
      btnCNLeave.classList.toggle('hidden', !isHost);
    }

    // Clue Bar & Controls - STRICT PHASE & TURN ENFORCEMENT
    const clueWord = document.getElementById('cnClueWord');
    const clueCount = document.getElementById('cnClueCount');
    const clueGiven = document.getElementById('cnClueGiven');
    const clueInputForm = document.getElementById('cnClueInputContainer');
    const clueDisplay = document.getElementById('cnClueDisplay');
    const btnEndTurn = document.getElementById('cnCNEndTurn');

    if (state.currentClue) {
      if (clueWord) clueWord.innerText = state.currentClue.word;
      const givenNum = state.currentClue.count;
      if (clueGiven) clueGiven.innerText = (givenNum === 0) ? '∞' : givenNum;
      const leftNum = state.currentClue.guessesLeft;
      if (clueCount) clueCount.innerText = (leftNum >= 99) ? '∞' : leftNum;
      if (clueDisplay) clueDisplay.classList.remove('hidden');
      if (clueInputForm) clueInputForm.classList.add('hidden');
    } else {
      if (clueWord) clueWord.innerText = 'None';
      if (clueGiven) clueGiven.innerText = '—';
      if (clueCount) clueCount.innerText = '—';

      // STRICT: Show Clue Form ONLY to Active Team's Spymaster!
      if (isMyTeamTurn && myRole === 'spymaster' && state.currentRole === 'spymaster' && !state.winner) {
        if (clueInputForm) clueInputForm.classList.remove('hidden');
        if (clueDisplay) clueDisplay.classList.add('hidden');
      } else {
        if (clueInputForm) clueInputForm.classList.add('hidden');
        if (clueDisplay) clueDisplay.classList.remove('hidden');
      }
    }

    // PROMINENT "IT IS YOUR TURN" BANNER UPDATES
    const banner = document.getElementById('cnTurnStatusBanner');
    const bannerText = document.getElementById('cnTurnStatusText');
    if (banner && bannerText) {
      banner.className = 'cn-turn-status-banner';
      if (state.winner) {
        banner.classList.add('banner-winner');
        bannerText.innerHTML = `🏆 GAME OVER! ${state.winner.toUpperCase()} TEAM WINS!`;
      } else if (isMyTeamTurn) {
        if (myRole === 'spymaster' && state.currentRole === 'spymaster') {
          banner.classList.add('banner-my-turn');
          bannerText.innerHTML = `⭐ IT IS YOUR TURN! (Spymaster — Submit a clue below)`;
        } else if (myRole === 'operative' && state.currentRole === 'operative') {
          banner.classList.add('banner-my-turn');
          bannerText.innerHTML = `⭐ IT IS YOUR TURN! (Operative — Tap cards to guess or click Pass Turn)`;
        } else if (myRole === 'spymaster' && state.currentRole === 'operative') {
          banner.classList.add('banner-waiting');
          bannerText.innerHTML = `🎯 Your Operatives are currently guessing cards...`;
        } else if (myRole === 'operative' && state.currentRole === 'spymaster') {
          banner.classList.add('banner-waiting');
          bannerText.innerHTML = `⏳ Waiting for your Spymaster to give a clue...`;
        } else {
          banner.classList.add('banner-my-turn');
          bannerText.innerHTML = `⭐ IT IS YOUR TEAM'S TURN! (${state.currentTurn.toUpperCase()} TEAM)`;
        }
      } else {
        banner.classList.add('banner-opposing-turn');
        bannerText.innerHTML = `⏳ Opposing Team (${state.currentTurn.toUpperCase()}) is currently playing...`;
      }
    }

    // Operative Action Bar & Pass Turn Button: ONLY active team's Operatives during guessing phase
    const operativeBar = document.getElementById('cnOperativeActionBar');
    if (operativeBar) {
      if (isMyTeamTurn && myRole === 'operative' && state.currentRole === 'operative' && state.currentClue && !state.winner) {
        operativeBar.classList.remove('hidden');
      } else {
        operativeBar.classList.add('hidden');
      }
    }

    // ALWAYS Render All 25 Cards in 5x5 Grid with High-Visibility Reveal Styling
    const gridContainer = document.getElementById('cnGrid');
    if (gridContainer) {
      gridContainer.innerHTML = '';

      if (state.grid && Array.isArray(state.grid)) {
        state.grid.forEach(card => {
          const cardEl = document.createElement('div');

          // Find secret color from state.keycard or card.type
          const keycardItem = (state.keycard && Array.isArray(state.keycard)) ? state.keycard.find(k => k.id === card.id) : null;
          const secretType = card.type || (keycardItem ? keycardItem.type : 'neutral');

          if (card.revealed) {
            cardEl.className = `cn-card revealed ${secretType}`;

            // Build High-Visibility Badge Label
            let badgeLabel = '⚪ NEUTRAL CARD';
            if (secretType === 'red') badgeLabel = '🚩 RED AGENT';
            if (secretType === 'blue') badgeLabel = '🔵 BLUE AGENT';
            if (secretType === 'assassin') badgeLabel = '☠️ ASSASSIN';

            cardEl.innerHTML = `
              <span class="card-word">${card.word || 'CARD'}</span>
              <span class="card-badge-tag">${badgeLabel}</span>
              <span class="revealed-check-icon">✓</span>
            `;
          } else if (myRole === 'spymaster' || state.winner) {
            cardEl.className = `cn-card spymaster-view ${secretType}`;
            cardEl.innerHTML = `<span class="card-word">${card.word || 'CARD'}</span>`;
          } else {
            cardEl.className = 'cn-card';
            cardEl.innerHTML = `<span class="card-word">${card.word || 'CARD'}</span>`;
          }

          // CARD TAP HANDLER FOR ALL OPERATIVES ON ACTIVE TEAM
          const canOperativeGuess = isMyTeamTurn && myRole !== 'spymaster' && state.currentRole === 'operative' && state.currentClue && !card.revealed && !state.winner;
          if (canOperativeGuess) {
            cardEl.style.cursor = 'pointer';
            cardEl.title = 'Tap to select card for your team';
          } else if (myRole === 'spymaster') {
            cardEl.style.cursor = 'not-allowed';
            cardEl.title = 'Spymasters cannot select cards';
          }

          cardEl.onclick = () => {
            if (card.revealed || state.winner) return;

            // Spymaster is strictly forbidden from guessing cards
            if (myRole === 'spymaster') {
              return;
            }

            // Must be active team's turn and guessing phase (all operatives allowed to tap!)
            if (!isMyTeamTurn || state.currentRole !== 'operative' || !state.currentClue) {
              return;
            }

            SoundFX.playCardFlip();
            socket.emit('game_action', { action: 'guess_card', cardId: card.id });
          };

          gridContainer.appendChild(cardEl);
        });
      }
    }

    // Render Game Log
    const logContainer = document.getElementById('cnLogContainer');
    if (logContainer) {
      logContainer.innerHTML = '';
      if (state.log) {
        state.log.slice().reverse().forEach(logItem => {
          const itemEl = document.createElement('div');
          itemEl.className = 'log-item';
          itemEl.innerText = logItem.text;
          logContainer.appendChild(itemEl);
        });
      }
    }

    // Render Bottom Team Roster Panel
    const redSpyEl = document.getElementById('cnRedSpymasterDisplay');
    const redOpsEl = document.getElementById('cnRedOperativesDisplay');
    const blueSpyEl = document.getElementById('cnBlueSpymasterDisplay');
    const blueOpsEl = document.getElementById('cnBlueOperativesDisplay');

    if (redSpyEl && redOpsEl && blueSpyEl && blueOpsEl) {
      const players = state.players || (ClientState.currentRoom ? ClientState.currentRoom.players : []);
      
      const redSpy = players.find(p => p.team === 'red' && p.role === 'spymaster');
      const redOps = players.filter(p => p.team === 'red' && p.role !== 'spymaster');
      const blueSpy = players.find(p => p.team === 'blue' && p.role === 'spymaster');
      const blueOps = players.filter(p => p.team === 'blue' && p.role !== 'spymaster');

      redSpyEl.innerHTML = redSpy ? `${redSpy.avatar || '😎'} ${redSpy.name}` : '<span class="text-muted" style="font-weight:400; font-size:0.8rem; color:#94a3b8;">Unassigned</span>';
      redOpsEl.innerHTML = redOps.length > 0 
        ? redOps.map(p => `<div class="roster-player-chip">${p.avatar || '😎'} ${p.name}</div>`).join('')
        : '<span class="text-muted" style="font-weight:400; font-size:0.8rem; color:#94a3b8;">No Operatives</span>';

      blueSpyEl.innerHTML = blueSpy ? `${blueSpy.avatar || '😎'} ${blueSpy.name}` : '<span class="text-muted" style="font-weight:400; font-size:0.8rem; color:#94a3b8;">Unassigned</span>';
      blueOpsEl.innerHTML = blueOps.length > 0 
        ? blueOps.map(p => `<div class="roster-player-chip">${p.avatar || '😎'} ${p.name}</div>`).join('')
        : '<span class="text-muted" style="font-weight:400; font-size:0.8rem; color:#94a3b8;">No Operatives</span>';
    }
  },

  setupListeners() {
    // Claim Spymaster Position
    const btnClaim = document.getElementById('btnClaimSpymaster');
    if (btnClaim) {
      btnClaim.onclick = () => {
        SoundFX.playClick();
        socket.emit('game_action', { action: 'claim_spymaster' });
      };
    }

    // Submit Clue
    const btnSubmit = document.getElementById('btnCNSubmitClue');
    if (btnSubmit) {
      btnSubmit.onclick = () => {
        SoundFX.playChime();
        const wordInput = document.getElementById('inputCNClueWord');
        const countInput = document.getElementById('selectCNClueCount');
        const word = wordInput ? wordInput.value.trim() : '';
        const count = countInput ? parseInt(countInput.value, 10) : 1;

        if (word) {
          socket.emit('game_action', { action: 'submit_clue', word, count });
          if (wordInput) wordInput.value = '';
        }
      };
    }

    // Pass Turn Button (Active Team Operatives ONLY)
    const btnEnd = document.getElementById('btnCNEndTurn');
    if (btnEnd) {
      btnEnd.onclick = () => {
        if (!ClientState.currentGame || ClientState.currentGame.winner) return;
        const myPlayer = ClientState.currentGame.myPlayer;
        if (!myPlayer) return;
        if (myPlayer.team !== ClientState.currentGame.currentTurn || myPlayer.role !== 'operative' || ClientState.currentGame.currentRole !== 'operative') return;

        SoundFX.playClick();
        socket.emit('game_action', { action: 'end_turn' });
      };
    }

    // Restart Game with Custom In-Game Modal (Host ONLY)
    const btnRestart = document.getElementById('btnCNRestart');
    if (btnRestart) {
      btnRestart.onclick = () => {
        if (!ClientState.isHost) return;
        SoundFX.playClick();
        if (typeof window.showCustomConfirm === 'function') {
          window.showCustomConfirm('Restart Codenames?', 'Are you sure you want to restart? 25 new cards will be dealt and scores reset.', () => {
            socket.emit('game_action', { action: 'restart_game' });
          });
        } else {
          socket.emit('game_action', { action: 'restart_game' });
        }
      };
    }

    // Leave to Lobby (Host ONLY)
    const btnLeave = document.getElementById('btnCNLeave');
    if (btnLeave) {
      btnLeave.onclick = () => {
        if (!ClientState.isHost) return;
        SoundFX.playClick();
        socket.emit('return_to_lobby');
      };
    }

    // Socket audio event listeners
    if (typeof socket !== 'undefined' && socket.on) {
      socket.on('codenames_timer_expired', (data) => {
        if (ClientState.currentGame && ClientState.currentGame.gameId === 'codenames' && ClientState.currentGame.myPlayer) {
          const myTeam = ClientState.currentGame.myPlayer.team;
          const myRole = ClientState.currentGame.myPlayer.role;
          if (myTeam === data.team && myRole === data.role) {
            SoundFX.playTimerBell();
          }
        }
      });

      socket.on('codenames_card_sound', (data) => {
        if (data.sound === 'correct') {
          SoundFX.playCorrectCard();
        } else if (data.sound === 'wrong') {
          SoundFX.playWrongCard();
        } else if (data.sound === 'assassin') {
          SoundFX.playAssassinCard();
        }
      });
    }
  }
};
