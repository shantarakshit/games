/**
 * 4-Digit PIN Authentication Modal Controller
 */

const PinAuthModal = {
  pendingAuth: {
    targetRoomCode: '',
    playerName: '',
    avatar: '',
    mode: 'create' // 'create' | 'verify'
  },

  init() {
    const formPinAuth = document.getElementById('formPinAuth');
    const btnSubmitPinAuth = document.getElementById('btnSubmitPinAuth');
    const btnCancelPinAuth = document.getElementById('btnCancelPinAuth');
    const inputPlayerName = document.getElementById('inputPlayerName');
    const modalPinAuth = document.getElementById('modalPinAuth');

    if (formPinAuth) {
      formPinAuth.onsubmit = (e) => {
        e.preventDefault();
        this.submit();
      };
    }
    if (btnSubmitPinAuth) {
      btnSubmitPinAuth.onclick = (e) => {
        e.preventDefault();
        this.submit();
      };
    }
    if (btnCancelPinAuth) {
      btnCancelPinAuth.onclick = () => {
        if (modalPinAuth) modalPinAuth.classList.add('hidden');
        if (inputPlayerName) inputPlayerName.focus();
      };
    }
  },

  open(mode, playerName, targetRoomCode, avatar) {
    this.pendingAuth = {
      targetRoomCode,
      playerName,
      avatar,
      mode
    };

    const modalPinAuth = document.getElementById('modalPinAuth');
    const inputPinCode = document.getElementById('inputPinCode');
    const pinAuthIcon = document.getElementById('pinAuthIcon');
    const pinAuthModalTitle = document.getElementById('pinAuthModalTitle');
    const pinAuthModalSubtitle = document.getElementById('pinAuthModalSubtitle');
    const pinAuthError = document.getElementById('pinAuthError');
    const btnSubmitPinAuth = document.getElementById('btnSubmitPinAuth');

    if (pinAuthError) {
      pinAuthError.classList.add('hidden');
      pinAuthError.innerText = '';
    }

    if (mode === 'verify') {
      if (pinAuthIcon) pinAuthIcon.innerText = '🔑';
      if (pinAuthModalTitle) pinAuthModalTitle.innerText = `Enter PIN for ${playerName}`;
      if (pinAuthModalSubtitle) pinAuthModalSubtitle.innerText = `Welcome back! Enter your 4-digit PIN to re-enter your game.`;
      if (btnSubmitPinAuth) btnSubmitPinAuth.innerText = 'Re-enter Game';
    } else {
      if (pinAuthIcon) pinAuthIcon.innerText = '🔒';
      if (pinAuthModalTitle) pinAuthModalTitle.innerText = `Set Security PIN for ${playerName}`;
      if (pinAuthModalSubtitle) pinAuthModalSubtitle.innerText = `Create a 4-digit PIN to protect your nickname and reconnect if you refresh.`;
      if (btnSubmitPinAuth) btnSubmitPinAuth.innerText = 'Create PIN & Enter';
    }

    // Prefill PIN if same nickname is stored locally
    const lastSavedName = localStorage.getItem('party_last_name');
    const lastSavedPin = localStorage.getItem('party_last_pin');
    if (inputPinCode) {
      if (lastSavedName && lastSavedName.toLowerCase() === playerName.toLowerCase() && lastSavedPin && lastSavedPin.length === 4) {
        inputPinCode.value = lastSavedPin;
      } else {
        inputPinCode.value = '';
      }
    }

    if (modalPinAuth) {
      modalPinAuth.classList.remove('hidden');
      setTimeout(() => {
        if (inputPinCode) {
          inputPinCode.focus();
          inputPinCode.select();
        }
      }, 100);
    }
  },

  submit() {
    const inputPinCode = document.getElementById('inputPinCode');
    const pinAuthError = document.getElementById('pinAuthError');
    const modalPinAuth = document.getElementById('modalPinAuth');

    const rawPin = inputPinCode ? inputPinCode.value.trim().replace(/\D/g, '') : '';
    if (rawPin.length !== 4) {
      if (pinAuthError) {
        pinAuthError.innerText = 'Please enter a complete 4-digit PIN.';
        pinAuthError.classList.remove('hidden');
      }
      return;
    }

    SoundFX.playClick();
    const { targetRoomCode, playerName, avatar } = this.pendingAuth;

    socket.emit('join_room', {
      roomCode: targetRoomCode,
      playerName,
      avatar,
      pin: rawPin
    }, (res) => {
      if (res && res.success) {
        localStorage.setItem('party_last_pin', rawPin);
        this.handleSuccessfulAuth(res);
      } else if (res && res.errorCode === 'INVALID_PIN') {
        if (pinAuthError) {
          pinAuthError.innerText = res.message || 'Incorrect 4-digit PIN for this nickname.';
          pinAuthError.classList.remove('hidden');
        }
        if (inputPinCode) {
          inputPinCode.select();
          inputPinCode.focus();
        }
      } else {
        // No active room exists, create fresh room as Host with this PIN
        socket.emit('create_room', {
          playerName,
          avatar,
          pin: rawPin
        }, (cRes) => {
          if (cRes && cRes.success) {
            localStorage.setItem('party_last_pin', rawPin);
            if (modalPinAuth) modalPinAuth.classList.add('hidden');
            ClientState.roomCode = cRes.roomCode;
            ClientState.isHost = true;
            if (typeof LobbyUI !== 'undefined' && LobbyUI.render) {
              LobbyUI.render(cRes.room);
            } else if (typeof updateLobbyUI === 'function') {
              updateLobbyUI(cRes.room);
            }
            showView('viewLobby');
          } else if (pinAuthError) {
            pinAuthError.innerText = (cRes && cRes.message) || 'Failed to create room.';
            pinAuthError.classList.remove('hidden');
          }
        });
      }
    });
  },

  handleSuccessfulAuth(res) {
    const modalPinAuth = document.getElementById('modalPinAuth');
    if (modalPinAuth) modalPinAuth.classList.add('hidden');

    ClientState.roomCode = res.room.code;
    ClientState.isHost = res.room.hostId === socket.id;

    if (typeof LobbyUI !== 'undefined' && LobbyUI.render) {
      LobbyUI.render(res.room);
    } else if (typeof updateLobbyUI === 'function') {
      updateLobbyUI(res.room);
    }

    if (res.room.gameState === 'playing' && res.room.gameId) {
      if (res.room.gameId === 'codenames') {
        showView('viewCodenames');
      } else if (res.room.gameId === 'spy') {
        showView('viewSpy');
      } else if (res.room.gameId === 'mafia') {
        showView('viewMafia');
      }
    } else {
      showView('viewLobby');
    }
  }
};

window.openPinAuthModal = (mode, playerName, targetRoomCode, avatar) => {
  PinAuthModal.open(mode, playerName, targetRoomCode, avatar);
};
