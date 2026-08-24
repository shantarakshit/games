const MafiaInstance = require('./MafiaInstance');

class MafiaPlugin {
  constructor() {
    this.id = 'mafia';
    this.name = 'Mafia';
    this.description = 'A classic party game of deception, investigation, and survival for 6-18 players!';
    this.icon = '🔪';
    this.minPlayers = 6;
    this.maxPlayers = 18;
    this.category = 'Social Deduction';
    this.settingsSchema = [
      {
        id: 'murderersCount',
        label: 'Number of Murderers',
        type: 'select',
        options: [
          { value: 'auto', label: 'Auto Balanced (1-3 based on group size)' },
          { value: 1, label: '1 Murderer' },
          { value: 2, label: '2 Murderers' },
          { value: 3, label: '3 Murderers' }
        ],
        default: 'auto',
        description: 'Auto mode allocates 1 murderer for <=8 players, 2 for 9-13 players, 3 for 14+ players.'
      },
      {
        id: 'discussionTimer',
        label: 'Daytime Discussion Timer',
        type: 'select',
        options: [
          { value: 60, label: '1 Minute (Speed)' },
          { value: 120, label: '2 Minutes (Fast)' },
          { value: 180, label: '3 Minutes (Standard)' },
          { value: 300, label: '5 Minutes (Extended)' },
          { value: 0, label: 'No Timer (Host-Paced)' }
        ],
        default: 180,
        description: 'Time allocated for living players to debate in person before town voting.'
      },
      {
        id: 'votingTimer',
        label: 'Town Voting Timer',
        type: 'select',
        options: [
          { value: 20, label: '20 Seconds (Fast)' },
          { value: 30, label: '30 Seconds (Standard)' },
          { value: 60, label: '60 Seconds (Deliberate)' },
          { value: 0, label: 'No Timer (Wait for All Votes)' }
        ],
        default: 30,
        description: 'Time allocated for players to secretly cast their elimination ballot.'
      },
      {
        id: 'eliminationMode',
        label: 'Elimination Vote Rule',
        type: 'select',
        options: [
          { value: 'plurality', label: 'Plurality (Most Votes Wins - Ties Cancel)' },
          { value: 'majority', label: 'Strict Majority (>50% of Living Players)' }
        ],
        default: 'plurality',
        description: 'Plurality eliminates the highest-voted player (ties cancel). Strict Majority requires >50% of living voters.'
      }
    ];
  }

  createInstance(room, emitEvent) {
    return new MafiaInstance(room, emitEvent);
  }
}

module.exports = MafiaPlugin;
