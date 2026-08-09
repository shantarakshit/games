const SpyUI = {
  lastPhase: null,

  render(state) {
    if (!state || state.gameId !== 'spy') return;

    // Timer Bell Audio on Phase Transitions
    if (this.lastPhase && this.lastPhase !== state.phase) {
      if ((this.lastPhase === 'discussion' && state.phase === 'voting') ||
          (this.lastPhase === 'voting' && state.phase === 'tally')) {
        SoundFX.playTimerBell();
      }
    }
    this.lastPhase = state.phase;

    // Timer & Phase Badge Display
    const timerText = document.getElementById('spyTimerText');
    const phaseBadge = document.getElementById('spyPhaseBadge');

    if (phaseBadge) {
      if (state.winner) {
        phaseBadge.innerText = '🏆 GAME OVER';
        phaseBadge.className = 'phase-badge winner-badge';
      } else if (state.phase === 'typing_guess') {
        phaseBadge.innerText = '⌨️ COVER TYPING';
        phaseBadge.className = 'phase-badge voting-badge';
      } else if (state.phase === 'voting') {
        phaseBadge.innerText = '🗳️ VOTING PHASE';
        phaseBadge.className = 'phase-badge voting-badge';
      } else if (state.phase === 'tally') {
        phaseBadge.innerText = '📊 RESULTS TALLY';
        phaseBadge.className = 'phase-badge tally-badge';
      } else {
        phaseBadge.innerText = '💬 DISCUSSION';
        phaseBadge.className = 'phase-badge discussion-badge';
      }
    }

    if (timerText) {
      const secs = state.timerSeconds !== undefined ? state.timerSeconds : 0;
      const minsStr = Math.floor(secs / 60).toString().padStart(2, '0');
      const secsStr = (secs % 60).toString().padStart(2, '0');
      timerText.innerText = `${minsStr}:${secsStr}`;
    }

    // Secret Role Card (My Player)
    const secretCardBack = document.querySelector('#spySecretCard .secret-card-back');
    const categoryBadge = document.getElementById('spyCategoryBadge');
    const locationTitle = document.getElementById('spyLocationTitle');
    const roleBadge = document.getElementById('spyRoleBadge');

    // Your Role Header Text
    const myRoleEl = document.getElementById('spyMyRoleText');
    if (myRoleEl && state.myPlayer) {
      if (state.isSpy) {
        myRoleEl.innerHTML = `<span class="role-team-tag spy">🕵️ THE IMPOSTOR</span>`;
      } else {
        myRoleEl.innerHTML = `<span class="role-team-tag innocent">😇 INNOCENT</span>`;
      }
    }

    if (state.myPlayer) {
      if (categoryBadge) categoryBadge.innerText = `Category: ${state.category || 'Secret'}`;
      if (roleBadge) roleBadge.classList.add('hidden');

      if (state.isSpy) {
        if (locationTitle) locationTitle.innerText = '🕵️ YOU ARE THE SPY!';
        if (secretCardBack) secretCardBack.style.background = 'linear-gradient(135deg, #7f1d1d, #991b1b)';
      } else {
        if (locationTitle) locationTitle.innerText = state.location || 'Secret Location';
        if (secretCardBack) secretCardBack.style.background = 'linear-gradient(135deg, #1e3a8a, #1d4ed8)';
      }
    }

    const typingContainer = document.getElementById('spyTypingContainer');
    const typingTimerText = document.getElementById('spyTypingTimerText');
    const imposterForm = document.getElementById('spyImposterGuessForm');
    const imposterStatus = document.getElementById('spyImposterCamouflageStatus');
    const camouflageForm = document.getElementById('spyInnocentCamouflageForm');
    const camouflageWordDisplay = document.getElementById('spyCamouflageWordDisplay');
    const camouflageStatus = document.getElementById('spyCamouflageStatus');

    if (typingContainer) {
      if (state.phase === 'typing_guess' && !state.isEliminated && !state.winner) {
        typingContainer.classList.remove('hidden');
        if (typingTimerText) typingTimerText.innerText = `${state.timerSeconds || 0}s`;

        if (state.isSpy) {
          if (imposterForm) imposterForm.classList.remove('hidden');
          if (camouflageForm) camouflageForm.classList.add('hidden');
          if (imposterStatus) imposterStatus.classList.toggle('hidden', !state.camouflageCompleted);
        } else {
          if (imposterForm) imposterForm.classList.add('hidden');
          if (camouflageForm) camouflageForm.classList.remove('hidden');
          if (camouflageWordDisplay) camouflageWordDisplay.innerText = state.camouflageWord || 'PARACHUTE';
          if (camouflageStatus) camouflageStatus.classList.toggle('hidden', !state.camouflageCompleted);
        }
      } else {
        typingContainer.classList.add('hidden');
      }
    }

    // Action Buttons: Imposter Guess Button (1 attempt per game)
    const btnGuessLocation = document.getElementById('btnSpyGuessLocation');
    if (btnGuessLocation) {
      const canGuess = state.isSpy && !state.hasGuessed && !state.isEliminated && !state.winner;
      if (canGuess) {
        btnGuessLocation.classList.remove('hidden');
      } else {
        btnGuessLocation.classList.add('hidden');
      }
    }

    // Restart & Lobby Buttons: Host ONLY
    const btnSpyRestart = document.getElementById('btnSpyRestart');
    if (btnSpyRestart) {
      btnSpyRestart.classList.toggle('hidden', !ClientState.isHost);
    }

    const btnSpyLeave = document.getElementById('btnSpyLeave');
    if (btnSpyLeave) {
      btnSpyLeave.classList.toggle('hidden', !ClientState.isHost);
    }

    // Voting Phase Grid Render
    const votingContainer = document.getElementById('spyVotingContainer');
    const votingGrid = document.getElementById('spyVotingGrid');
    const votingStatus = document.getElementById('spyVotingStatus');

    if (votingContainer) {
      if (state.phase === 'voting' && !state.isEliminated && !state.winner) {
        votingContainer.classList.remove('hidden');

        if (votingStatus) {
          votingStatus.innerText = state.hasVoted 
            ? '✔️ You have submitted your vote! Waiting for others...' 
            : 'Select a player below to cast your 1 vote:';
        }

        if (votingGrid && state.livingPlayers) {
          votingGrid.innerHTML = '';
          state.livingPlayers.forEach(p => {
            if (p.id === ClientState.myPlayerId) return; // Cannot vote for self

            const voteCard = document.createElement('div');
            voteCard.className = 'vote-card';
            voteCard.innerHTML = `
              <span class="player-avatar">${p.avatar}</span>
              <span class="player-name">${p.name}</span>
              <button class="btn ${state.hasVoted ? 'btn-secondary' : 'btn-danger'} btn-xs" ${state.hasVoted ? 'disabled' : ''}>
                ${state.hasVoted ? 'Voted' : '🗳️ Vote'}
              </button>
            `;

            if (!state.hasVoted) {
              voteCard.querySelector('button').onclick = () => {
                SoundFX.playChime();
                socket.emit('game_action', { action: 'submit_vote', targetId: p.id });
              };
            }
            votingGrid.appendChild(voteCard);
          });
        }
      } else {
        votingContainer.classList.add('hidden');
      }
    }

    // Tally Phase Results Render (10 Seconds Display)
    const tallyContainer = document.getElementById('spyTallyContainer');
    const tallyResultBanner = document.getElementById('spyTallyResultBanner');
    const tallyGrid = document.getElementById('spyTallyGrid');

    if (tallyContainer) {
      if (state.phase === 'tally') {
        tallyContainer.classList.remove('hidden');

        if (tallyResultBanner) {
          tallyResultBanner.innerText = state.tallyResultText || '';
        }

        if (tallyGrid && state.tallyData) {
          tallyGrid.innerHTML = '';
          state.tallyData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'tally-card';
            card.innerHTML = `
              <span class="player-avatar">${item.avatar}</span>
              <div class="tally-info">
                <span class="player-name">${item.name}</span>
                <span class="vote-count-badge">${item.votesReceived} vote(s)</span>
              </div>
            `;
            tallyGrid.appendChild(card);
          });
        }
      } else {
        tallyContainer.classList.add('hidden');
      }
    }

    // Render Game Log
    const logContainer = document.getElementById('spyLogContainer');
    if (logContainer && state.log) {
      logContainer.innerHTML = '';
      state.log.slice().reverse().forEach(logItem => {
        const itemEl = document.createElement('div');
        itemEl.className = 'log-item';
        itemEl.innerText = logItem.text;
        logContainer.appendChild(itemEl);
      });
    }

    // Render Bottom Party Players Roster
    const rosterListEl = document.getElementById('spyPlayersRosterList');
    if (rosterListEl) {
      const players = ClientState.room ? Array.from(ClientState.room.players.values()) : [];
      rosterListEl.innerHTML = players.map(p => `<div class="roster-player-chip">${p.avatar || '😎'} ${p.name}</div>`).join('');
    }
  },

  setupListeners() {
    // Peek Card Sound
    const secretCard = document.getElementById('spySecretCard');
    if (secretCard) {
      secretCard.addEventListener('pointerdown', () => SoundFX.playCardFlip());
    }

    // Open Spy Location Guess Modal
    const btnGuess = document.getElementById('btnSpyGuessLocation');
    if (btnGuess) {
      btnGuess.onclick = () => {
        SoundFX.playClick();
        const modal = document.getElementById('modalSpyGuess');
        if (modal) modal.classList.remove('hidden');
      };
    }

    const btnCloseGuess = document.getElementById('btnCloseSpyGuess');
    if (btnCloseGuess) {
      btnCloseGuess.onclick = () => {
        SoundFX.playClick();
        const modal = document.getElementById('modalSpyGuess');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Cover-Typing Phase Input Listeners
    const btnSubmitPhaseGuess = document.getElementById('btnSubmitSpyPhaseGuess');
    const inputPhaseGuess = document.getElementById('inputSpyPhaseGuess');
    const submitPhaseGuessAction = () => {
      SoundFX.playClick();
      const val = inputPhaseGuess ? inputPhaseGuess.value.trim() : '';
      if (val) {
        socket.emit('game_action', { action: 'spy_guess_location', location: val });
        if (inputPhaseGuess) inputPhaseGuess.value = '';
      }
    };
    if (btnSubmitPhaseGuess) btnSubmitPhaseGuess.onclick = submitPhaseGuessAction;
    if (inputPhaseGuess) {
      inputPhaseGuess.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitPhaseGuessAction(); }
      });
    }

    const btnSubmitCamouflage = document.getElementById('btnSubmitCamouflage');
    const inputCamouflage = document.getElementById('inputSpyCamouflage');
    const submitCamouflageAction = () => {
      SoundFX.playClick();
      const val = inputCamouflage ? inputCamouflage.value.trim() : '';
      if (val) {
        socket.emit('game_action', { action: 'submit_camouflage_typing', word: val });
        if (inputCamouflage) inputCamouflage.value = '';
      }
    };
    if (btnSubmitCamouflage) btnSubmitCamouflage.onclick = submitCamouflageAction;
    if (inputCamouflage) {
      inputCamouflage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitCamouflageAction(); }
      });
    }

    // Submit typed text guess
    const btnSubmitText = document.getElementById('btnSubmitSpyGuessText');
    const inputText = document.getElementById('inputSpyGuessText');
    const submitTypedGuess = () => {
      SoundFX.playClick();
      const word = inputText ? inputText.value.trim() : '';
      if (word) {
        socket.emit('game_action', { action: 'spy_guess_location', location: word });
        if (inputText) inputText.value = '';
        const modal = document.getElementById('modalSpyGuess');
        if (modal) modal.classList.add('hidden');
      }
    };

    if (btnSubmitText) {
      btnSubmitText.onclick = submitTypedGuess;
    }
    if (inputText) {
      inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTypedGuess();
        }
      });
    }

    // Restart Game with Custom In-Game Modal (Host ONLY)
    const btnRestart = document.getElementById('btnSpyRestart');
    if (btnRestart) {
      btnRestart.onclick = () => {
        if (!ClientState.isHost) return;
        SoundFX.playClick();
        if (typeof window.showCustomConfirm === 'function') {
          window.showCustomConfirm('Restart Spyfall?', 'Are you sure you want to restart the game? Roles and location will be reshuffled.', () => {
            socket.emit('game_action', { action: 'restart_game' });
          });
        } else {
          socket.emit('game_action', { action: 'restart_game' });
        }
      };
    }

    // Leave to Lobby (Host ONLY)
    const btnLeave = document.getElementById('btnSpyLeave');
    if (btnLeave) {
      btnLeave.onclick = () => {
        if (!ClientState.isHost) return;
        SoundFX.playClick();
        socket.emit('return_to_lobby');
      };
    }

    // Targeted Boo Sound Listener for players who failed cover typing
    socket.on('play_boo_sound', () => {
      SoundFX.playBooSound();
    });
  }
};
