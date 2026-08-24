/**
 * Share Link & QR Code Modal Controller
 */

const ShareModal = {
  getJoinUrl() {
    return window.location.origin;
  },

  init() {
    const btnQRHeader = document.getElementById('btnQRHeader');
    const btnCloseQR = document.getElementById('btnCloseQR');
    const btnCopyUrl = document.getElementById('btnCopyUrl');
    const modalQR = document.getElementById('modalQR');

    if (btnQRHeader) btnQRHeader.onclick = () => this.open();
    if (btnCloseQR) btnCloseQR.onclick = () => { if (modalQR) modalQR.classList.add('hidden'); };
    if (btnCopyUrl) {
      btnCopyUrl.onclick = (e) => this.triggerCopyLink(e.currentTarget);
    }
  },

  open() {
    SoundFX.playClick();
    const url = this.getJoinUrl();
    const modalUrlInput = document.getElementById('modalUrlInput');
    const modalQRImg = document.getElementById('modalQRImg');
    const modalQR = document.getElementById('modalQR');
    const btnMessengerShare = document.getElementById('btnMessengerShare');

    if (modalUrlInput) modalUrlInput.value = url;

    // Use Web Share API on mobile or clipboard copy on desktop
    if (btnMessengerShare) {
      btnMessengerShare.onclick = async (e) => {
        e.preventDefault();
        SoundFX.playClick();
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Join my Party Game!',
              text: `Join the party room on Party Games Hub: ${url}`,
              url: url
            });
            return;
          } catch (_) {}
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          }
        } catch (_) {}
        if (typeof showCustomToast === 'function') {
          showCustomToast('📋 Link copied to clipboard!');
        }
      };
    }

    fetch(`/api/qrcode?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (modalQRImg) modalQRImg.src = data.qrDataUrl;
        if (modalQR) modalQR.classList.remove('hidden');
      })
      .catch(err => {
        console.warn('QR code generation fetch failed:', err);
        if (modalQR) modalQR.classList.remove('hidden');
      });
  },

  async triggerCopyLink(btnEl) {
    SoundFX.playClick();
    const url = this.getJoinUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }

    if (btnEl) {
      const origText = btnEl.innerText;
      btnEl.innerText = 'Copied! ✔️';
      setTimeout(() => {
        btnEl.innerText = origText;
      }, 2000);
    }
  }
};

window.openShareModal = () => ShareModal.open();
