const GameRegistry = require('./GameRegistry');
const PlayerManager = require('./PlayerManager');
const RoomBroadcaster = require('./RoomBroadcaster');
const { ROOM_CODE_CHARS, DEFAULT_ROOM_CODE_LENGTH } = require('../config');

/**
 * RoomManager
 * Coordinates game rooms, player sessions, game plugin instantiation, and game state routing.
 */
class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  /**
   * Generate a unique uppercase room code.
   * @returns {string}
   */
  generateRoomCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < DEFAULT_ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Resolve room by code, with single-room fallback if code is empty or 'MAIN'.
   * @param {string} code 
   * @returns {Object|null}
   */
  resolveRoom(code) {
    const cleanCode = (code || '').toUpperCase().trim();
    let room = this.rooms.get(cleanCode);

    // Single Room Mode Fallback: Auto-resolve to active room if code is empty or MAIN
    if (!room && this.rooms.size > 0) {
      room = this.rooms.values().next().value;
    }
    return room;
  }

  /**
   * Create a new room with a host.
   */
  createRoom(hostSocket, hostName, avatar = '😎', pin = '') {
    const code = this.generateRoomCode();
    const cleanName = (hostName || 'Host').trim();
    const cleanPin = String(pin || '0000').trim().replace(/\D/g, '').slice(0, 4) || '0000';

    const player = PlayerManager.createPlayerModel(
      hostSocket.id,
      cleanName,
      avatar,
      cleanPin,
      true,
      'red'
    );

    const userPins = new Map();
    userPins.set(cleanName.toLowerCase(), cleanPin);

    const room = {
      code,
      hostId: hostSocket.id,
      gameId: null,
      gameInstance: null,
      gameState: 'lobby',
      players: new Map([[hostSocket.id, player]]),
      userPins,
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

    console.log(`🏠 Room Created: [${code}] by Host ${player.name} (${hostSocket.id}) with PIN [****]`);
    return room;
  }

  /**
   * Check if a username already exists in the active room.
   */
  checkUsername(code, playerName) {
    const room = this.resolveRoom(code);
    return PlayerManager.checkUsername(room, playerName);
  }

  /**
   * Join or Reconnect to an existing room with 4-digit PIN verification.
   */
  joinRoom(socket, code, playerName, avatar = '👾', pin = '') {
    const room = this.resolveRoom(code);
    if (!room) {
      return { success: false, message: 'No active game room found. Tap "Create Room" to start a party room!' };
    }
    return PlayerManager.handleJoinOrReconnect(this, socket, room, playerName, avatar, pin);
  }

  /**
   * Explicit Player Leave Room (removes player immediately without 2-min away timer).
   */
  leaveRoom(socket, code) {
    code = code || socket.roomCode;
    if (!code) return { success: false, message: 'Room not found' };

    const room = this.rooms.get(code);
    if (!room) return { success: false, message: 'Room not found' };

    const player = room.players.get(socket.id);
    if (!player) return { success: false, message: 'Player not in room' };

    PlayerManager.clearPlayerTimers(player);
    room.players.delete(socket.id);
    socket.leave(code);
    socket.roomCode = null;

    console.log(`👋 Player Left: ${player.name} explicitly left room [${code}]. Remaining players: ${room.players.size}`);

    // If leaving player was host, reassign to next connected player
    if (room.hostId === socket.id && room.players.size > 0) {
      const nextActiveHost = Array.from(room.players.values()).find(p => p.connected && !p.hiddenFromLobby) || room.players.values().next().value;
      if (nextActiveHost) {
        nextActiveHost.isHost = true;
        room.hostId = nextActiveHost.id;
        if (room.gameInstance && 'hostSocketId' in room.gameInstance) {
          room.gameInstance.hostSocketId = nextActiveHost.id;
        }
        console.log(`👑 Host transferred to: ${nextActiveHost.name}`);
      }
    }

    // If room is completely empty, clean up room
    if (room.players.size === 0) {
      if (room.gameInstance && typeof room.gameInstance.destroy === 'function') {
        room.gameInstance.destroy();
      }
      this.rooms.delete(code);
      console.log(`🗑️ Room [${code}] deleted (empty room).`);
    } else {
      this.broadcastRoomUpdate(code);
    }

    return { success: true };
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

    if (room.gameInstance && 'hostSocketId' in room.gameInstance) {
      room.gameInstance.hostSocketId = targetSocketId;
    }

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
    if (kickedPlayer) {
      PlayerManager.clearPlayerTimers(kickedPlayer);
      if (room.userPins) {
        room.userPins.delete(kickedPlayer.name.toLowerCase());
      }
    }
    room.players.delete(targetSocketId);

    const targetSocket = this.io ? this.io.sockets.sockets.get(targetSocketId) : null;
    if (targetSocket) {
      targetSocket.leave(code);
      targetSocket.roomCode = null;
      targetSocket.emit('kicked_from_room', { message: 'You were removed from the lobby by the Host.' });
    }

    console.log(`🚫 Player Kicked from room [${code}]: ${kickedPlayer ? kickedPlayer.name : targetSocketId} (PIN cleared)`);
    this.broadcastRoomUpdate(code);
    return { success: true };
  }

  /**
   * Reset the server: disconnect all sockets, clear all rooms.
   */
  resetAll() {
    const roomCount = this.rooms.size;
    let socketCount = 0;

    for (const [code, room] of this.rooms.entries()) {
      for (const player of room.players.values()) {
        PlayerManager.clearPlayerTimers(player);
      }
      for (const socketId of room.players.keys()) {
        const sock = this.io && this.io.sockets && this.io.sockets.sockets ? this.io.sockets.sockets.get(socketId) : null;
        if (sock) {
          sock.emit('server_reset', { message: 'The server has been reset by the administrator. Please refresh to rejoin.' });
          if (typeof sock.disconnect === 'function') {
            sock.disconnect(true);
          }
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
    PlayerManager.handleDisconnect(this, socket, room);
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
    if (player && room.gameState === 'lobby') {
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
   * Select a game in room.
   */
  selectGame(code, gameId) {
    const room = this.rooms.get(code);
    if (!room) return;

    const gamePlugin = GameRegistry.getGame(gameId);
    if (!gamePlugin) return;

    room.gameId = gameId;
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
      if (newSettings.timer !== undefined) {
        const val = Number(newSettings.timer);
        room.gameInstance.timerSeconds = isNaN(val) ? 0 : val;
        if (room.gameInstance.timerSeconds <= 0 && typeof room.gameInstance.stopTimer === 'function') {
          room.gameInstance.stopTimer();
        }
      }
      if (newSettings.timerPerTurn !== undefined) {
        const val = Number(newSettings.timerPerTurn);
        room.gameInstance.timerSeconds = isNaN(val) ? 0 : val;
        if (room.gameInstance.timerSeconds <= 0 && typeof room.gameInstance.stopTurnTimer === 'function') {
          room.gameInstance.stopTurnTimer();
        }
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

    // 1. Check if any visible lobby player is Away (Game can only start when everyone is active)
    const visiblePlayers = Array.from(room.players.values()).filter(p => p.hiddenFromLobby !== true);
    const awayPlayers = visiblePlayers.filter(p => !p.connected || p.isAway);

    if (awayPlayers.length > 0) {
      this.io.to(code).emit('system_message', {
        type: 'warning',
        text: `⚠️ Cannot start game while players are Away (${awayPlayers.map(p => p.name).join(', ')}). All players must be active (no Away badge), or Host can Remove them.`
      });
      return { success: false, message: 'All players in the lobby must be active (no Away badge) to start game.' };
    }

    // 2. People away for 2-5 min (hiddenFromLobby) are NOT included in the game when it begins
    for (const [sId, p] of room.players.entries()) {
      if (p.hiddenFromLobby) {
        PlayerManager.clearPlayerTimers(p);
        room.players.delete(sId);
      }
    }

    // 3. For Codenames, verify both Spymasters are claimed before starting!
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
   * Broadcast current room state to all clients in room.
   */
  broadcastRoomUpdate(code) {
    const room = this.rooms.get(code);
    if (room) {
      RoomBroadcaster.broadcastRoomUpdate(this.io, room);
    }
  }

  /**
   * Broadcast game specific state.
   */
  broadcastGameState(code) {
    const room = this.rooms.get(code);
    if (room) {
      RoomBroadcaster.broadcastGameState(this.io, room);
    }
  }

  /**
   * Broadcast game specific events.
   */
  broadcastGameEvent(code, event, data) {
    const room = this.rooms.get(code);
    if (room) {
      RoomBroadcaster.broadcastGameEvent(this.io, room, event, data);
    }
  }

  /**
   * Sanitize room object into a DTO.
   */
  getRoomDTO(room) {
    return RoomBroadcaster.getRoomDTO(room);
  }
}

module.exports = RoomManager;
