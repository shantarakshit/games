/**
 * Mafia Host Master Control Panel & God-Mode Action Ledger
 */

const MafiaHostPanel = {
  render(state) {
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
      advanceText = `🌙 Begin Night 1 (Everyone Selects) ➔`;
      advanceAction = 'host_start_round_1';
    } else if (state.phase === 'night' || state.phase.startsWith('night_')) {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone close your eyes and open your phones. Make your secret night selections now!"`;
      
      const np = state.nightProgress;
      if (hostLiveStatusEl) {
        if (np) {
          const mStatus = np.murderers.hasConsensus
            ? `<span style="color:#34d399;">🎯 Confirmed (${np.murderers.confirmedVictimName})</span>`
            : (np.murderers.submitted > 0 ? `<span style="color:#fbbf24;">⚠️ Split / In Progress (${np.murderers.submitted}/${np.murderers.total})</span>` : `<span style="color:#94a3b8;">⏳ Picking (${np.murderers.submitted}/${np.murderers.total})</span>`);

          const docStatus = !np.doctor.isAlive
            ? `<span style="color:#94a3b8;">💀 Deceased</span>`
            : (np.doctor.submitted ? `<span style="color:#34d399;">🛡️ Protected (${np.doctor.savedName})</span>` : `<span style="color:#94a3b8;">⏳ Choosing...</span>`);

          const detStatus = !np.detective.isAlive
            ? `<span style="color:#94a3b8;">💀 Deceased</span>`
            : (np.detective.submitted ? `<span style="color:#818cf8;">🔍 Investigated ${np.detective.inquiry?.suspectName || ''}</span>` : `<span style="color:#94a3b8;">⏳ Choosing...</span>`);

          const civStatus = `<span style="color:#38bdf8;">⭐ ${np.civilians.submitted}/${np.civilians.total} Selected</span>`;

          const allReady = np.allSubmitted;

          hostLiveStatusEl.innerHTML = `
            <div class="host-status-card ${allReady ? 'success' : 'info'}">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>🌙 Night Selections Progress:</strong>
                <span class="badge-pill ${allReady ? 'success-pill' : 'info-pill'}">${np.submittedCount} / ${np.totalLivingCount} Ready</span>
              </div>
              <div class="host-night-roles-status-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:6px; font-size:0.8rem;">
                <div style="background:rgba(0,0,0,0.25); padding:4px 8px; border-radius:6px;">🔪 <strong>Mafia:</strong> ${mStatus}</div>
                <div style="background:rgba(0,0,0,0.25); padding:4px 8px; border-radius:6px;">💉 <strong>Doctor:</strong> ${docStatus}</div>
                <div style="background:rgba(0,0,0,0.25); padding:4px 8px; border-radius:6px;">🔍 <strong>Detective:</strong> ${detStatus}</div>
                <div style="background:rgba(0,0,0,0.25); padding:4px 8px; border-radius:6px;">😇 <strong>Civilians:</strong> ${civStatus}</div>
              </div>
              ${allReady ? '<div style="margin-top:8px; font-weight:bold; color:#34d399; font-size:0.85rem;">✅ All living players have made their selections! Ready to wake everyone up.</div>' : ''}
            </div>
          `;
        } else {
          hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for players to complete night actions...</div>`;
        }
      }

      advanceText = (state.nightProgress && state.nightProgress.allSubmitted)
        ? `🌅 All Ready! Start Morning Narration ➔`
        : `🌅 Start Morning Narration ➔`;
      advanceAction = 'host_advance_phase';
    } else if (state.phase === 'morning_narration') {
      const ann = state.morningAnnouncement;
      if (ann && ann.wasSaved) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! The sun has risen. There was an attempted murder last night, but the Doctor arrived just in time to save them! Nobody died."`;
      } else if (ann && ann.attackedVictimName) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! Tragically, the town awakens to gruesome news: <strong>${ann.attackedVictimName}</strong> was murdered during the night!"`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone wake up! The night was quiet. Nobody was attacked."`;
      }
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🌅 <strong>Morning Narration:</strong> Tell the story aloud to the group. When ready, tap below to reveal the morning banner on players' devices.</div>`;
      advanceText = `📢 Reveal Morning Outcome on Phones ➔`;
      advanceAction = 'host_advance_phase';
    } else if (state.phase === 'day_morning') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Look at your screens. The morning outcome is confirmed. Let's begin the investigation and debate!"`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🌅 Morning results visible on all devices. Tap below to start the discussion phase.</div>`;
      advanceText = `💬 Start Town Discussion ➔`;
      advanceAction = 'host_advance_phase';
    } else if (state.phase === 'day_discussion') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Discussion is now open! Interrogate and debate who the murderers are."`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏱️ Discussion timer running. Use +30s or Skip buttons if needed.</div>`;
      advanceText = `🗳️ Open Voting Ballot Now ➔`;
      advanceAction = 'host_advance_phase';
    } else if (state.phase === 'day_voting') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Time is up! Cast your votes secretly on your phones now."`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🗳️ Votes Cast: <strong>${state.votesCastCount || 0} / ${state.livingVotersCount || 0}</strong></div>`;
      advanceText = `📊 End Voting & Narrate Results ➔`;
      advanceAction = 'host_end_voting';
    } else if (state.phase === 'vote_narration') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "${state.tallyResultText || 'The ballots have been counted. The town has made its choice...'} As dusk falls, we prepare to see if more murderers lurk among us."`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⚖️ <strong>Dusk Narration:</strong> Narrate the elimination outcome to the town. When ready, tap below to reveal the results and voting breakdown on players' phones.</div>`;
      advanceText = `📊 Reveal Results on Phones ➔`;
      advanceAction = 'host_advance_phase';
    } else if (state.phase === 'day_tally') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "${state.tallyResultText || 'Results are in.'}"`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">📊 Review voting tally with the town. When ready, proceed to next night.</div>`;
      advanceText = `🌙 Begin Round ${(state.round || 1) + 1} (Night) ➔`;
      advanceAction = 'host_advance_phase';
    }

    if (promptScriptEl) promptScriptEl.innerHTML = scriptText;

    if (btnHostAdvance) {
      const isAllReadyInNight = (state.phase === 'night' || state.phase?.startsWith('night_')) && state.nightProgress && state.nightProgress.allSubmitted;
      btnHostAdvance.className = isAllReadyInNight ? 'btn btn-primary btn-lg btn-block pulse-btn' : 'btn btn-primary btn-lg btn-block';
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
    state.hostActionLedger.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'host-ledger-card';

      // 1. Attacks text
      let attacksText = '⏳ No attacks registered';
      if (entry.nightAttacks && entry.nightAttacks.length > 0) {
        const attackDetails = entry.nightAttacks.map(a => `${a.murdererName} ➔ <strong>${a.targetName}</strong>`).join(', ');
        const consensusTag = entry.wasDecidedRandomly
          ? `<em style="color:#fbbf24;">(🎲 Randomly chosen from split: <strong>${entry.confirmedVictimName}</strong>)</em>`
          : (entry.confirmedVictimName ? `<em>(Consensus: <strong>${entry.confirmedVictimName}</strong>)</em>` : '<em style="color:#f87171;">(Split/No Target)</em>');
        attacksText = `${attackDetails} ${consensusTag}`;
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
  }
};
