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
      advanceText = `🌙 Begin Night 1 (Murderers Turn) ➔`;
      advanceAction = 'host_start_round_1';
    } else if (state.phase === 'night_murderers') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Everyone close your eyes. Murderers, wake up and select your victim on your phones."`;
      const mData = state.murdererData;
      if (mData && mData.hasConsensus) {
        if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card success">✅ Murderers agreed on victim: <strong>${mData.confirmedVictimName}</strong></div>`;
      } else if (mData && mData.distinctTargets && mData.distinctTargets.length > 1) {
        if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">⚠️ Murderers split vote! Waiting for consensus swap...</div>`;
      } else {
        if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for murderer(s) to pick target...</div>`;
      }
      advanceText = `💉 Advance to Doctor Phase ➔`;
    } else if (state.phase === 'night_doctor') {
      if (state.isDoctorAlive === false) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Murderers sleep. Doctor, wake up and select who to protect on your phone." <em style="color:#fde68a;">(Narrate a short pause to conceal their death from the group)</em>`;
        if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">💉 Doctor is deceased (💀). Tap Next Phase ➔ when ready.</div>`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Murderers sleep. Doctor, wake up and select who to protect on your phone."`;
        const dData = state.doctorData;
        if (dData && dData.currentSavedId) {
          const isMatch = state.murdererData && state.murdererData.confirmedVictimId === dData.currentSavedId;
          if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card ${isMatch ? 'success' : 'info'}">💉 Doctor protected: <strong>${dData.currentSavedName}</strong> ${isMatch ? '⭐ (MATCHES VICTIM - WILL SURVIVE!)' : ''}</div>`;
        } else {
          if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for Doctor save...</div>`;
        }
      }
      advanceText = `🔍 Advance to Detective Phase ➔`;
    } else if (state.phase === 'night_detective') {
      if (state.isDetectiveAlive === false) {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Doctor sleep. Detective, wake up and select a suspect to investigate on your phone." <em style="color:#fde68a;">(Narrate a short pause to conceal their death from the group)</em>`;
        if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card warning">🔍 Detective is deceased (💀). Tap Next Phase ➔ when ready.</div>`;
      } else {
        scriptText = `📢 <strong>SAY ALOUD:</strong> "Doctor sleep. Detective, wake up and select a suspect to investigate on your phone."`;
        const detData = state.detectiveData;
        if (detData && detData.currentInquiry) {
          const inq = detData.currentInquiry;
          if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🔍 Detective investigated <strong>${inq.suspectName}</strong> ➔ Result: <strong>${inq.isMurderer ? '🔴 MURDERER' : '🟢 NOT MURDERER'}</strong></div>`;
        } else {
          if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏳ Waiting for Detective investigation...</div>`;
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
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🌅 Read morning story to the group, then start town discussion.</div>`;
      advanceText = `💬 Start Town Discussion ➔`;
    } else if (state.phase === 'day_discussion') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Discussion is now open! Interrogate and debate who the murderers are."`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">⏱️ Discussion timer running. Use +30s or Skip buttons if needed.</div>`;
      advanceText = `🗳️ Open Voting Ballot Now ➔`;
    } else if (state.phase === 'day_voting') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "Time is up! Cast your votes secretly on your phones now."`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">🗳️ Votes Cast: <strong>${state.votesCastCount || 0} / ${state.livingVotersCount || 0}</strong></div>`;
      advanceText = `📊 End Voting & Show Tally ➔`;
      advanceAction = 'host_end_voting';
    } else if (state.phase === 'day_tally') {
      scriptText = `📢 <strong>SAY ALOUD:</strong> "${state.tallyResultText || 'Results are in.'}"`;
      if (hostLiveStatusEl) hostLiveStatusEl.innerHTML = `<div class="host-status-card info">📊 Review voting tally with the town. When ready, proceed to next night.</div>`;
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
  }
};
