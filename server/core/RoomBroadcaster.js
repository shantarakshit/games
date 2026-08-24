/**
 * RoomBroadcaster
 * Handles serialization of Room state to client DTOs and socket broadcasts.
 */
class RoomBroadcaster {
  /**
   * Convert room object into sanitized DTO for client consumption.
   * @param {Object} room 
   * @returns {Object}
   */
  static getRoomDTO(room) {
    if (!room) return null;

    const visiblePlayers = (room.gameState === 'lobby')
      ? Array.from(room.players.values()).filter(p => p.hiddenFromLobby !== true)
      : Array.from(room.players.values());

    return {
      code: room.code,
      hostId: room.hostId,
      gameId: room.gameId,
      gameState: room.gameState,
      settings: room.settings,
      players: visiblePlayers.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost,
        isReady: p.isReady,
        team: p.team || 'red',
        role: p.role || 'operative',
        connected: p.connected !== false,
        isAway: Boolean(p.isAway || p.connected === false)
      }))
    };
  }

  /**
   * Broadcast current room update to all sockets in the room.
   * @param {import('socket.io').Server} io 
   * @param {Object} room 
   */
  static broadcastRoomUpdate(io, room) {
    if (!io || !room) return;
    const dto = this.getRoomDTO(room);
    io.to(room.code).emit('room_updated', dto);
  }

  /**
   * Broadcast customized player-specific game state to each connected player in the room.
   * @param {import('socket.io').Server} io 
   * @param {Object} room 
   */
  static broadcastGameState(io, room) {
    if (!io || !room || !room.gameInstance) return;

    for (const [socketId, player] of room.players.entries()) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        const playerState = room.gameInstance.getPlayerState(socketId, player, room);
        socket.emit('game_state_updated', playerState);
      }
    }
  }

  /**
   * Broadcast game specific events to room or targeted sockets.
   * @param {import('socket.io').Server} io 
   * @param {Object} room 
   * @param {string} event 
   * @param {*} data 
   */
  static broadcastGameEvent(io, room, event, data) {
    if (!io || !room) return;

    if (event === 'play_boo_sound_targeted' && data && Array.isArray(data.targetSockets)) {
      data.targetSockets.forEach(sId => {
        const socket = io.sockets.sockets.get(sId);
        if (socket) socket.emit('play_boo_sound');
      });
      return;
    }

    io.to(room.code).emit(event, data);
  }
}

module.exports = RoomBroadcaster;
