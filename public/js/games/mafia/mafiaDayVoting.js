/**
 * Mafia Day Phases UI Controller (Morning story, discussion, secret voting, and tally)
 */

const MafiaDayVoting = {
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

      // Candidates: A voter cannot vote for themselves or the Host
      const candidateList = (state.isHost || state.isEliminated)
        ? state.livingPlayers.filter(p => p.id !== state.hostSocketId)
        : state.livingPlayers.filter(p => !p.isMe && p.id !== state.hostSocketId);

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
  }
};
