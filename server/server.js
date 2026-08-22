const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');

const NetworkDetector = require('./core/NetworkDetector');
const GameRegistry = require('./core/GameRegistry');
const RoomManager = require('./core/RoomManager');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize Game Registry
GameRegistry.loadGames();

// Initialize Room Manager
const roomManager = new RoomManager(io);

// Middleware & Static Files
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Dynamic Base URL Resolver (supports Localhost, local Wi-Fi IP, and Cloud hosting like Render)
function getBaseUrl(req) {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  if (req && req.headers && req.headers.host) {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http');
    return `${proto}://${host}`;
  }
  const primaryIP = NetworkDetector.getPrimaryIP();
  return `http://${primaryIP}:${PORT}`;
}

// Network IP & Info Endpoint
app.get('/api/info', async (req, res) => {
  const primaryIP = NetworkDetector.getPrimaryIP();
  const allIPs = NetworkDetector.getLocalIPs();
  const hostUrl = getBaseUrl(req);

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(hostUrl);
  } catch (err) {
    console.error('QR code generation failed:', err);
  }

  res.json({
    primaryIP,
    allIPs,
    port: PORT,
    hostUrl,
    qrCodeDataUrl,
    games: GameRegistry.getGameList()
  });
});

// QR Code Generator for specific Room URLs
app.get('/api/qrcode', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    targetUrl = getBaseUrl(req);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(targetUrl);
    res.json({ qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Single Page App Routing for Join Links
app.get(['/join/:code', '/room/:code'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Server Reset Endpoint — disconnects all sockets, clears all rooms
// Usage: GET or POST /api/reset
// The next player to connect will become host of a fresh room.
app.all('/api/reset', (req, res) => {
  const result = roomManager.resetAll();
  console.log(`🔄 /api/reset called — cleared ${result.roomCount} rooms, disconnected ${result.socketCount} players.`);
  res.json({
    success: true,
    message: `Server reset complete. Cleared ${result.roomCount} room(s) and disconnected ${result.socketCount} player(s). Next person to join becomes the host.`,
    ...result
  });
});

// Socket.io Connection Handlers
io.on('connection', (socket) => {
  console.log(`🔌 Client Connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', (data, callback) => {
    const room = roomManager.createRoom(socket, data.playerName, data.avatar);
    const hostHeader = socket.handshake.headers.host;
    const protoHeader = socket.handshake.headers['x-forwarded-proto'] || 'http';
    const baseUrl = process.env.PUBLIC_URL || (hostHeader ? `${protoHeader}://${hostHeader}` : `http://${NetworkDetector.getPrimaryIP()}:${PORT}`);
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
          callback({ success: true, roomCode: room.code, joinUrl, room: roomManager.getRoomDTO(room) });
        }
      });
  });

  // Join Room
  socket.on('join_room', (data, callback) => {
    const result = roomManager.joinRoom(socket, data.roomCode, data.playerName, data.avatar);
    if (callback) callback(result);
  });

  // Select Game
  socket.on('select_game', (data) => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      roomManager.selectGame(roomCode, data.gameId);
    }
  });

  // Update Game Settings
  socket.on('update_settings', (data) => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      roomManager.updateRoomSettings(roomCode, data.gameId, data.settings);
    }
  });

  // Start Game
  socket.on('start_game', () => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      roomManager.startGame(roomCode);
    }
  });

  // Return to Lobby (Host only)
  socket.on('return_to_lobby', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const room = roomManager.rooms.get(roomCode);
    if (!room) return;
    // Only the host can bring everyone back to lobby
    if (room.hostId !== socket.id) return;
    roomManager.returnToLobby(roomCode);
  });

  // Transfer Host Role (Host only)
  socket.on('transfer_host', (data, callback) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !data) return;
    const targetId = data.targetId || data.newHostId;
    const result = roomManager.transferHost(roomCode, socket.id, targetId);
    if (callback) callback(result);
  });

  // Kick Player from Lobby (Host only)
  socket.on('kick_player', (data, callback) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const result = roomManager.kickPlayer(roomCode, socket.id, data.targetId);
    if (callback) callback(result);
  });

  // Game Specific Action
  socket.on('game_action', (data) => {
    roomManager.handleGameAction(socket, data.action, data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client Disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

// Start HTTP Server
server.listen(PORT, '0.0.0.0', () => {
  const primaryIP = NetworkDetector.getPrimaryIP();
  console.log('\n==================================================');
  console.log('🚀 PARTY GAMES HUB SERVER IS READY!');
  console.log(`📱 Local Wi-Fi Join URL:  http://${primaryIP}:${PORT}`);
  console.log(`💻 Localhost Join URL:    http://localhost:${PORT}`);
  console.log('==================================================\n');
});
