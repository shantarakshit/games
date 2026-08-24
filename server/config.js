/**
 * Server Configuration & Global Constants
 */
module.exports = {
  PORT: process.env.PORT || 3000,
  LOBBY_AWAY_UI_MS: 2 * 60 * 1000,      // 2 minutes (0-2m: visible with Away badge; 2-5m: hidden from lobby list)
  USER_DATA_CLEANUP_MS: 5 * 60 * 1000,  // 5 minutes total (at 5m: completely clear user game data)
  DEFAULT_ROOM_CODE_LENGTH: 4,
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
};
