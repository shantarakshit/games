const CodenamesInstance = require('./CodenamesInstance');

class CodenamesPlugin {
  constructor() {
    this.id = 'codenames';
    this.name = 'Codenames';
    this.description = 'Team word-guessing game. Spymasters give 1-word clues to guide their field operatives to their secret agent cards!';
    this.icon = '🕵️‍♂️';
    this.minPlayers = 4;
    this.maxPlayers = 16;
    this.category = 'Word / Team Game';
    this.settingsSchema = [
      {
        id: 'startingTeamMode',
        label: 'Starting Card Advantage',
        type: 'select',
        options: [
          { value: 'random', label: 'Random (9 vs 8 cards)' },
          { value: 'equal', label: 'Equal Cards (8 vs 8 cards)' },
          { value: 'red', label: 'Red Team Starts (9 vs 8)' },
          { value: 'blue', label: 'Blue Team Starts (9 vs 8)' }
        ],
        default: 'random',
        description: 'Internet debate: Standard game gives first team +1 card advantage; Equal mode gives both teams 8 cards.'
      },
      {
        id: 'guessLimitMode',
        label: 'Guess Count Limit',
        type: 'select',
        options: [
          { value: 'clue_plus_one', label: 'Clue + 1 (Standard catch-up rule)' },
          { value: 'strict', label: 'Strict (Clue number only)' },
          { value: 'unlimited', label: 'Unlimited (Guess until wrong)' }
        ],
        default: 'clue_plus_one',
        description: 'Standard allows 1 extra guess for previous missed clues.'
      },
      {
        id: 'assassinMode',
        label: 'Assassin Penalty',
        type: 'select',
        options: [
          { value: 'instant_loss', label: 'Instant Loss (Standard)' },
          { value: 'soft', label: 'Soft Assassin (Lose turn & -1 point)' }
        ],
        default: 'instant_loss',
        description: 'Soft Assassin prevents 1 accidental tap from ruining a 20-minute match.'
      },
      {
        id: 'timerPerTurn',
        label: 'Turn Timer',
        type: 'select',
        options: [
          { value: 120, label: '120 Seconds (2 Minutes - Standard)' },
          { value: 60, label: '60 Seconds' },
          { value: 90, label: '90 Seconds' },
          { value: 180, label: '180 Seconds (3 Minutes)' },
          { value: 0, label: 'No Timer' }
        ],
        default: 120,
        description: 'Turn timer for fast-paced party play (defaults to 120 seconds).'
      }
    ];
  }

  createInstance(room, emitEvent) {
    return new CodenamesInstance(room, emitEvent);
  }
}

module.exports = CodenamesPlugin;
