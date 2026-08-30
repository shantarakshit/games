/**
 * Mafia Night Actions UI Controller (Unified Night: Murderers, Doctor, Detective, Civilians, Spectators)
 */

const MafiaNightActions = {
  render(state) {
    const nightContainer = document.getElementById('mafiaNightContainer');
    if (!nightContainer) return;

    const isNightPhase = state.phase && (state.phase === 'night' || state.phase.startsWith('night_')) && !state.winner;
    nightContainer.classList.toggle('hidden', !isNightPhase || state.isHost);
    if (!isNightPhase || state.isHost) return;

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
        nightActionContent.innerHTML = `<div class="spectator-waiting-msg">👻 You are deceased. Night actions are underway!</div>`;
      }
      return;
    }

    // 1. MURDERER NIGHT INTERFACE
    if (myRole === 'murderer') {
      if (nightTitleEl) nightTitleEl.innerText = '🔪 Choose a Victim';
      if (nightSubtitleEl) nightSubtitleEl.innerText = 'Tap a player to target. If split, swap to match your partner\'s vote!';

      const mData = state.murdererData;
      const livingTargets = state.livingPlayers.filter(p => !p.isMe && p.id !== state.hostSocketId && !state.allPlayers.find(ap => ap.id === p.id && ap.revealedRole === 'murderer'));

      let swapCardsHTML = '';
      if (mData && mData.livingMurderersCount > 1) {
        swapCardsHTML = `
          <div class="murderer-swap-panel">
            <h4>👥 Murderer Team Alignment:</h4>
            <div class="murderer-votes-list">
              ${mData.votesList.map(v => `
                <div class="murderer-vote-tag">
                  <span>${v.murdererAvatar} ${v.murdererName}:</span>
                  <strong>${v.targetName ? `🎯 ${v.targetName}` : 'Picking...'}</strong>
                </div>
              `).join('')}
            </div>
            ${mData.distinctTargets && mData.distinctTargets.length > 1 ? `
              <div class="swap-targets-grid">
                <span class="swap-prompt">⚠️ Split Vote! Tap to align with your partner:</span>
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
            SoundFX.playClick();
            socket.emit('game_action', { action: 'murderer_vote', targetId });
          };
        });

        nightActionContent.querySelectorAll('.btn-swap-target').forEach(btn => {
          btn.onclick = () => {
            const targetId = btn.dataset.targetId;
            SoundFX.playClick();
            socket.emit('game_action', { action: 'murderer_swap_target', targetId });
          };
        });
      }
    }

    // 2. DOCTOR NIGHT INTERFACE
    else if (myRole === 'doctor') {
      if (nightTitleEl) nightTitleEl.innerText = '💉 Choose Someone to Protect';
      if (nightSubtitleEl) nightSubtitleEl.innerText = 'Tap a player or yourself to protect (cannot protect the host or the same player twice in a row).';

      const dData = state.doctorData;
      const prevSavedId = dData ? dData.previousSavedId : null;
      const currentSavedId = dData ? dData.currentSavedId : null;
      const hasSavedThisRound = Boolean(currentSavedId);
      const doctorTargets = state.livingPlayers.filter(p => p.id !== state.hostSocketId);

      const gridHTML = `
        <div class="targets-grid">
          ${doctorTargets.map(p => {
            const isPrev = p.id === prevSavedId;
            const isSelected = p.id === currentSavedId;
            const isDisabled = isPrev;
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
            SoundFX.playClick();
            socket.emit('game_action', { action: 'doctor_save', targetId });
          };
        });
      }
    }

    // 3. DETECTIVE NIGHT INTERFACE
    else if (myRole === 'detective') {
      if (nightTitleEl) nightTitleEl.innerText = '🔍 Investigate a Suspect';
      if (nightSubtitleEl) nightSubtitleEl.innerText = 'Tap a living suspect you haven\'t inspected yet (cannot investigate yourself or the host).';

      const detData = state.detectiveData;
      const currentInq = detData ? detData.currentInquiry : null;
      const pastInvestigatedIds = (detData && detData.history ? detData.history.map(h => h.suspectId) : []);
      const hasInquiredThisRound = Boolean(currentInq);

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

      const livingSuspects = state.livingPlayers.filter(p => !p.isMe && p.id !== state.hostSocketId);

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
            SoundFX.playClick();
            socket.emit('game_action', { action: 'detective_investigate', targetId });
          };
        });
      }
    }

    // 4. CIVILIAN NIGHT INTERFACE (Pick Favorite Alive Player)
    else if (myRole === 'civilian') {
      if (nightTitleEl) nightTitleEl.innerText = '⭐ Pick Your Favorite Player';
      if (nightSubtitleEl) nightSubtitleEl.innerText = 'Choose your favorite alive player (cannot pick yourself or the host) to stay active during the night! (Tap anytime to change).';

      const cData = state.civilianData;
      const myFavoriteId = cData ? cData.myFavoriteId : null;
      const civilianTargets = state.livingPlayers.filter(p => !p.isMe && p.id !== state.hostSocketId);

      const gridHTML = `
        <div class="civilian-selection-banner ${myFavoriteId ? 'has-selection' : ''}">
          <span>${myFavoriteId ? `⭐ Favorite Selected: <strong>${cData.myFavoriteName}</strong>` : '👆 Tap a player below to choose your favorite:'}</span>
        </div>
        <div class="targets-grid">
          ${civilianTargets.map(p => {
            const isSelected = p.id === myFavoriteId;
            return `
              <button class="target-card ${isSelected ? 'selected' : ''}" data-target-id="${p.id}">
                <span class="target-avatar">${p.avatar}</span>
                <span class="target-name">${p.name}</span>
                ${isSelected ? '<span class="selected-check">⭐ Your Favorite</span>' : ''}
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
            SoundFX.playClick();
            socket.emit('game_action', { action: 'civilian_favorite', targetId });
          };
        });
      }
    }
  }
};

