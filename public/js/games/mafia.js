/**
 * Mafia Game Client Module
 * Master coordinator referencing Mafia sub-modules:
 * - MafiaHostPanel
 * - MafiaNightActions
 * - MafiaDayVoting
 * - MafiaTimeline
 */

// If MafiaUI is already defined from mafia/mafia.js, preserve it, otherwise define it
if (typeof MafiaUI === 'undefined') {
  // Coordinator is loaded via mafia/mafia.js
}
