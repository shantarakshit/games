/**
 * Game Rules & How-to-Play Modal Controller
 */

const RulesModal = {
  tabMap: {
    codenames: 'rulesCodenames',
    spy: 'rulesSpy',
    mafia: 'rulesMafia'
  },

  init() {
    const modalGameRules = document.getElementById('modalGameRules');
    const btnCloseRules = document.getElementById('btnCloseRules');
    const btnLobbyRules = document.getElementById('btnLobbyRules');
    const btnCNRules = document.getElementById('btnCNRules');
    const btnSpyRules = document.getElementById('btnSpyRules');
    const btnMafiaRules = document.getElementById('btnMafiaRules');

    if (btnLobbyRules) {
      btnLobbyRules.onclick = () => {
        SoundFX.playClick();
        const selectedGameId = (ClientState.currentRoom && ClientState.currentRoom.gameId) || 'codenames';
        this.open(this.tabMap[selectedGameId] || 'rulesCodenames');
      };
    }

    if (btnCNRules) btnCNRules.onclick = () => { SoundFX.playClick(); this.open('rulesCodenames'); };
    if (btnSpyRules) btnSpyRules.onclick = () => { SoundFX.playClick(); this.open('rulesSpy'); };
    if (btnMafiaRules) btnMafiaRules.onclick = () => { SoundFX.playClick(); this.open('rulesMafia'); };

    if (btnCloseRules) {
      btnCloseRules.onclick = () => {
        SoundFX.playClick();
        if (modalGameRules) modalGameRules.classList.add('hidden');
      };
    }

    if (modalGameRules) {
      const tabBtns = modalGameRules.querySelectorAll('.rules-tab-btn');
      tabBtns.forEach(btn => {
        btn.onclick = () => {
          SoundFX.playClick();
          const tabId = btn.dataset.gameTab || btn.dataset.tab;
          if (tabId) this.open(tabId);
        };
      });
    }
  },

  open(targetGameTab = 'rulesCodenames') {
    // If shorthand passed (e.g. 'codenames', 'spy', 'mafia')
    if (this.tabMap[targetGameTab]) {
      targetGameTab = this.tabMap[targetGameTab];
    }

    const modalGameRules = document.getElementById('modalGameRules');
    if (!modalGameRules) return;

    const tabs = modalGameRules.querySelectorAll('.rules-tab-btn');
    const contents = modalGameRules.querySelectorAll('.rules-tab-content');

    tabs.forEach(tab => {
      const tabId = tab.dataset.gameTab || tab.dataset.tab;
      tab.classList.toggle('active', tabId === targetGameTab);
    });

    contents.forEach(content => {
      content.classList.toggle('hidden', content.id !== targetGameTab);
    });

    modalGameRules.classList.remove('hidden');
  }
};

window.openRulesModal = (gameId) => {
  RulesModal.open(gameId);
};
