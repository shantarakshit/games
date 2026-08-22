/**
 * Mafia Client UI Controller
 * Handles rendering for Host, Murderers, Doctor, Detective, Civilians,
 * live vote swapping, night actions, daytime voting, and end-game timeline.
 */
const MafiaUI = {
  lastPhase: null,

  render(state) {
    if (!state || state.gameId !== 'mafia') return;

    // 1. Audio Cues on Phase Transitions
    if (this.lastPhase && this.lastPhase !== state.phase) {
      if (state.phase.startsWith('night_')) {
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

    // 4. Host Master Control Panel (Host only)
    this.renderHostPanel(state);

    // 5. Phase-Specific Views
    this.renderNightActions(state);
    this.renderMorningAnnouncement(state);
    this.renderDiscussionView(state);
    this.renderVotingView(state);
    this.renderTallyView(state);
    this.renderGameOverAndTimeline(state);
    this.renderGameLog(state);
    this.renderLivingRoster(state);
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
      } else if (state.phase === 'night_murderers') {
        phaseBadge.innerText = '🌙 NIGHT: MURDERERS';
        phaseBadge.className = 'phase-badge mafia-night-badge';
      } else if (state.phase === 'night_doctor') {
        phaseBadge.innerText = '🌙 NIGHT: DOCTOR';
        phaseBadge.className = 'phase-badge mafia-night-badge';
      } else if (state.phase === 'night_detective') {
        phaseBadge.innerText = '🌙 NIGHT: DETECTIVE';
        phaseBadge.className = 'phase-badge mafia-night-badge';
      } else if (state.phase === 'day_morning') {
        phaseBadge.innerText = '🌅 MORNING STORY';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'day_discussion') {
        phaseBadge.innerText = '💬 TOWN DISCUSSION';
        phaseBadge.className = 'phase-badge discussion-badge';
      } else if (state.phase === 'day_voting') {
        phaseBadge.innerText = '🗳️ TOWN VOTING';
        phaseBadge.className = 'phase-badge voting-badge';
      } else if (state.phase === 'day_tally') {
        phaseBadge.innerText = '📊 RESULTS TALLY';
        phaseBadge.className = 'phase-badge tally-badge';
      }
    }

    if (timerContainer && timerText) {
      const showTimer = (state.phase === 'day_discussion' || state.phase === 'day_voting') && !state.winner;
      timerContainer.classList.toggle('hidden', !showTimer);
      if (showTimer) {
        const secs = state.timerSeconds !== undefined ? state.timerSeconds : 0;
        const minsStr = Math.floor(secs / 60).toString().padStart(2, '0');
        const secsStr = (secs % 60).toString().padStart(2, '0');
        timerText.innerText = `${minsStr}:${secsStr}`;
      }
    }

    // Host Timer Quick Controls in Header
    const hostTimerControls = document.getElementById('mafiaHostTimerControls');
    if (hostTimerControls) {
      const canControl = state.isHost && (state.phase === 'day_discussion' || state.phase === 'day_voting') && !state.winner;
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
  },

  renderHostPanel(state) {
    const hostPanel = document.getElementById('mafiaHostPanel');
    if (!hostPanel) return;

    if (!state.isHost || state.winner) {
      hostPanel.classList.add('hidden');
      return;
    }

    hostPanel.classList.remove('hidden');

    const promptScriptEl = document.getElementById('mafiaHostPromptScript');
    const hostLiveStatusEl = document.getElementById('mafiaHostLiveStatus');
    const btnHostAdvance = document.getElementById('btnMafiaHostAdvance');

    let scriptText = '';
    let advanceText = 'Next Phase ➔';
    let advanceAction = 'host_advance_phase';

    if (state.phase === 'role_reveal') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone look at your secret role. When ready, close your eyes. Round 1 is beginning!"`;
      advanceText = `🌙 Begin Night 1 (Murderers Turn) ➔`;
      advanceAction = 'host_start_round_1';
    } else if (state.phase === 'night_murderers') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone close your eyes. Murderers, wake up and select your victim on your phones."`;
      const mData = state.murdererData;
      if (mData && mData.hasConsensus) {
        hostLiveStatusEl.innerHTML = `<div class="host-status-card success">✅ Murderers agreed on victim: <strong>${mData.confirmedVictimName}</strong></div>`;
      } else if (mData && mData.distinctTargets.length > 1) {
        hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">⚠️ Murderers split vote! Waiting for consensus swap...</div>`;
      } else {
        hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for murderer(s) to pick target...</div>`;
      }
      advanceText = `💉 Advance to Doctor Phase ➔`;
    } else if (state.phase === 'night_doctor') {
      if (state.isDoctorAlive === false) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Murderers sleep. Doctor, wake up and select who to protect on your phone." <em style="color:#fde68a;">(Narrate a short pause to conceal their death from the group)</em>`;
        hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">💉 Doctor is deceased (💀). Tap Next Phase ➔ when ready.</div>`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Murderers sleep. Doctor, wake up and select who to protect on your phone."`;
        const dData = state.doctorData;
        if (dData && dData.currentSavedId) {
          const isMatch = state.murdererData && state.murdererData.confirmedVictimId === dData.currentSavedId;
          hostLiveStatusEl.innerHTML = `<div class="host-status-card ${isMatch ? 'success' : 'info'}">💉 Doctor protected: <strong>${dData.currentSavedName}</strong> ${isMatch ? '⭐ (MATCHES VICTIM - WILL SURVIVE!)' : ''}</div>`;
        } else {
          hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for Doctor save...</div>`;
        }
      }
      advanceText = `🔍 Advance to Detective Phase ➔`;
    } else if (state.phase === 'night_detective') {
      if (state.isDetectiveAlive === false) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Doctor sleep. Detective, wake up and select a suspect to investigate on your phone." <em style="color:#fde68a;">(Narrate a short pause to conceal their death from the group)</em>`;
        hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">🔍 Detective is deceased (💀). Tap Next Phase ➔ when ready.</div>`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Doctor sleep. Detective, wake up and select a suspect to investigate on your phone."`;
        const detData = state.detectiveData;
        if (detData && detData.currentInquiry) {
          const inq = detData.currentInquiry;
          hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🔍 Detective investigated <strong>${inq.suspectName}</strong> ➔ Result: <strong>${inq.isMurderer ? '🔴 MURDERER' : '🟢 NOT MURDERER'}</strong></div>`;
        } else {
          hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for Detective investigation...</div>`;
        }
      }
      advanceText = `🌅 Wake Everyone Up (Morning Report) ➔`;
    } else if (state.phase === 'day_morning') {
      const ann = state.morningAnnouncement;
      if (ann && ann.wasSaved) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! The sun has risen. There was an attempted murder last night, but the Doctor saved them! Nobody died."`;
      } else if (ann && ann.attackedVictimName) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! Tragically, <strong>${ann.attackedVictimName}</strong> was found murdered in the night!"`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! The night was quiet. Nobody was attacked."`;
      }
      hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🌅 Read morning story to the group, then start town discussion.</div>`;
      advanceText = `💬 Start Town Discussion (2:00) ➔`;
    } else if (state.phase === 'day_discussion') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Discussion is now open! Interrogate and debate who the murderers are."`;
      hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏱️ Discussion timer running. Use +30s or Skip buttons if needed.</div>`;
      advanceText = `🗳️ Open Voting Ballot Now ➔`;
    } else if (state.phase === 'day_voting') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Time is up! Cast your votes secretly on your phones now."`;
      hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🗳️ Votes Cast: <strong>${state.votesCastCount || 0} / ${state.livingVotersCount || 0}</strong></div>`;
      advanceText = `📊 End Voting & Show Tally ➔`;
      advanceAction = 'host_end_voting';
    } else if (state.phase === 'day_tally') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "${state.tallyResultText || 'Results are in.'}"`;
      hostLiveStatusEl.innerHTML = `<div class="host-status-card info">📊 Review voting tally with the town. When ready, proceed to next night.</div>`;
      advanceText = `🌙 Begin Round ${(state.round || 1) + 1} (Night) ➔`;
    }

    if (promptScriptEl) promptScriptEl.innerHTML = scriptText;

    if (btnHostAdvance) {
      btnHostAdvance.innerHTML = `<span>⚡</span> ${advanceText}`;
      btnHostAdvance.onclick = () => {
        SoundFX.playClick();
        socket.emit('game_action', { action: advanceAction });
      };
    }

    // Render Host God-Mode Roles Grid
    this.renderHostRolesGrid(state);

    // Render Host Secret Action Ledger
    this.renderHostActionLedger(state);
  },

  renderHostRolesGrid(state) {
    const rolesGrid = document.getElementById('mafiaHostRolesGrid');
    if (!rolesGrid || !state.allPlayers) return;

    rolesGrid.innerHTML = '';
    state.allPlayers.forEach(p => {
      const card = document.createElement('div');
      card.className = `host-player-role-card ${!p.isAlive ? 'eliminated' : ''}`;

      let roleClass = 'civilian';
      let roleLabel = p.revealedRole || 'Civilian 😇';

      if (p.isHost) {
        roleClass = 'host';
        roleLabel = '👑 Host (Narrator)';
      } else if (p.revealedRole === 'murderer') {
        roleClass = 'murderer';
        roleLabel = '🔪 Murderer';
      } else if (p.revealedRole === 'doctor') {
        roleClass = 'doctor';
        roleLabel = '💉 Doctor';
      } else if (p.revealedRole === 'detective') {
        roleClass = 'detective';
        roleLabel = '🔍 Detective';
      } else if (p.revealedRole === 'civilian') {
        roleClass = 'civilian';
        roleLabel = '😇 Civilian';
      }

      card.innerHTML = `
        <div class="host-role-card-header">
          <span class="player-avatar">${p.avatar}</span>
          <span class="player-name">${p.name}</span>
          <span class="status-indicator">${p.isAlive ? '💚' : '💀'}</span>
        </div>
        <div class="host-role-tag ${roleClass}">${roleLabel}</div>
      `;
      rolesGrid.appendChild(card);
    });
  },

  renderHostActionLedger(state) {
    const ledgerList = document.getElementById('mafiaHostActionLedgerList');
    if (!ledgerList) return;

    if (!state.hostActionLedger || state.hostActionLedger.length === 0) {
      ledgerList.innerHTML = `<div class="empty-ledger-msg" style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">No actions recorded yet. Actions will appear here round-by-round.</div>`;
      return;
    }

    ledgerList.innerHTML = '';
    // Show latest round first or chronological
    state.hostActionLedger.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'host-ledger-card';

      // 1. Attacks text
      let attacksText = '⏳ No attacks registered';
      if (entry.nightAttacks && entry.nightAttacks.length > 0) {
        const attackDetails = entry.nightAttacks.map(a => `${a.murdererName} ➔ <strong>${a.targetName}</strong>`).join(', ');
        attacksText = `${attackDetails} ${entry.confirmedVictimName ? `<em>(Consensus: ${entry.confirmedVictimName})</em>` : '<em style="color:#f87171;">(Split/No Consensus)</em>'}`;
      }

      // 2. Doctor Save
      let doctorText = '⏳ None / Deceased';
      if (entry.doctorSave) {
        doctorText = `${entry.doctorSave.doctorName} protected <strong>${entry.doctorSave.savedName}</strong>`;
      }

      // 3. Detective Inquiry
      let detText = '⏳ None / Deceased';
      if (entry.detectiveInquiry) {
        detText = `${entry.detectiveInquiry.detectiveName} investigated <strong>${entry.detectiveInquiry.suspectName}</strong> ➔ ${entry.detectiveInquiry.isMurderer ? '<span style="color:#f87171; font-weight:bold;">🔴 MURDERER</span>' : '<span style="color:#34d399; font-weight:bold;">🟢 NOT MURDERER</span>'}`;
      }

      // 4. Morning Outcome
      let morningText = '⏳ In progress...';
      if (entry.morningOutcome) {
        if (entry.morningOutcome.wasSaved) {
          morningText = `⭐ Attack on <strong>${entry.morningOutcome.attackedVictimName}</strong> was <span style="color:#34d399; font-weight:bold;">SAVED by Doctor</span> (No deaths)`;
        } else if (entry.morningOutcome.attackedVictimName) {
          morningText = `💀 <strong>${entry.morningOutcome.attackedVictimName}</strong> was murdered`;
        } else {
          morningText = `🕊️ Peaceful night (No attacks)`;
        }
      }

      // 5. Day Votes Breakdown
      let dayVotesHtml = '';
      if (entry.dayVotes && entry.dayVotes.length > 0) {
        const votesStr = entry.dayVotes.map(v => `${v.voterName} ➔ <strong>${v.targetName}</strong>`).join(' | ');
        dayVotesHtml = `
          <div class="ledger-row">
            <span class="ledger-label">🗳️ Day Votes:</span>
            <span class="ledger-val">${votesStr}</span>
          </div>
        `;
      }

      // 6. Elimination
      let elimHtml = '';
      if (entry.eliminated) {
        elimHtml = `
          <div class="ledger-row">
            <span class="ledger-label">⚖️ Eliminated:</span>
            <span class="ledger-val" style="color:#fca5a5; font-weight:bold;">${entry.eliminated.name} (${entry.eliminated.role.toUpperCase()})</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="host-ledger-card-header">
          <span>🌙 Round ${entry.round} Secret History</span>
        </div>
        <div class="host-ledger-card-body">
          <div class="ledger-row">
            <span class="ledger-label">🔪 Murderers:</span>
            <span class="ledger-val">${attacksText}</span>
          </div>
          <div class="ledger-row">
            <span class="ledger-label">💉 Doctor:</span>
            <span class="ledger-val">${doctorText}</span>
          </div>
          <div class="ledger-row">
            <span class="ledger-label">🔍 Detective:</span>
            <span class="ledger-val">${detText}</span>
          </div>
          <div class="ledger-row">
            <span class="ledger-label">🌅 Morning:</span>
            <span class="ledger-val">${morningText}</span>
          </div>
          ${dayVotesHtml}
          ${elimHtml}
        </div>
      `;
      ledgerList.appendChild(card);
    });
  },

  renderNightActions(state) {
    const nightContainer = document.getElementById('mafiaNightContainer');
    if (!nightContainer) return;

    const isNightPhase = state.phase.startsWith('night_') && !state.winner;
    nightContainer.classList.toggle('hidden', !isNightPhase);
    if (!isNightPhase) return;

    const nightTitleEl = document.getElementById('mafiaNightTitle');
    const nightSubtitleEl = document.getElementById('mafiaNightSubtitle');
    const nightActionContent = document.getElementById('mafiaNightActionContent');

    const myRole = state.myRole;
    const isEliminated = state.isEliminated;

    if (nightActionContent) nightActionContent.innerHTML = '';

    // If Spectator / Dead
    if (isEliminated) {
      if (nightTitleEl) nightTitleEl.innerText = '🌙 Night Phase';
      if (nightSubtitleEl) nightSubtitleEl.innerText = 'You are spectating the night actions...';
      if (nightActionContent) {
        nightActionContent.innerHTML = `<div class="spectator-waiting-msg">👻 You are deceased. Watch the mystery unfold!</div>`;
      }
      return;
    }

    // 1. MURDERER NIGHT INTERFACE
    if (state.phase === 'night_murderers') {
      if (myRole === 'murderer') {
        if (nightTitleEl) nightTitleEl.innerText = '🔪 Choose a Victim';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'Tap a player to target. If split, swap to match votes!';

        const mData = state.murdererData;
        const livingTargets = state.livingPlayers.filter(p => !state.allPlayers.find(ap => ap.id === p.id && ap.revealedRole === 'murderer'));

        let swapCardsHTML = '';
        if (mData && mData.livingMurderersCount > 1) {
          swapCardsHTML = `
            <div class="murderer-swap-panel">
              <h4>👥 Murderer Team Alignment:</h4>
              <div class="murderer-votes-list">
                ${mData.votesList.map(v => `
                  <div class="murderer-vote-tag">
                    <span>${v.murdererAvatar} ${v.murdererName}:</span>
                    <strong>${v.targetName || 'Picking...'}</strong>
                  </div>
                `).join('')}
              </div>
              ${mData.distinctTargets.length > 1 ? `
                <div class="swap-targets-grid">
                  <span class="swap-prompt">⚠️ Split Vote! Tap to swap to partner's target:</span>
                  ${mData.distinctTargets.map(dt => `
                    <button class="btn btn-danger btn-sm btn-swap-target" data-target-id="${dt.targetId}">
                      🎯 Swap to ${dt.targetName} (${dt.voters.join(', ')})
                    </button>
                  `).join('')}
                </div>
              ` : ''}
              ${mData.hasConsensus ? `<div class="consensus-badge success">🎯 Target Confirmed: <strong>${mData.confirmedVictimName}</strong></div>` : ''}
            </div>
          `;
        }

        const gridHTML = `
          ${swapCardsHTML}
          <div class="targets-grid">
            ${livingTargets.map(p => {
              const isSelected = mData && mData.myVote === p.id;
              return `
                <button class="target-card ${isSelected ? 'selected' : ''}" data-target-id="${p.id}">
                  <span class="target-avatar">${p.avatar}</span>
                  <span class="target-name">${p.name}</span>
                  ${isSelected ? '<span class="selected-check">🎯 Your Target</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        `;

        if (nightActionContent) {
          nightActionContent.innerHTML = gridHTML;

          nightActionContent.querySelectorAll('.target-card').forEach(btn => {
            btn.onclick = () => {
              const targetId = btn.dataset.targetId;
              socket.emit('game_action', { action: 'murderer_vote', targetId });
            };
          });

          nightActionContent.querySelectorAll('.btn-swap-target').forEach(btn => {
            btn.onclick = () => {
              const targetId = btn.dataset.targetId;
              socket.emit('game_action', { action: 'murderer_swap_target', targetId });
            };
          });
        }
      } else if (!state.isHost) {
        // Sleep screen for non-murderers
        if (nightTitleEl) nightTitleEl.innerText = '🌙 Night has Fallen';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'Close your eyes in the physical room...';
        if (nightActionContent) {
          nightActionContent.innerHTML = `
            <div class="sleep-screen-container">
              <span class="sleep-moon">🌙</span>
              <p>The murderers are stalking the town...</p>
              <div class="fog-animation"></div>
            </div>
          `;
        }
      }
    }

    // 2. DOCTOR NIGHT INTERFACE
    else if (state.phase === 'night_doctor') {
      if (myRole === 'doctor') {
        if (nightTitleEl) nightTitleEl.innerText = '💉 Choose Someone to Protect';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'You may protect yourself, but cannot protect the same player twice in a row (1 save per round).';

        const dData = state.doctorData;
        const prevSavedId = dData ? dData.previousSavedId : null;
        const currentSavedId = dData ? dData.currentSavedId : null;
        const hasSavedThisRound = !!currentSavedId;

        const gridHTML = `
          <div class="targets-grid">
            ${state.livingPlayers.map(p => {
              const isPrev = p.id === prevSavedId;
              const isSelected = p.id === currentSavedId;
              const isDisabled = isPrev || (hasSavedThisRound && !isSelected);
              return `
                <button class="target-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                        data-target-id="${p.id}" ${isDisabled ? 'disabled' : ''}>
                  <span class="target-avatar">${p.avatar}</span>
                  <span class="target-name">${p.name} ${p.isMe ? '(You)' : ''}</span>
                  ${isPrev ? '<span class="disabled-tag">Protected Last Round</span>' : ''}
                  ${isSelected ? '<span class="selected-check">🛡️ Protected</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        `;

        if (nightActionContent) {
          nightActionContent.innerHTML = gridHTML;
          nightActionContent.querySelectorAll('.target-card:not([disabled])').forEach(btn => {
            btn.onclick = () => {
              const targetId = btn.dataset.targetId;
              socket.emit('game_action', { action: 'doctor_save', targetId });
            };
          });
        }
      } else if (!state.isHost) {
        if (nightTitleEl) nightTitleEl.innerText = '🌙 Night has Fallen';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'Close your eyes in the physical room...';
        if (nightActionContent) {
          nightActionContent.innerHTML = `
            <div class="sleep-screen-container">
              <span class="sleep-moon">🌙</span>
              <p>The Doctor is attending to their patient...</p>
            </div>
          `;
        }
      }
    }

    // 3. DETECTIVE NIGHT INTERFACE
    else if (state.phase === 'night_detective') {
      if (myRole === 'detective') {
        if (nightTitleEl) nightTitleEl.innerText = '🔍 Investigate a Suspect';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'Tap a living suspect you haven\'t inspected yet (1 investigation per round).';

        const detData = state.detectiveData;
        const currentInq = detData ? detData.currentInquiry : null;
        const pastInvestigatedIds = (detData && detData.history ? detData.history.map(h => h.suspectId) : []);
        const hasInquiredThisRound = !!currentInq;

        let inquiryResultHTML = '';
        if (currentInq) {
          inquiryResultHTML = `
            <div class="detective-result-card ${currentInq.isMurderer ? 'is-murderer' : 'is-innocent'}">
              <span class="result-icon">${currentInq.isMurderer ? '🔪' : '😇'}</span>
              <div class="result-info">
                <h3>${currentInq.suspectName}</h3>
                <strong class="result-tag">${currentInq.isMurderer ? '🔴 IS A MURDERER!' : '🟢 IS NOT A MURDERER'}</strong>
              </div>
            </div>
          `;
        }

        const livingSuspects = state.livingPlayers.filter(p => !p.isMe);

        const gridHTML = `
          ${inquiryResultHTML}
          <div class="targets-grid">
            ${livingSuspects.map(p => {
              const isCurrentInq = currentInq && currentInq.suspectId === p.id;
              const isPastInq = pastInvestigatedIds.includes(p.id) && !isCurrentInq;
              const isDisabled = hasInquiredThisRound || isPastInq;
              return `
                <button class="target-card ${isCurrentInq ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                        data-target-id="${p.id}" ${isDisabled ? 'disabled' : ''}>
                  <span class="target-avatar">${p.avatar}</span>
                  <span class="target-name">${p.name}</span>
                  ${isPastInq ? '<span class="disabled-tag">Already Investigated</span>' : ''}
                  ${isCurrentInq ? '<span class="selected-check">🔍 Investigated</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        `;

        if (nightActionContent) {
          nightActionContent.innerHTML = gridHTML;
          nightActionContent.querySelectorAll('.target-card:not([disabled])').forEach(btn => {
            btn.onclick = () => {
              const targetId = btn.dataset.targetId;
              socket.emit('game_action', { action: 'detective_investigate', targetId });
            };
          });
        }
      } else if (!state.isHost) {
        if (nightTitleEl) nightTitleEl.innerText = '🌙 Night has Fallen';
        if (nightSubtitleEl) nightSubtitleEl.innerText = 'Close your eyes in the physical room...';
        if (nightActionContent) {
          nightActionContent.innerHTML = `
            <div class="sleep-screen-container">
              <span class="sleep-moon">🌙</span>
              <p>The Detective is searching for clues...</p>
            </div>
          `;
        }
      }
    }
  },

  renderMorningAnnouncement(state) {
    const morningPanel = document.getElementById('mafiaMorningPanel');
    if (!morningPanel) return;

    const isMorning = state.phase === 'day_morning' && !state.winner;
    morningPanel.classList.toggle('hidden', !isMorning);
    if (!isMorning) return;

    const morningBanner = document.getElementById('mafiaMorningBanner');
    const ann = state.morningAnnouncement;

    if (morningBanner) {
      if (ann && ann.wasSaved) {
        morningBanner.className = 'morning-banner saved';
        morningBanner.innerHTML = `
          <span class="banner-icon">🌅</span>
          <h2>A Miracle at Sunrise!</h2>
          <p>An attack occurred during the night, but the <strong>Doctor arrived in time to save them!</strong></p>
          <strong class="outcome-badge">💚 NOBODY DIED TONIGHT</strong>
        `;
      } else if (ann && ann.attackedVictimName) {
        morningBanner.className = 'morning-banner murdered';
        morningBanner.innerHTML = `
          <span class="banner-icon">💀</span>
          <h2>Tragedy Strikes!</h2>
          <p>The town awakens to gruesome news...</p>
          <h1 class="victim-highlight">${ann.attackedVictimName} was Murdered!</h1>
          <strong class="outcome-badge">🖤 ELIMINATED FROM THE TOWN</strong>
        `;
      } else {
        morningBanner.className = 'morning-banner quiet';
        morningBanner.innerHTML = `
          <span class="banner-icon">☀️</span>
          <h2>A Peaceful Night</h2>
          <p>The town awakens safely with no casualties.</p>
        `;
      }
    }
  },

  renderDiscussionView(state) {
    const discPanel = document.getElementById('mafiaDiscussionPanel');
    if (!discPanel) return;

    const isDiscussion = state.phase === 'day_discussion' && !state.winner;
    discPanel.classList.toggle('hidden', !isDiscussion);
    if (!isDiscussion) return;

    // Detective Notebook / History Summary
    const notebookEl = document.getElementById('mafiaDetectiveNotebook');
    if (notebookEl) {
      const isDet = state.myRole === 'detective';
      const history = state.detectiveData ? state.detectiveData.history : [];
      if (isDet && history && history.length > 0) {
        notebookEl.classList.remove('hidden');
        notebookEl.innerHTML = `
          <h4>🔍 Detective's Investigation Ledger:</h4>
          <div class="detective-history-list">
            ${history.map(h => `
              <div class="detective-history-item ${h.isMurderer ? 'murderer' : 'innocent'}">
                <span>Round ${h.round}: <strong>${h.suspectName}</strong></span>
                <strong>${h.isMurderer ? '🔴 MURDERER' : '🟢 NOT MURDERER'}</strong>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        notebookEl.classList.add('hidden');
      }
    }
  },

  renderVotingView(state) {
    const votingPanel = document.getElementById('mafiaVotingPanel');
    if (!votingPanel) return;

    const isVoting = state.phase === 'day_voting' && !state.winner;
    votingPanel.classList.toggle('hidden', !isVoting);
    if (!isVoting) return;

    const votingStatusEl = document.getElementById('mafiaVotingStatus');
    const votingGridEl = document.getElementById('mafiaVotingGrid');

    const liveTally = state.liveVotingTally || { counts: {}, abstainCount: 0 };
    const liveCounts = liveTally.counts || {};
    const abstainCount = liveTally.abstainCount || 0;

    if (state.isHost) {
      if (votingStatusEl) {
        votingStatusEl.innerHTML = `<span class="host-pill-badge">👑 Host Master View</span> Living players voting: <strong>${state.votesCastCount || 0} / ${state.livingVotersCount || 0}</strong>`;
      }
      if (votingGridEl) {
        votingGridEl.innerHTML = `
          <div class="host-live-voting-summary">
            <h4 style="color:#c7d2fe; margin-bottom:10px; font-size:0.9rem;">📊 Live Anonymous Voting Tally:</h4>
            <div class="live-tally-cards-grid">
              ${state.livingPlayers.map(p => {
                const count = liveCounts[p.id] || 0;
                return `
                  <div class="live-tally-chip ${count > 0 ? 'active' : ''}">
                    <span>${p.avatar} ${p.name}:</span>
                    <strong>${count} ${count === 1 ? 'vote' : 'votes'}</strong>
                  </div>
                `;
              }).join('')}
              <div class="live-tally-chip ${abstainCount > 0 ? 'active' : ''}">
                <span>⚪ Abstain / Skip:</span>
                <strong>${abstainCount} ${abstainCount === 1 ? 'vote' : 'votes'}</strong>
              </div>
            </div>
          </div>
        `;
      }
      return;
    }

    if (state.isEliminated) {
      if (votingStatusEl) {
        votingStatusEl.innerHTML = `<span class="spectator-badge">👁️ SPECTATING</span> Live Voting in Progress: <strong>${state.votesCastCount || 0} / ${state.livingVotersCount || 0}</strong> votes cast`;
      }
      if (votingGridEl) {
        votingGridEl.innerHTML = `
          <div class="spectator-live-voting-summary">
            <h4 style="color:#c7d2fe; margin-bottom:10px; font-size:0.9rem;">📊 Live Anonymous Ballot Tally:</h4>
            <div class="live-tally-cards-grid">
              ${state.livingPlayers.map(p => {
                const count = liveCounts[p.id] || 0;
                return `
                  <div class="live-tally-chip ${count > 0 ? 'active' : ''}">
                    <span>${p.avatar} ${p.name}:</span>
                    <strong>${count} ${count === 1 ? 'vote' : 'votes'}</strong>
                  </div>
                `;
              }).join('')}
              <div class="live-tally-chip ${abstainCount > 0 ? 'active' : ''}">
                <span>⚪ Abstain:</span>
                <strong>${abstainCount} ${abstainCount === 1 ? 'vote' : 'votes'}</strong>
              </div>
            </div>
          </div>
        `;
      }
      return;
    }

    if (votingStatusEl) {
      votingStatusEl.innerHTML = `
        <div class="live-voting-prompt-row">
          <span>${state.hasVotedDay ? '✔️ <strong>Ballot Cast!</strong> (Tap below anytime to change vote):' : '🗳️ <strong>Secret Ballot:</strong> Tap a suspect to vote for elimination:'}</span>
          <span class="live-votes-counter-pill">📊 ${state.votesCastCount || 0} / ${state.livingVotersCount || 0} Voted</span>
        </div>
      `;
    }

    if (votingGridEl) {
      votingGridEl.innerHTML = '';

      // Candidates: A voter cannot vote for themselves
      const candidateList = (state.isHost || state.isEliminated)
        ? state.livingPlayers
        : state.livingPlayers.filter(p => !p.isMe);

      candidateList.forEach(p => {
        const isMyVote = state.myDayVote === p.id;
        const candidateVoteCount = liveCounts[p.id] || 0;
        const card = document.createElement('div');
        card.className = `voting-card ${isMyVote ? 'my-vote' : ''}`;
        card.innerHTML = `
          <span class="voting-avatar">${p.avatar}</span>
          <div class="voting-name">${p.name} ${p.isMe ? '(You)' : ''}</div>
          <div class="live-vote-pill ${candidateVoteCount > 0 ? 'has-votes' : ''}">
            🗳️ ${candidateVoteCount} ${candidateVoteCount === 1 ? 'vote' : 'votes'}
          </div>
          ${isMyVote ? '<span class="voted-tag">✔️ Your Vote</span>' : ''}
        `;
        if (!state.isHost && !state.isEliminated) {
          card.onclick = () => {
            SoundFX.playClick();
            socket.emit('game_action', { action: 'submit_day_vote', targetId: p.id });
          };
        }
        votingGridEl.appendChild(card);
      });

      // Abstain / Skip Option (Only for active voters)
      if (!state.isHost && !state.isEliminated) {
        const isMyAbstain = state.myDayVote === 'ABSTAIN';
        const abstainCard = document.createElement('div');
        abstainCard.className = `voting-card abstain-card ${isMyAbstain ? 'my-vote' : ''}`;
        abstainCard.innerHTML = `
          <span class="voting-avatar">⚪</span>
          <div class="voting-name">Abstain / Skip Vote</div>
          <div class="live-vote-pill ${abstainCount > 0 ? 'has-votes' : ''}">
            🗳️ ${abstainCount} ${abstainCount === 1 ? 'vote' : 'votes'}
          </div>
          ${isMyAbstain ? '<span class="voted-tag">✔️ Your Vote</span>' : ''}
        `;
        abstainCard.onclick = () => {
          SoundFX.playClick();
          socket.emit('game_action', { action: 'submit_day_vote', targetId: 'ABSTAIN' });
        };
        votingGridEl.appendChild(abstainCard);
      }
    }
  },

  renderTallyView(state) {
    const tallyPanel = document.getElementById('mafiaTallyPanel');
    if (!tallyPanel) return;

    const isTally = state.phase === 'day_tally' && !state.winner;
    tallyPanel.classList.toggle('hidden', !isTally);
    if (!isTally) return;

    const bannerEl = document.getElementById('mafiaTallyBanner');
    const gridEl = document.getElementById('mafiaTallyGrid');

    if (bannerEl) bannerEl.innerHTML = `<h3>${state.tallyResultText || 'Voting Results'}</h3>`;

    if (gridEl && state.tallyData) {
      gridEl.innerHTML = '';
      state.tallyData.forEach(item => {
        const row = document.createElement('div');
        row.className = `tally-bar-card ${item.isEliminated ? 'eliminated' : ''}`;
        row.innerHTML = `
          <span class="tally-avatar">${item.avatar}</span>
          <div class="tally-info">
            <span class="tally-name">${item.name}</span>
            <span class="tally-votes-pill">${item.votesReceived} Vote${item.votesReceived === 1 ? '' : 's'}</span>
          </div>
          ${item.isEliminated ? '<span class="eliminated-stamp">ELIMINATED</span>' : ''}
        `;
        gridEl.appendChild(row);
      });
    }
  },

  renderGameOverAndTimeline(state) {
    const endContainer = document.getElementById('mafiaEndGameContainer');
    if (!endContainer) return;

    const isEnded = state.winner || state.phase === 'ended';
    endContainer.classList.toggle('hidden', !isEnded);
    if (!isEnded) return;

    const bannerEl = document.getElementById('mafiaWinnerBanner');
    const rolesGridEl = document.getElementById('mafiaRevealedRolesGrid');
    const timelineListEl = document.getElementById('mafiaTimelineList');

    if (bannerEl) {
      if (state.winner === 'civilians') {
        bannerEl.className = 'winner-banner civilians-win';
        bannerEl.innerHTML = `
          <span class="winner-trophy">🏆</span>
          <h1>CIVILIANS WIN!</h1>
          <p>The town has successfully brought all murderers to justice!</p>
        `;
      } else {
        bannerEl.className = 'winner-banner mafia-wins';
        bannerEl.innerHTML = `
          <span class="winner-trophy">🔪</span>
          <h1>MAFIA WINS!</h1>
          <p>The murderers have equaled or outnumbered the town!</p>
        `;
      }
    }

    // Render Full Revealed Roles Grid
    if (rolesGridEl && state.allPlayers) {
      rolesGridEl.innerHTML = '';
      state.allPlayers.forEach(p => {
        const card = document.createElement('div');
        const roleStr = String(p.revealedRole || 'civilian').toLowerCase();
        let roleTagClass = 'civilian';
        let roleDisplayName = 'Civilian 😇';

        if (p.isHost) {
          roleTagClass = 'host';
          roleDisplayName = 'Host 👑';
        } else if (roleStr.includes('murderer')) {
          roleTagClass = 'murderer';
          roleDisplayName = 'Murderer 🔪';
        } else if (roleStr.includes('doctor')) {
          roleTagClass = 'doctor';
          roleDisplayName = 'Doctor 💉';
        } else if (roleStr.includes('detective')) {
          roleTagClass = 'detective';
          roleDisplayName = 'Detective 🔍';
        }

        card.className = `role-reveal-card ${roleTagClass} ${!p.isAlive ? 'dead' : ''}`;
        card.innerHTML = `
          <span class="player-avatar">${p.avatar}</span>
          <div class="player-info">
            <span class="player-name">${p.name} ${!p.isAlive ? '💀' : ''}</span>
            <span class="role-tag ${roleTagClass}">${roleDisplayName}</span>
          </div>
        `;
        rolesGridEl.appendChild(card);
      });
    }

    // Render Full Match Timeline Ledger
    if (timelineListEl && state.timeline) {
      timelineListEl.innerHTML = '';
      state.timeline.forEach(t => {
        const item = document.createElement('div');
        item.className = 'timeline-round-card';
        
        let nightHTML = '<em>No night data</em>';
        if (t.night) {
          nightHTML = `
            <div class="timeline-subgroup">
              <strong>🌙 Night ${t.round}:</strong>
              <ul>
                <li>🔪 Murderers targeted: <strong>${t.night.murdererTargetName}</strong></li>
                <li>💉 Doctor protected: <strong>${t.night.doctorSavedName}</strong></li>
                ${t.night.detectiveInquiry ? `<li>🔍 Detective investigated: <strong>${t.night.detectiveInquiry.suspectName}</strong> ➔ ${t.night.detectiveInquiry.isMurderer ? '🔴 Murderer' : '🟢 Not Murderer'}</li>` : ''}
                <li>🌅 Morning Outcome: ${t.night.wasSaved ? '💚 Saved by Doctor (0 deaths)' : `💀 ${t.night.morningVictimName} was murdered`}</li>
              </ul>
            </div>
          `;
        }

        let dayHTML = '<em>No voting data</em>';
        if (t.day) {
          dayHTML = `
            <div class="timeline-subgroup">
              <strong>🗳️ Day ${t.round} Vote:</strong>
              <ul>
                <li>Majority needed: ${t.day.majorityThreshold} votes</li>
                <li>Elimination: ${t.day.eliminatedName ? `⚖️ <strong>${t.day.eliminatedName}</strong> (${t.day.eliminatedRole || 'Role Revealed'})` : 'No majority reached (0 eliminated)'}</li>
              </ul>
            </div>
          `;
        }

        item.innerHTML = `
          <div class="timeline-round-header">Round ${t.round} Summary</div>
          <div class="timeline-round-body">
            ${nightHTML}
            ${dayHTML}
          </div>
        `;
        timelineListEl.appendChild(item);
      });
    }
  },

  renderGameLog(state) {
    const logContainer = document.getElementById('mafiaLogContainer');
    if (!logContainer || !state.log) return;

    logContainer.innerHTML = '';
    state.log.slice(-15).forEach(entry => {
      const div = document.createElement('div');
      div.className = `log-entry log-${entry.type || 'system'}`;
      div.innerHTML = `<span class="log-text">${entry.text}</span>`;
      logContainer.appendChild(div);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  },

  renderLivingRoster(state) {
    const rosterList = document.getElementById('mafiaPlayersRosterList');
    if (!rosterList || !state.allPlayers) return;

    rosterList.innerHTML = '';
    state.allPlayers.forEach(p => {
      const tag = document.createElement('div');
      tag.className = `party-player-pill ${!p.isAlive ? 'eliminated' : ''} ${p.isHost ? 'host' : ''}`;
      tag.innerHTML = `${p.avatar} ${p.name} ${!p.isAlive ? '💀' : (p.isHost ? '👑' : '')}`;
      rosterList.appendChild(tag);
    });
  }
};

// Wire button event listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnRestart = document.getElementById('btnMafiaRestart');
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

  const btnLeave = document.getElementById('btnMafiaLeave');
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

  const btnAdd30 = document.getElementById('btnMafiaTimerAdd30');
  if (btnAdd30) {
    btnAdd30.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'adjust_timer', delta: 30 });
    };
  }

  const btnSkipTo1 = document.getElementById('btnMafiaTimerSkipTo1');
  if (btnSkipTo1) {
    btnSkipTo1.onclick = () => {
      SoundFX.playClick();
      socket.emit('game_action', { action: 'adjust_timer', set: 1 });
    };
  }
});
