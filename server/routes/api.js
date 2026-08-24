const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const NetworkDetector = require('../core/NetworkDetector');
const GameRegistry = require('../core/GameRegistry');
const { PORT } = require('../config');

/**
 * Dynamic Base URL Resolver (supports Localhost/LAN Wi-Fi IP and Cloud hosting like Render)
 */
function getBaseUrl(reqOrSocket) {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  let host = null;
  let proto = 'http';

  if (reqOrSocket) {
    const headers = reqOrSocket.headers || (reqOrSocket.handshake && reqOrSocket.handshake.headers);
    if (headers && headers.host) {
      host = headers.host;
      proto = headers['x-forwarded-proto'] || (reqOrSocket.socket && reqOrSocket.socket.encrypted ? 'https' : 'http');
    }
  }

  // If host is loopback (localhost / 127.0.0.1 / ::1), use local LAN IP so phones scanning QR can connect
  if (!host || /^(localhost|127\.0\.0\.1|::1)(:\d+)?$/i.test(host)) {
    const primaryIP = NetworkDetector.getPrimaryIP();
    return `http://${primaryIP}:${PORT}`;
  }

  return `${proto}://${host}`;
}

/**
 * Configure and register HTTP routes
 * @param {express.Application} app 
 * @param {import('../core/RoomManager')} roomManager 
 */
function createApiRouter(roomManager) {
  const router = express.Router();

  // Network IP & Server Info Endpoint
  router.get('/info', async (req, res) => {
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

  // QR Code Generator for specific URLs
  router.get('/qrcode', async (req, res) => {
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

  // Server Reset Endpoint — disconnects all sockets, clears all rooms
  router.all('/reset', (req, res) => {
    const result = roomManager.resetAll();
    console.log(`🔄 /api/reset called — cleared ${result.roomCount} rooms, disconnected ${result.socketCount} players.`);
    res.json({
      success: true,
      message: `Server reset complete. Cleared ${result.roomCount} room(s) and disconnected ${result.socketCount} player(s). Next person to join becomes the host.`,
      ...result
    });
  });

  return router;
}

module.exports = {
  createApiRouter,
  getBaseUrl
};
