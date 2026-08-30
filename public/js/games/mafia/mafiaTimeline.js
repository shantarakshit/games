/**
 * Mafia Match Timeline, End-Game Screen & Roster UI Controller
 */

const MafiaTimeline = {
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
      let winSubtitle = state.winner === 'civilians'
        ? 'The town has successfully brought all murderers to justice!'
        : 'The murderers have equaled or outnumbered the town!';

      let concludingEventHTML = '';
      if (state.winReason === 'murderers-majority' && state.morningAnnouncement && state.morningAnnouncement.attackedVictimId) {
        concludingEventHTML = `<div class="concluding-event-pill" style="margin-top: 10px; font-size: 0.9rem; color: #fecaca; background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; border-radius: 8px; padding: 6px 12px;">💀 <strong>Final Night Casualty:</strong> ${state.morningAnnouncement.attackedVictimName} was murdered at sunrise!</div>`;
      } else if (state.tallyResultText) {
        concludingEventHTML = `<div class="concluding-event-pill" style="margin-top: 10px; font-size: 0.9rem; color: #c7d2fe; background: rgba(99, 102, 241, 0.25); border: 1px solid #818cf8; border-radius: 8px; padding: 6px 12px;">${state.tallyResultText}</div>`;
      }

      if (state.winner === 'civilians') {
        bannerEl.className = 'winner-banner civilians-win';
        bannerEl.innerHTML = `
          <span class="winner-trophy">🏆</span>
          <h1>CIVILIANS WIN!</h1>
          <p>${winSubtitle}</p>
          ${concludingEventHTML}
        `;
      } else {
        bannerEl.className = 'winner-banner mafia-wins';
        bannerEl.innerHTML = `
          <span class="winner-trophy">🔪</span>
          <h1>MAFIA WINS!</h1>
          <p>${winSubtitle}</p>
          ${concludingEventHTML}
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

    // Render Full Match Timeline Ledger (HOST ONLY)
    const timelineContainer = document.getElementById('mafiaTimelineContainer');
    const showTimeline = isEnded && state.isHost && state.timeline && state.timeline.length > 0;
    
    if (timelineContainer) {
      timelineContainer.classList.toggle('hidden', !showTimeline);
    }

    if (timelineListEl && showTimeline) {
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
          let outcomeText = 'No votes cast (0 eliminated)';
          if (t.day.eliminatedName) {
            outcomeText = `⚖️ <strong>${t.day.eliminatedName}</strong> (${t.day.eliminatedRole || 'Role Revealed'})`;
          } else if (t.day.isTie) {
            outcomeText = `⚖️ Tie vote (${t.day.maxVotes || 0} votes each - 0 eliminated)`;
          }

          dayHTML = `
            <div class="timeline-subgroup">
              <strong>🗳️ Day ${t.round} Vote:</strong>
              <ul>
                <li>Top Vote: ${t.day.maxVotes || 0} vote${(t.day.maxVotes || 0) === 1 ? '' : 's'} (Plurality)</li>
                <li>Elimination: ${outcomeText}</li>
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
