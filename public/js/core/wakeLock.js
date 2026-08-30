/**
 * Screen Wake Lock Manager
 * Prevents mobile screens from dimming or locking during active games.
 */
const WakeLockManager = {
  sentinel: null,
  isActive: false,

  async requestLock() {
    this.isActive = true;
    if ('wakeLock' in navigator) {
      try {
        if (!this.sentinel) {
          this.sentinel = await navigator.wakeLock.request('screen');
          this.sentinel.addEventListener('release', () => {
            this.sentinel = null;
          });
          console.log('📱 Screen Wake Lock active (preventing device sleep)');
        }
      } catch (err) {
        console.warn('Wake Lock request skipped/failed:', err);
      }
    }
  },

  async releaseLock() {
    this.isActive = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (e) {}
      this.sentinel = null;
      console.log('📱 Screen Wake Lock released');
    }
  },

  init() {
    // Re-request wake lock when page returns to foreground if match is active
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isActive) {
        this.requestLock();
      }
    });
  }
};
