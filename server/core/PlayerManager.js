const { LOBBY_AWAY_UI_MS, USER_DATA_CLEANUP_MS, MIDGAME_DISCONNECT_GRACE_MS } = require('../config');
const RoomBroadcaster = require('./RoomBroadcaster');

/**
 * PlayerManager
 * Manages player session state, PIN verification, away badge timers, and disconnect cleanup.
 */
class PlayerManager {
  /**
   * Helper: create standard player data structure
   */
  static createPlayerModel(socketId, name, avatar = '👾', pin = '0000', isHost = false, team = 'red') {
    return {
      id: socketId,
      name: (name || 'Player').trim(),
      avatar: avatar || '😎',
      pin: String(pin || '0000').trim().replace(/\D/g, '').slice(0, 4) || '0000',
      isHost: Boolean(isHost),
      isReady: Boolean(isHost),
      team,
      role: 'operative',
      connected: true,
      isAway: false,
      hiddenFromLobby: false,
      _hideTimer: null,
      _cleanupTimer: null
    };
  }

  /**
   * Clear all pending timer timeouts on a player object.
   * @param {Object} player 
   */
  static clearPlayerTimers(player) {
    if (!player) return;
    if (player._hideTimer) {
      clearTimeout(player._hideTimer);
      player._hideTimer = null;
    }
    if (player._cleanupTimer) {
      clearTimeout(player._cleanupTimer);
      player._cleanupTimer = null;
    }
  }

  /**
   * Check if a player name exists in a room.
   */
  static checkUsername(room, playerName) {
    if (!room) {
      return { exists: false, roomExists: false, roomCode: null };
    }

    const normalized = (playerName || '').trim().toLowerCase();
    if (!normalized) {
      return { exists: false, roomExists: true, roomCode: room.code };
    }

    const inUserPins = room.userPins && room.userPins.has(normalized);
    const inPlayers = Array.from(room.players.values()).some(p => p.name.toLowerCase() === normalized);

    return {
      exists: Boolean(inUserPins || inPlayers),
      roomExists: true,
      roomCode: room.code
    };
  }

  /**
   * Process join room or reconnect existing session with 4-digit PIN verification.
   */
  static handleJoinOrReconnect(roomManager, socket, room, playerName, avatar, pin) {
    if (!room.userPins) {
      room.userPins = new Map();
    }

    const cleanName = (playerName || `Player ${room.players.size + 1}`).trim();
    const normalized = cleanName.toLowerCase();
    const cleanPin = String(pin || '').trim().replace(/\D/g, '').slice(0, 4);

    // 1. Check if an existing player or registered PIN matches
    let existingPlayer = null;
    let oldSocketId = null;

    for (const [sId, p] of room.players.entries()) {
      if (p.name.toLowerCase() === normalized) {
        existingPlayer = p;
        oldSocketId = sId;
        break;
      }
    }

    const userPinExists = room.userPins.has(normalized);

    if (existingPlayer || userPinExists) {
      const expectedPin = room.userPins.get(normalized) || (existingPlayer && existingPlayer.pin) || '0000';
      if (cleanPin !== expectedPin) {
        return {
          success: false,
          errorCode: 'INVALID_PIN',
          message: '🔒 Incorrect 4-digit PIN for this nickname. Please try again.'
        };
      }

      if (existingPlayer) {
        this.clearPlayerTimers(existingPlayer);
        existingPlayer.connected = true;
        existingPlayer.isAway = false;
        existingPlayer.hiddenFromLobby = false;

        // Reconnect existing player with new socket ID
        room.players.delete(oldSocketId);
        existingPlayer.id = socket.id;

        if (room.hostId === oldSocketId) {
          room.hostId = socket.id;
          existingPlayer.isHost = true;
        }

        // Delegate state transfer to active game plugin instance if supported
        if (room.gameInstance && typeof room.gameInstance.reconnectPlayer === 'function') {
          room.gameInstance.reconnectPlayer(oldSocketId, socket.id);
        }

        room.players.set(socket.id, existingPlayer);
        socket.join(room.code);
        socket.roomCode = room.code;

        console.log(`🔄 Player Reconnected: ${existingPlayer.name} rejoined room [${room.code}] with role [${existingPlayer.team.toUpperCase()} ${existingPlayer.role.toUpperCase()}]`);
        roomManager.broadcastRoomUpdate(room.code);

        if (room.gameState === 'playing' && room.gameInstance) {
          roomManager.broadcastGameState(room.code);
        }

        return { success: true, room: RoomBroadcaster.getRoomDTO(room), reconnected: true };
      } else {
        // Known PIN re-entering after past cleanup
        const player = this.createPlayerModel(
          socket.id,
          cleanName,
          avatar,
          cleanPin,
          false,
          room.players.size % 2 === 0 ? 'red' : 'blue'
        );

        room.players.set(socket.id, player);
        socket.join(room.code);
        socket.roomCode = room.code;

        console.log(`👤 Player Re-entered: ${player.name} joined room [${room.code}] with verified PIN`);
        roomManager.broadcastRoomUpdate(room.code);

        return { success: true, room: RoomBroadcaster.getRoomDTO(room) };
      }
    }

    // 2. New Player Registration
    if (cleanPin.length !== 4) {
      return {
        success: false,
        errorCode: 'PIN_REQUIRED',
        message: 'Please provide a 4-digit PIN to secure your nickname.'
      };
    }

    room.userPins.set(normalized, cleanPin);

    const player = this.createPlayerModel(
      socket.id,
      cleanName,
      avatar,
      cleanPin,
      false,
      room.players.size % 2 === 0 ? 'red' : 'blue'
    );

    room.players.set(socket.id, player);
    socket.join(room.code);
    socket.roomCode = room.code;

    console.log(`👤 Player Joined: ${player.name} joined room [${room.code}] with registered PIN`);
    roomManager.broadcastRoomUpdate(room.code);

    return { success: true, room: RoomBroadcaster.getRoomDTO(room) };
  }

