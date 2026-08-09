const fs = require('fs');
const path = require('path');

class GameRegistry {
  constructor() {
    this.games = new Map();
  }

  /**
   * Load and register all games inside the server/games directory.
   */
  loadGames() {
    const gamesDir = path.join(__dirname, '../games');
    if (!fs.existsSync(gamesDir)) {
      console.warn('⚠️ Games directory not found:', gamesDir);
      return;
    }

    const gameFolders = fs.readdirSync(gamesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folder of gameFolders) {
      const indexPath = path.join(gamesDir, folder, 'index.js');
      if (fs.existsSync(indexPath)) {
        try {
          const GameClass = require(indexPath);
          const gameInstance = new GameClass();
          this.games.set(gameInstance.id, gameInstance);
          console.log(`✅ Game Registered: [${gameInstance.id}] ${gameInstance.name}`);
        } catch (err) {
          console.error(`❌ Failed to load game [${folder}]:`, err);
        }
      }
    }
  }

  /**
   * Get list of all registered game manifests for the Hub client.
   */
  getGameList() {
    return Array.from(this.games.values()).map(game => ({
      id: game.id,
      name: game.name,
      description: game.description,
      icon: game.icon,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      category: game.category,
      settingsSchema: game.settingsSchema || []
    }));
  }

  /**
   * Get a specific game plugin instance by ID.
   */
  getGame(id) {
    return this.games.get(id);
  }
}

module.exports = new GameRegistry();
