const QRCode = require('qrcode');
const { getBaseUrl } = require('../routes/api');

/**
 * Register Socket.IO connection and room event listeners
 * @param {import('socket.io').Server} io 
 * @param {import('../core/RoomManager')} roomManager 
 */
function registerSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client Connected: ${socket.id}`);

    // Check Username Existence for PIN Mode (Create vs Verify)
    socket.on('check_user', (data, callback) => {
      const result = roomManager.checkUsername(data ? data.roomCode : null, data ? data.playerName : null);
      if (callback) callback(result);
    });

    // Create Room
    socket.on('create_room', (data, callback) => {
      const room = roomManager.createRoom(
        socket,
        data ? data.playerName : null,
        data ? data.avatar : null,
        data ? data.pin : null
      );
      const baseUrl = getBaseUrl(socket);
      const joinUrl = `${baseUrl}/join/${room.code}`;

      QRCode.toDataURL(joinUrl)
        .then(qrCode => {
          if (callback) {
            callback({
              success: true,
              roomCode: room.code,
              joinUrl,
              qrCode,
              room: roomManager.getRoomDTO(room)
            });
          }
        })
        .catch(() => {
          if (callback) {
            callback({
              success: true,
              roomCode: room.code,
              joinUrl,
              room: roomManager.getRoomDTO(room)
            });
          }
        });
    });

    // Join Room
    socket.on('join_room', (data, callback) => {
      const result = roomManager.joinRoom(
        socket,
        data ? data.roomCode : null,
        data ? data.playerName : null,
        data ? data.avatar : null,
        data ? data.pin : null
      );
      if (callback) callback(result);
    });

    // Select Game (Host only)
    socket.on('select_game', (data) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !data) return;
      const room = roomManager.rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      roomManager.selectGame(roomCode, data.gameId);
    });

    // Update Game Settings (Host only)
    socket.on('update_settings', (data) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !data) return;
      const room = roomManager.rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      roomManager.updateRoomSettings(roomCode, data.gameId, data.settings);
    });

    // Start Game (Host only)
    socket.on('start_game', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) return;
      const room = roomManager.rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      roomManager.startGame(roomCode);
    });

    // Return to Lobby (Host only)
    socket.on('return_to_lobby', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) return;
      const room = roomManager.rooms.get(roomCode);
      if (!room) return;
      if (room.hostId !== socket.id) return;
      roomManager.returnToLobby(roomCode);
    });

    // Transfer Host Role (Host only)
    socket.on('transfer_host', (data, callback) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !data) return;
      const targetId = data.targetId || data.newHostId || data.targetPlayerId;
      const result = roomManager.transferHost(roomCode, socket.id, targetId);
      if (callback) callback(result);
    });

    // Kick Player from Lobby (Host only)
    socket.on('kick_player', (data, callback) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !data) return;
      const result = roomManager.kickPlayer(roomCode, socket.id, data.targetId);
      if (callback) callback(result);
    });

    // Explicit Player Leave Room
    socket.on('leave_room', (callback) => {
      const result = roomManager.leaveRoom(socket);
      if (callback) callback(result);
    });

    // Game Specific Action
    socket.on('game_action', (data) => {
      if (data && typeof data === 'object' && typeof data.action === 'string') {
        roomManager.handleGameAction(socket, data.action, data);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Client Disconnected: ${socket.id}`);
      roomManager.handleDisconnect(socket);
    });
  });
}

module.exports = { registerSocketHandlers };
