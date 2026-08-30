/**
 * Mafia Master UI Coordinator
 * Integrates Host panel, Night actions, Day voting, and Timeline modules.
 */

const MafiaUI = {
  lastPhase: null,

  setupListeners() {
    const btnRestart = document.getElementById('btnMafiaRestart');
    const btnLeave = document.getElementById('btnMafiaLeave');
    const btnAdd30 = document.getElementById('btnMafiaTimerAdd30');
    const btnSkipTo1 = document.getElementById('btnMafiaTimerSkipTo1');

    if (btnRestart) {
      btnRestart.onclick = () => {
        SoundFX.playClick();
        if (typeof window.showCustomConfirm === 'function') {
          window.showCustomConfirm('Restart Mafia Match?', 'Restart match and assign fresh randomized roles to everyone?', () => {
            socket.emit('game_action', { action: 'restart_game' });
          });
        } else {
          socket.emit('game_action', { action: 'restart_game' });
        }
      };
    }

    if (btnLeave) {
      btnLeave.onclick = () => {
        SoundFX.playClick();
        if (typeof window.showCustomConfirm === 'function') {
          window.showCustomConfirm('Return to Lobby?', 'Bring everyone back to the main game room lobby?', () => {
            socket.emit('return_to_lobby');
          });
        } else {
          socket.emit('return_to_lobby');
        }
      };
    }

    if (btnAdd30) {
      btnAdd30.onclick = () => {
        SoundFX.playClick();
        socket.emit('game_action', { action: 'adjust_timer', delta: 30 });
      };
    }

    if (btnSkipTo1) {
      btnSkipTo1.onclick = () => {
        SoundFX.playClick();
        socket.emit('game_action', { action: 'adjust_timer', set: 0 });
      };
    }

    // Secret Peek Role Card (Safari & Mobile Cross-Platform Support)
    const secretCard = document.getElementById('mafiaSecretCard');
    if (secretCard) {
      const showPeek = (e) => {
        if (e && e.cancelable && e.type === 'touchstart') e.preventDefault();
        secretCard.classList.add('is-peeking');
        SoundFX.playCardFlip();
      };
      const hidePeek = () => {
        secretCard.classList.remove('is-peeking');
      };

      secretCard.addEventListener('pointerdown', showPeek);
      secretCard.addEventListener('pointerup', hidePeek);
      secretCard.addEventListener('pointerleave', hidePeek);
      secretCard.addEventListener('pointercancel', hidePeek);

      secretCard.addEventListener('touchstart', showPeek, { passive: false });
      secretCard.addEventListener('touchend', hidePeek);
      secretCard.addEventListener('touchcancel', hidePeek);

      secretCard.addEventListener('click', () => {
        if (!secretCard.classList.contains('is-peeking')) {
          secretCard.classList.toggle('is-peeking');
          SoundFX.playCardFlip();
        }
      });
    }
  },

  render(state) {
    if (!state || state.gameId !== 'mafia') return;

    // 1. Audio Cues on Phase Transitions
    if (this.lastPhase && this.lastPhase !== state.phase) {
      if (state.phase === 'night' || state.phase.startsWith('night_')) {
        SoundFX.playNightFall();
      } else if (state.phase === 'day_morning') {
        SoundFX.playMorningChime();
        if (state.morningAnnouncement && !state.morningAnnouncement.wasSaved && state.morningAnnouncement.attackedVictimId) {
          SoundFX.playGunshotStab();
        } else if (state.morningAnnouncement && state.morningAnnouncement.wasSaved) {
          SoundFX.playDoctorHeal();
        }
      } else if (state.phase === 'day_tally') {
        SoundFX.playGavel();
      } else if (state.phase === 'ended') {
        SoundFX.playVictory();
      }
    }
    this.lastPhase = state.phase;

    // 2. Header & Badges
    this.renderHeader(state);

    // 3. Secret Role Peek Card
    this.renderRoleCard(state);

    // 4. Host Master Control Panel
    MafiaHostPanel.render(state);

    // 5. Phase-Specific Views
    MafiaNightActions.render(state);
    MafiaDayVoting.renderNarrationBuffers(state);
    MafiaDayVoting.renderMorningAnnouncement(state);
    MafiaDayVoting.renderDiscussionView(state);
    MafiaDayVoting.renderVotingView(state);
    MafiaDayVoting.renderTallyView(state);
    MafiaTimeline.renderGameOverAndTimeline(state);
    MafiaTimeline.renderGameLog(state);
    MafiaTimeline.renderLivingRoster(state);
  },

  renderHeader(state) {
    const roundBadge = document.getElementById('mafiaRoundBadge');
    const phaseBadge = document.getElementById('mafiaPhaseBadge');
    const timerText = document.getElementById('mafiaTimerText');
    const timerContainer = document.getElementById('mafiaTimerContainer');

    if (roundBadge) {
      roundBadge.innerText = `Round ${state.round || 1}`;
    }

    if (phaseBadge) {
      if (state.winner) {
        phaseBadge.innerText = '🏆 GAME OVER';
        phaseBadge.className = 'phase-badge winner-badge';
      } else if (state.phase === 'role_reveal') {
        phaseBadge.innerText = '🎭 ROLE REVEAL';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'night' || state.phase.startsWith('night_')) {
        phaseBadge.innerText = '🌙 NIGHT ACTIONS';
        phaseBadge.className = 'phase-badge mafia-night-badge';
      } else if (state.phase === 'morning_narration') {
        phaseBadge.innerText = '🌅 SUNRISE NARRATION';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'day_morning') {
        phaseBadge.innerText = '🌅 MORNING REPORT';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'day_discussion') {
        phaseBadge.innerText = '💬 TOWN DISCUSSION';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'day_voting') {
        phaseBadge.innerText = '🗳️ TOWN VOTING';
        phaseBadge.className = 'phase-badge voting-badge';
      } else if (state.phase === 'vote_narration') {
        phaseBadge.innerText = '⚖️ DUSK NARRATION';
        phaseBadge.className = 'phase-badge tally-badge';
      } else if (state.phase === 'day_tally') {
        phaseBadge.innerText = '📊 RESULTS TALLY';
        phaseBadge.className = 'phase-badge tally-badge';
      }
    }

    if (timerContainer && timerText) {
      const discIsUntimed = state.settings && Number(state.settings.discussionTimer) === 0;
      let isTimed = false;
      if (state.phase === 'day_discussion') {
        isTimed = !discIsUntimed;
      } else if (state.phase === 'day_voting') {
        isTimed = !discIsUntimed && state.settings && Number(state.settings.votingTimer) > 0;
      }

      const showTimer = (state.phase === 'day_discussion' || state.phase === 'day_voting') && !state.winner;
      timerContainer.classList.toggle('hidden', !showTimer);
      if (showTimer) {
        if (isTimed) {
          const secs = state.timerSeconds !== undefined ? state.timerSeconds : 0;
          const minsStr = Math.floor(secs / 60).toString().padStart(2, '0');
          const secsStr = (secs % 60).toString().padStart(2, '0');
          timerText.innerText = `${minsStr}:${secsStr}`;
        } else {
          timerText.innerText = '∞ (No Timer)';
        }
      }
    }

    // Host Timer Quick Controls in Header
    const hostTimerControls = document.getElementById('mafiaHostTimerControls');
    if (hostTimerControls) {
      const discIsUntimed = state.settings && Number(state.settings.discussionTimer) === 0;
      let isTimed = false;
      if (state.phase === 'day_discussion') {
        isTimed = !discIsUntimed;
      } else if (state.phase === 'day_voting') {
        isTimed = !discIsUntimed && state.settings && Number(state.settings.votingTimer) > 0;
      }
      const canControl = state.isHost && (state.phase === 'day_discussion' || state.phase === 'day_voting') && !state.winner && isTimed;
      hostTimerControls.classList.toggle('hidden', !canControl);
    }

    // Header buttons (Host Only)
    const btnRestart = document.getElementById('btnMafiaRestart');
    if (btnRestart) btnRestart.classList.toggle('hidden', !state.isHost);

    const btnLeave = document.getElementById('btnMafiaLeave');
    if (btnLeave) btnLeave.classList.toggle('hidden', !state.isHost);
  },

  renderRoleCard(state) {
    const roleContainer = document.getElementById('mafiaRoleCardContainer');
    if (!roleContainer) return;

    const myRole = state.myRole || 'civilian';
    const isEliminated = state.isEliminated;

    const roleTitleEl = document.getElementById('mafiaRoleTitle');
    const roleDescEl = document.getElementById('mafiaRoleDesc');
    const roleIconEl = document.getElementById('mafiaRoleIcon');
    const roleBackEl = document.querySelector('#mafiaSecretCard .secret-card-back');
    const roleStatusBadge = document.getElementById('mafiaRoleStatusBadge');

    let title = 'Civilian';
    let icon = '😇';
    let desc = 'Sleep during the night. Awake in the morning, discuss with the town, and vote out the murderers!';
    let bgGradient = 'linear-gradient(135deg, #1e3a8a, #3b82f6)';

    if (state.isHost) {
      title = 'Host / Story Narrator 👑';
      icon = '👑';
      desc = 'You are running the game! Guide the town aloud, read narration cues, and advance the phases.';
      bgGradient = 'linear-gradient(135deg, #78350f, #d97706)';
    } else if (myRole === 'murderer') {
      title = 'Murderer 🔪';
      icon = '🔪';
      desc = 'Choose a victim each night with your fellow murderers. Blend in during the day and avoid suspicion.';
      bgGradient = 'linear-gradient(135deg, #7f1d1d, #ef4444)';
    } else if (myRole === 'doctor') {
      title = 'Doctor 💉';
      icon = '💉';
      desc = 'Protect one player each night from attack. (Rule: You cannot protect the same person two rounds in a row).';
      bgGradient = 'linear-gradient(135deg, #065f46, #10b981)';
    } else if (myRole === 'detective') {
      title = 'Detective 🔍';
      icon = '🔍';
      desc = 'Investigate one suspect each night to learn if they are a Murderer or Not.';
      bgGradient = 'linear-gradient(135deg, #4c1d95, #8b5cf6)';
    }

    if (roleTitleEl) roleTitleEl.innerText = title;
    if (roleIconEl) roleIconEl.innerText = icon;
    if (roleDescEl) roleDescEl.innerText = desc;
    if (roleBackEl) roleBackEl.style.background = bgGradient;

    if (roleStatusBadge) {
      if (isEliminated) {
        roleStatusBadge.innerHTML = `<span class="spectator-badge">💀 ELIMINATED (SPECTATING)</span>`;
      } else if (state.isHost) {
        roleStatusBadge.innerHTML = `<span class="host-pill-badge">👑 GAME NARRATOR</span>`;
      } else {
        roleStatusBadge.innerHTML = `<span class="alive-badge">💚 ALIVE & ACTIVE</span>`;
      }
    }
  }
};