  /**
   * Handle player disconnect: away badge timers in lobby (2m/5m) or mid-game reconnection timer.
   */
  static handleDisconnect(roomManager, socket, room) {
    const player = room.players.get(socket.id);
    if (!player) return;

    const code = room.code;
    const playerName = player.name || socket.id;

    if (room.gameState === 'lobby') {
      player.connected = false;
      player.isAway = true;
      player.hiddenFromLobby = false;
      console.log(`😴 Player Away in Lobby: ${playerName} (Away badge 0-2m, hidden 2-5m, cleared at 5m)`);

      this.clearPlayerTimers(player);

      // Timer 1: At 2 minutes, hide from lobby UI list (keep game data)
      player._hideTimer = setTimeout(() => {
        if (!roomManager.rooms.has(code)) return;
        const currentRoom = roomManager.rooms.get(code);
        const currentPlayer = currentRoom.players.get(player.id);
        if (!currentPlayer || currentPlayer.connected !== false) return;

        console.log(`🙈 Player hidden from lobby UI after 2 min Away: ${playerName} (Data preserved until 5 min)`);
        currentPlayer.hiddenFromLobby = true;

        // If this player was Host, pass host role to an active connected player
        if (currentRoom.hostId === player.id) {
          const nextActiveHost = Array.from(currentRoom.players.values()).find(p => p.connected && !p.hiddenFromLobby);
          if (nextActiveHost) {
            nextActiveHost.isHost = true;
            currentPlayer.isHost = false;
            currentRoom.hostId = nextActiveHost.id;
            if (currentRoom.gameInstance && 'hostSocketId' in currentRoom.gameInstance) {
              currentRoom.gameInstance.hostSocketId = nextActiveHost.id;
            }
            console.log(`👑 Host transferred to active player: ${nextActiveHost.name}`);
          }
        }
        roomManager.broadcastRoomUpdate(code);
      }, LOBBY_AWAY_UI_MS);

      // Timer 2: At 5 minutes total (2m + 3m extra), clean up user game data
      player._cleanupTimer = setTimeout(() => {
        if (!roomManager.rooms.has(code)) return;
        const currentRoom = roomManager.rooms.get(code);
        const currentPlayer = currentRoom.players.get(player.id);
        if (!currentPlayer || currentPlayer.connected !== false) return;

        console.log(`🧹 5-Min Expiry: Clearing user data for ${playerName} in room [${code}]`);
        currentRoom.players.delete(player.id);

        if (currentRoom.players.size === 0) {
          roomManager.rooms.delete(code);
          console.log(`🧹 Room Deleted: [${code}] (empty)`);
        } else {
          if (currentRoom.hostId === player.id) {
            const nextHost = Array.from(currentRoom.players.values()).find(p => p.connected && !p.hiddenFromLobby) || currentRoom.players.values().next().value;
            if (nextHost) {
              nextHost.isHost = true;
              currentRoom.hostId = nextHost.id;
            }
          }
          roomManager.broadcastRoomUpdate(code);
        }
      }, USER_DATA_CLEANUP_MS);

      // Broadcast update immediately so player has Away badge in 0-2m
      roomManager.broadcastRoomUpdate(code);
    } else {
      // Disconnect mid-game: player can seamlessly reconnect at any time during match (15 min grace)
      player.connected = false;
      player.isAway = true;
      console.log(`🔌 Player Disconnected Mid-Game: ${playerName} (Can reconnect and claim spot within 15 min)`);

      if (player._cleanupTimer) clearTimeout(player._cleanupTimer);
      const graceMs = MIDGAME_DISCONNECT_GRACE_MS || (15 * 60 * 1000);
      player._cleanupTimer = setTimeout(() => {
        if (!roomManager.rooms.has(code)) return;
        const currentRoom = roomManager.rooms.get(code);
        const currentPlayer = currentRoom.players.get(player.id);
        if (!currentPlayer || currentPlayer.connected !== false) return;

        console.log(`🧹 Mid-Game Expiry: Clearing game data for ${playerName} in room [${code}]`);
        currentRoom.players.delete(player.id);
        roomManager.broadcastRoomUpdate(code);
        if (currentRoom.gameState === 'playing') {
          roomManager.broadcastGameState(code);
        }
      }, graceMs);
    }
  }
}

module.exports = PlayerManager;
