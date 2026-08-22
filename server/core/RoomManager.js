const GameRegistry = require('./GameRegistry');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  /**
   * Generate a unique 4-letter uppercase room code.
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new room with a host.
   */
  createRoom(hostSocket, hostName, avatar = '😎') {
    const code = this.generateRoomCode();
    const player = {
      id: hostSocket.id,
      name: hostName || 'Host',
      avatar,
      isHost: true,
      isReady: true,
      team: 'red',
      role: 'operative'
    };

    const room = {
      code,
      hostId: hostSocket.id,
      gameId: null,
      gameInstance: null,
      gameState: 'lobby',
      players: new Map([[hostSocket.id, player]]),
      settings: {
        timer: 300,
        spiesCount: 1,
        wordPack: 'classic'
      },
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    hostSocket.join(code);
    hostSocket.roomCode = code;

    console.log(`🏠 Room Created: [${code}] by Host ${player.name} (${hostSocket.id})`);
    return room;
  }

  /**
   * Join or Reconnect to an existing room.
   */
  joinRoom(socket, code, playerName, avatar = '👾') {
    code = (code || '').toUpperCase().trim();
    let room = this.rooms.get(code);

    // Single Room Mode Fallback: Auto-resolve to active room if code is empty or MAIN
    if (!room && this.rooms.size > 0) {
      room = this.rooms.values().next().value;
      code = room.code;
    }

    if (!room) {
      return { success: false, message: 'No active game room found. Tap "Create Room" to start a party room!' };
    }

    const cleanName = (playerName || `Player ${room.players.size + 1}`).trim();

    // 1. RECONNECTION CHECK: Check if a player with matching nickname already exists in room
    let existingPlayer = null;
    let oldSocketId = null;

    for (const [sId, p] of room.players.entries()) {
      if (p.name.toLowerCase() === cleanName.toLowerCase()) {
        existingPlayer = p;
        oldSocketId = sId;
        break;
      }
    }

    if (existingPlayer) {
      // Reconnect existing player with new socket ID!
      room.players.delete(oldSocketId);
      existingPlayer.id = socket.id;

      if (room.hostId === oldSocketId) {
        room.hostId = socket.id;
        existingPlayer.isHost = true;
      }

      // Delegate reconnection state transfer to active game instance if applicable
      if (room.gameInstance && typeof room.gameInstance.reconnectPlayer === 'function') {
        room.gameInstance.reconnectPlayer(oldSocketId, socket.id);
      }

      room.players.set(socket.id, existingPlayer);
      socket.join(code);
      socket.roomCode = code;

      console.log(`🔄 Player Reconnected: ${existingPlayer.name} rejoined room [${code}] with role [${existingPlayer.team.toUpperCase()} ${existingPlayer.role.toUpperCase()}]`);
      this.broadcastRoomUpdate(code);

      if (room.gameState === 'playing' && room.gameInstance) {
        this.broadcastGameState(code);
      }

      return { success: true, room: this.getRoomDTO(room), reconnected: true };
    }

    // 2. NEW PLAYER JOIN
    const player = {
      id: socket.id,
      name: cleanName,
      avatar,
      isHost: false,
      isReady: false,
      team: room.players.size % 2 === 0 ? 'red' : 'blue',
      role: 'operative'
    };

    room.players.set(socket.id, player);
    socket.join(code);
    socket.roomCode = code;

    console.log(`👤 Player Joined: ${player.name} joined room [${code}]`);
    this.broadcastRoomUpdate(code);

    return { success: true, room: this.getRoomDTO(room) };
  }

  /**
   * Transfer Host role to another player.
   */
  transferHost(code, currentHostSocketId, targetSocketId) {
    const room = this.rooms.get(code);
    if (!room) return { success: false, message: 'Room not found' };
    if (room.hostId !== currentHostSocketId) return { success: false, message: 'Only current host can transfer host role' };
    if (!room.players.has(targetSocketId)) return { success: false, message: 'Target player not in room' };

    const oldHost = room.players.get(currentHostSocketId);
    const newHost = room.players.get(targetSocketId);

    if (oldHost) oldHost.isHost = false;
    if (newHost) newHost.isHost = true;
    room.hostId = targetSocketId;

    console.log(`👑 Host Transferred in room [${code}]: ${oldHost ? oldHost.name : currentHostSocketId} -> ${newHost.name}`);
    this.broadcastRoomUpdate(code);
    return { success: true };
  }

  /**
   * Kick/remove a player from the room (Host only).
   */
  kickPlayer(code, currentHostSocketId, targetSocketId) {
    const room = this.rooms.get(code);
    if (!room) return { success: false, message: 'Room not found' };
    if (room.hostId !== currentHostSocketId) return { success: false, message: 'Only host can remove players' };
    if (currentHostSocketId === targetSocketId) return { success: false, message: 'Host cannot kick themselves' };
    if (!room.players.has(targetSocketId)) return { success: false, message: 'Player not in room' };

    const kickedPlayer = room.players.get(targetSocketId);
    room.players.delete(targetSocketId);

    const targetSocket = this.io ? this.io.sockets.sockets.get(targetSocketId) : null;
    if (targetSocket) {
      targetSocket.leave(code);
      targetSocket.roomCode = null;
      targetSocket.emit('kicked_from_room', { message: 'You were removed from the lobby by the Host.' });
    }

    console.log(`🚫 Player Kicked from room [${code}]: ${kickedPlayer ? kickedPlayer.name : targetSocketId}`);
    this.broadcastRoomUpdate(code);
    return { success: true };
  }

  /**
   * Reset the server: disconnect all sockets, clear all rooms.
   * The next player to join will become host of a fresh room.
   */
  resetAll() {
    const roomCount = this.rooms.size;
    let socketCount = 0;

    for (const [code, room] of this.rooms.entries()) {
      for (const socketId of room.players.keys()) {
        const sock = this.io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('server_reset', { message: 'The server has been reset by the administrator. Please refresh to rejoin.' });
          sock.disconnect(true);
          socketCount++;
        }
      }
      if (room.gameInstance && typeof room.gameInstance.destroy === 'function') {
        room.gameInstance.destroy();
      }
    }

    this.rooms.clear();
    console.log(`🔄 Server Reset: Cleared ${roomCount} room(s) and disconnected ${socketCount} socket(s).`);
    return { roomCount, socketCount };
  }

  /**
   * Leave or disconnect from room.
   */
  handleDisconnect(socket) {
    const code = socket.roomCode;
    if (!code || !this.rooms.has(code)) return;

    const room = this.rooms.get(code);
    const player = room.players.get(socket.id);
    const playerName = player ? player.name : socket.id;

    // In lobby state, remove player. In active playing state, keep player record for reconnection!
    if (room.gameState === 'lobby') {
      room.players.delete(socket.id);
      console.log(`👋 Player Left: ${playerName} left room [${code}]`);

      if (room.players.size === 0) {
        this.rooms.delete(code);
        console.log(`🧹 Room Deleted: [${code}] (empty)`);
      } else {
        if (room.hostId === socket.id) {
          const nextHost = room.players.values().next().value;
          nextHost.isHost = true;
          room.hostId = nextHost.id;
          console.log(`👑 New Host Assigned: ${nextHost.name} for room [${code}]`);
        }
        this.broadcastRoomUpdate(code);
      }
    } else {
      console.log(`🔌 Player Disconnected Mid-Game: ${playerName} (Can reconnect anytime via nickname)`);
    }
  }

  /**
   * Handle game specific action emitted from client.
   */
  handleGameAction(socket, action, data = {}) {
    const code = socket.roomCode;
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      if (action === 'set_team' && data.team) {
        player.team = data.team;
        player.role = 'operative';
        this.broadcastRoomUpdate(code);
      }
      if (action === 'claim_spymaster') {
        const team = player.team || 'red';
        for (const p of room.players.values()) {
          if (p.team === team && p.role === 'spymaster') p.role = 'operative';
        }
        player.role = 'spymaster';
        this.broadcastRoomUpdate(code);
      }
    }

    if (room.gameInstance && typeof room.gameInstance.handleAction === 'function') {
      room.gameInstance.handleAction(socket.id, action, data, room, () => {
        this.broadcastGameState(code);
      });
    }
  }

  /**
   * Select a game for the room.
   */
  selectGame(code, gameId) {
    const room = this.rooms.get(code);
    if (!room) return;

    const gamePlugin = GameRegistry.getGame(gameId);
    if (!gamePlugin) return;

    room.gameId = gameId;

    if (!room.settings[gameId] && gamePlugin.settingsSchema) {
      room.settings[gameId] = {};
      gamePlugin.settingsSchema.forEach(setting => {
        room.settings[gameId][setting.id] = setting.default;
      });
    }

    console.log(`🎮 Game Selected: [${gameId}] for room [${code}]`);
    this.broadcastRoomUpdate(code);
  }

  /**
   * Update settings for a selected game.
   */
  updateRoomSettings(code, gameId, newSettings) {
    const room = this.rooms.get(code);
    if (!room) return;

    if (!room.settings) room.settings = {};
    room.settings[gameId] = Object.assign(room.settings[gameId] || {}, newSettings);
    Object.assign(room.settings, newSettings);

    if (room.gameInstance) {
      Object.assign(room.gameInstance.settings, newSettings);
      if (newSettings.timer !== undefined && newSettings.timer > 0) {
        room.gameInstance.timerSeconds = newSettings.timer;
      }
      if (newSettings.timerPerTurn !== undefined && newSettings.timerPerTurn > 0) {
        room.gameInstance.timerSeconds = newSettings.timerPerTurn;
      }
    }

    console.log(`⚙️ Room Settings Updated for [${gameId}] in [${code}]:`, newSettings);
    this.broadcastRoomUpdate(code);
    if (room.gameState === 'playing') {
      this.broadcastGameState(code);
    }
  }

  /**
   * Start game in room.
   */
  startGame(code) {
    const room = this.rooms.get(code);
    if (!room || !room.gameId) return;

    // Requirement 5: For Codenames, verify both Spymasters are claimed before starting!
    if (room.gameId === 'codenames') {
      let redSpymaster = Array.from(room.players.values()).find(p => p.team === 'red' && p.role === 'spymaster');
      let blueSpymaster = Array.from(room.players.values()).find(p => p.team === 'blue' && p.role === 'spymaster');

      if (!redSpymaster || !blueSpymaster) {
        this.io.to(code).emit('system_message', {
          type: 'warning',
          text: '⚠️ Cannot start Codenames until both RED Spymaster and BLUE Spymaster are claimed!'
        });
        return { success: false, message: 'Both RED and BLUE Spymasters must be claimed before starting!' };
      }
    }

    const gamePlugin = GameRegistry.getGame(room.gameId);
    if (!gamePlugin) return;

    // Minimum player count enforcement
    if (room.players.size < (gamePlugin.minPlayers || 1)) {
      this.io.to(code).emit('system_message', {
        type: 'warning',
        text: `⚠️ ${gamePlugin.name} requires at least ${gamePlugin.minPlayers} players to start!`
      });
      return { success: false, message: `${gamePlugin.name} requires at least ${gamePlugin.minPlayers} players to start!` };
    }

    room.gameState = 'playing';
    room.gameInstance = gamePlugin.createInstance(room, (event, data) => {
      if (event === 'game_state_updated') {
        this.broadcastGameState(code);
      } else {
        this.broadcastGameEvent(code, event, data);
      }
    });

    console.log(`🚀 Game Started: [${room.gameId}] in room [${code}]`);
    this.broadcastRoomUpdate(code);
    this.broadcastGameState(code);
    return { success: true };
  }

  /**
   * Return to lobby.
   */
  returnToLobby(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.gameInstance && typeof room.gameInstance.destroy === 'function') {
      room.gameInstance.destroy();
    }

    room.gameState = 'lobby';
    room.gameInstance = null;

    // Reset player roles to operative for next match
    for (const player of room.players.values()) {
      player.role = 'operative';
    }

    console.log(`🔄 Room Returned to Lobby: [${code}]`);
    this.broadcastRoomUpdate(code);
  }

  /**
   * Broadcast room state DTO to all sockets in room.
   */
  broadcastRoomUpdate(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    const dto = this.getRoomDTO(room);
    this.io.to(code).emit('room_updated', dto);
  }

  /**
   * Broadcast individual sanitized game state to each player.
   */
  broadcastGameState(code) {
    const room = this.rooms.get(code);
    if (!room || !room.gameInstance) return;

    for (const [socketId, player] of room.players) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        const playerState = room.gameInstance.getPlayerState(socketId, player, room);
        socket.emit('game_state_updated', playerState);
      }
    }
  }

  /**
   * Broadcast a game event to room.
   */
  broadcastGameEvent(code, event, data) {
    if (event === 'play_boo_sound_targeted' && data && Array.isArray(data.targetSockets)) {
      data.targetSockets.forEach(sId => {
        const socket = this.io.sockets.sockets.get(sId);
        if (socket) socket.emit('play_boo_sound');
      });
      return;
    }
    this.io.to(code).emit(event, data);
  }

  /**
   * Sanitize room object into a DTO.
   */
  getRoomDTO(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      gameId: room.gameId,
      gameState: room.gameState,
      settings: room.settings,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost,
        isReady: p.isReady,
        team: p.team || 'red',
        role: p.role || 'operative'
      }))
    };
  }
}

module.exports = RoomManager;
