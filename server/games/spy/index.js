const SpyInstance = require('./SpyInstance');

class SpyPlugin {
  constructor() {
    this.id = 'spy';
    this.name = 'The Imposter Game';
    this.description = 'Find the hidden imposter among your party guests before time runs out!';
    this.icon = '🕵️';
    this.minPlayers = 3;
    this.maxPlayers = 16;
    this.category = 'Bluffing / Party Game';
    this.settingsSchema = [
      {
        id: 'spiesCount',
        label: 'Number of Spies',
        type: 'select',
        options: [
          { value: 1, label: '1 Spy (Standard)' },
          { value: 2, label: '2 Spies (Suggested for 8+ players)' },
          { value: 3, label: '3 Spies (Suggested for 12+ players)' }
        ],
        default: 1,
        description: 'Multiple Spies adds chaos and teamwork for larger groups.'
      },
      {
        id: 'spyKnowledgeMode',
        label: 'Spy Difficulty / Knowledge',
        type: 'select',
        options: [
          { value: 'category', label: 'Category Given (Standard)' },
          { value: 'blind', label: 'Hardcore Blind (No Category)' }
        ],
        default: 'category',
        description: 'Hardcore Blind mode gives the spy zero category info for maximum challenge.'
      },
      {
        id: 'timer',
        label: 'Discussion Timer',
        type: 'select',
        options: [
          { value: 120, label: '2 Minutes (Fast)' },
          { value: 180, label: '3 Minutes (Standard)' },
          { value: 300, label: '5 Minutes (Casual)' },
          { value: 0, label: 'No Timer (Untimed Discussion)' }
        ],
        default: 180,
        description: 'Timer duration for asking questions before voting (or No Timer for untimed play).'
      },
      {
        id: 'coverTyping',
        label: 'Cover-Typing Phase',
        type: 'select',
        options: [
          { value: true, label: 'Enabled (20s typing before voting)' },
          { value: false, label: 'Disabled (skip to voting directly)' }
        ],
        default: true,
        description: 'When enabled, everyone types a word before voting to disguise who is the Impostor.'
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
        description: 'Plurality eliminates the highest-voted player (ties cancel). Strict Majority requires >50% of living voters. (No Imposters Left always requires unanimous vote).'
      }
    ];
  }

  createInstance(room, emitEvent) {
    return new SpyInstance(room, emitEvent);
  }
}

module.exports = SpyPlugin;
