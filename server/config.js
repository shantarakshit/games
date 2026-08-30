/**
 * Server Configuration & Global Constants
 */
module.exports = {
  PORT: process.env.PORT || 3000,
  LOBBY_AWAY_UI_MS: 3 * 60 * 1000,          // 3 minutes in lobby (0-3m: visible with Away badge; 3m+: hidden from lobby list)
  USER_DATA_CLEANUP_MS: 15 * 60 * 1000,     // 15 minutes in lobby before clearing unpinned/abandoned session
  MIDGAME_DISCONNECT_GRACE_MS: 15 * 60 * 1000, // 15 minutes mid-game grace period
  DEFAULT_ROOM_CODE_LENGTH: 4,
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
};
