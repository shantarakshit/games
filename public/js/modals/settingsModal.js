/**
 * Game House Rules & Settings Modal Controller
 */

const SettingsModal = {
  serverInfo: null,

  init(serverInfoRef) {
    this.serverInfo = serverInfoRef;

    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const modalSettings = document.getElementById('modalSettings');

    if (btnOpenSettings) {
      btnOpenSettings.onclick = () => {
        SoundFX.playClick();
        this.open();
      };
    }

    if (btnSaveSettings) {
      btnSaveSettings.onclick = () => {
        this.save();
      };
    }

    if (btnCloseSettings) {
      btnCloseSettings.onclick = () => {
        SoundFX.playClick();
        if (modalSettings) modalSettings.classList.add('hidden');
      };
    }
  },

  setServerInfo(info) {
    this.serverInfo = info;
  },

  open() {
    if (!ClientState.currentRoom || !ClientState.currentRoom.gameId || !this.serverInfo) return;

    const game = this.serverInfo.games.find(g => g.id === ClientState.currentRoom.gameId);
    if (!game || !game.settingsSchema) return;

    const roomSettings = (ClientState.currentRoom.settings && ClientState.currentRoom.settings[game.id]) || {};
    const settingsSchemaContainer = document.getElementById('settingsSchemaContainer');
    const modalSettings = document.getElementById('modalSettings');

    if (settingsSchemaContainer) {
      settingsSchemaContainer.innerHTML = '';
      game.settingsSchema.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'setting-item';

        const label = document.createElement('label');
        label.innerText = item.label;

        const currentValue = roomSettings[item.id] !== undefined ? roomSettings[item.id] : item.default;

        let select = document.createElement('select');
        select.className = 'form-control';
        select.dataset.settingId = item.id;

        item.options.forEach(opt => {
          const optionEl = document.createElement('option');
          optionEl.value = opt.value;
          optionEl.innerText = opt.label;
          if (String(opt.value) === String(currentValue)) {
            optionEl.selected = true;
          }
          select.appendChild(optionEl);
        });

        const desc = document.createElement('div');
        desc.className = 'setting-desc';
        desc.innerText = item.description;

        itemContainer.appendChild(label);
        itemContainer.appendChild(select);
        itemContainer.appendChild(desc);
        settingsSchemaContainer.appendChild(itemContainer);
      });
    }

    if (modalSettings) modalSettings.classList.remove('hidden');
  },

  save() {
    SoundFX.playChime();
    const gameId = ClientState.currentRoom.gameId;
    const newSettings = {};
    const settingsSchemaContainer = document.getElementById('settingsSchemaContainer');
    const modalSettings = document.getElementById('modalSettings');

    if (settingsSchemaContainer) {
      const selects = settingsSchemaContainer.querySelectorAll('select');
      selects.forEach(select => {
        const id = select.dataset.settingId;
        let val = select.value;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(val) && val !== '') val = Number(val);
        newSettings[id] = val;
      });
    }

    socket.emit('update_settings', { gameId, settings: newSettings });
    if (modalSettings) modalSettings.classList.add('hidden');
  }
};

window.openSettingsModal = () => SettingsModal.open();
