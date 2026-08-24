const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { PORT } = require('./config');
const NetworkDetector = require('./core/NetworkDetector');
const GameRegistry = require('./core/GameRegistry');
const RoomManager = require('./core/RoomManager');
const { createApiRouter } = require('./routes/api');
const { registerSocketHandlers } = require('./sockets/socketHandler');

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,
  pingTimeout: 60000
});

// Initialize Game Registry & Room Manager
GameRegistry.loadGames();
const roomManager = new RoomManager(io);

// Middleware & Static Assets
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes & Single Page App Join Links
app.use('/api', createApiRouter(roomManager));
app.get(['/join', '/join/:code', '/room', '/room/:code'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Register Socket.io Connection & Room Handlers
registerSocketHandlers(io, roomManager);

// Start HTTP Server
server.listen(PORT, '0.0.0.0', () => {
  const primaryIP = NetworkDetector.getPrimaryIP();
  console.log('\n==================================================');
  console.log('🚀 PARTY GAMES HUB SERVER IS READY!');
  console.log(`📱 Local Wi-Fi Join URL:  http://${primaryIP}:${PORT}`);
  console.log(`💻 Localhost Join URL:    http://localhost:${PORT}`);
  console.log('==================================================\n');
});

module.exports = { app, server, io, roomManager };
