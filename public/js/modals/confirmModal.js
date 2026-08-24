/**
 * Custom Confirmation & Alert Dialog Modal
 */

window.showCustomConfirm = function (title, message, onConfirm) {
  const modal = document.getElementById('modalConfirm');
  const titleEl = document.getElementById('modalConfirmTitle');
  const messageEl = document.getElementById('modalConfirmMessage');
  const btnConfirm = document.getElementById('btnModalConfirm');
  const btnCancel = document.getElementById('btnModalCancel');

  if (!modal) return;

  if (titleEl) titleEl.innerText = title || 'Confirmation';
  if (messageEl) messageEl.innerText = message || 'Are you sure?';

  modal.classList.remove('hidden');

  if (btnConfirm) {
    btnConfirm.onclick = () => {
      SoundFX.playClick();
      modal.classList.add('hidden');
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => {
      SoundFX.playClick();
      modal.classList.add('hidden');
    };
  }
};
