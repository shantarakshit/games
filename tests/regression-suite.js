const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const { io } = require('socket.io-client');

const GameRegistry = require('../server/core/GameRegistry');
const RoomManager = require('../server/core/RoomManager');
const { registerSocketHandlers } = require('../server/sockets/socketHandler');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let activeServer = null;
let SERVER_URL = 'http://127.0.0.1:3000';

async function setupTestServer() {
  // Check if server is already running on port 3000
  const isRunning = await new Promise(resolve => {
    const req = http.get('http://127.0.0.1:3000/api/info', res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
  });

  if (isRunning) {
    SERVER_URL = 'http://127.0.0.1:3000';
    return;
  }

  // Spin up an ephemeral test server on port 3999
  const app = express();
  const server = http.createServer(app);
  const ioServer = new Server(server, { cors: { origin: '*' } });

  GameRegistry.loadGames();
  const roomManager = new RoomManager(ioServer);
  registerSocketHandlers(ioServer, roomManager);

  await new Promise(resolve => server.listen(3999, '127.0.0.1', resolve));
  activeServer = server;
  SERVER_URL = 'http://127.0.0.1:3999';
}

function createClient(name, avatar = '😎') {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true
    });

    socket.playerName = name;
    socket.avatar = avatar;
    socket.receivedEvents = [];

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));

    ['room_updated', 'game_state_updated', 'timer_tick', 'kicked_from_room', 'custom_alert', 'pin_verified', 'codenames_card_sound', 'system_message'].forEach(ev => {
      socket.on(ev, (data) => {
        socket.receivedEvents.push({ event: ev, data, time: Date.now() });
      });
    });
  });
}

function getLatestState(socket) {
  const states = socket.receivedEvents.filter(e => e.event === 'game_state_updated');
  return states.length > 0 ? states[states.length - 1].data : null;
}

async function waitForState(socket, predicate, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const latest = getLatestState(socket);
    if (latest && predicate(latest)) return latest;
    await delay(50);
  }
  const last = getLatestState(socket);
  throw new Error(`Timeout waiting for state on ${socket.playerName}. Last state: ${JSON.stringify(last ? { phase: last.phase, winner: last.winner } : null)}`);
}

async function runRegression() {
  await setupTestServer();

  console.log('================================================================');
  console.log('🚀 PARTY GAMES HUB - AUTOMATED REGRESSION SUITE');
  console.log(`📡 Server Endpoint: ${SERVER_URL}`);
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion Failed: ${message}`);
    } else {
      passedTests++;
      console.log(`  ✔ [PASS] ${message}`);
    }
  }

  // --- SUITE 1: LOBBY & SECURITY ---
  console.log('\n--- [SUITE 1] Lobby, PIN Security & Host Privileges ---');
  {
    const host = await createClient('Host1', '👑');
    const p1 = await createClient('Bob', '🤠');
    const p2 = await createClient('Charlie', '🎩');

    let createAck = await new Promise(r => host.emit('create_room', { playerName: 'Host1', avatar: '👑', pin: '9876' }, r));
    assert(createAck && createAck.success && createAck.roomCode, 'Room created with 4-digit PIN');
    const roomCode = createAck.roomCode;

    let hijackAck = await new Promise(r => p1.emit('join_room', { roomCode, playerName: 'Host1', avatar: '🤠', pin: '0000' }, r));
    assert(hijackAck && !hijackAck.success && hijackAck.errorCode === 'INVALID_PIN', 'Nickname collision with wrong PIN blocked');

    let joinAck = await new Promise(r => p1.emit('join_room', { roomCode, playerName: 'Bob', avatar: '🤠', pin: '1234' }, r));
    assert(joinAck && joinAck.success, 'New player joined room with PIN');

    p1.disconnect();
    await delay(50);
    const p1Recon = await createClient('Bob', '🤠');
    let reconWrong = await new Promise(r => p1Recon.emit('join_room', { roomCode, playerName: 'Bob', avatar: '🤠', pin: '9999' }, r));
    assert(reconWrong && !reconWrong.success && reconWrong.errorCode === 'INVALID_PIN', 'Reconnection with wrong PIN blocked');

    let reconCorrect = await new Promise(r => p1Recon.emit('join_room', { roomCode, playerName: 'Bob', avatar: '🤠', pin: '1234' }, r));
    assert(reconCorrect && reconCorrect.success, 'Reconnection with correct PIN accepted');

    await new Promise(r => p2.emit('join_room', { roomCode, playerName: 'Charlie', avatar: '🎩', pin: '5678' }, r));
    host.emit('kick_player', { targetId: p2.id });
    await delay(100);
    assert(!!p2.receivedEvents.find(e => e.event === 'kicked_from_room'), 'Host successfully kicked player');

    host.disconnect();
    p1Recon.disconnect();
    p2.disconnect();
  }

  // --- SUITE 2: MAFIA COMPLETE MATCH ---
  console.log('\n--- [SUITE 2] Mafia: Roles, Doctor Save, Detective Inquiry & Victory ---');
  {
    const host = await createClient('HostM', '👑');
    const bots = [];
    for (let i = 1; i <= 6; i++) bots.push(await createClient(`MB_${i}`, '👤'));

    let hostCreate = await new Promise(r => host.emit('create_room', { playerName: host.playerName, avatar: host.avatar, pin: '1234' }, r));
    const roomCode = hostCreate.roomCode;

    for (const b of bots) {
      await new Promise(r => b.emit('join_room', { roomCode, playerName: b.playerName, avatar: b.avatar, pin: '1234' }, r));
    }

    host.emit('select_game', { gameId: 'mafia' });
    host.emit('update_settings', { gameId: 'mafia', settings: { murderersCount: 1, discussionTimer: 0, votingTimer: 0, eliminationMode: 'plurality' } });
    await delay(100);
    host.emit('start_game');
    await waitForState(host, s => s.phase === 'role_reveal');

    host.emit('game_action', { action: 'host_start_round_1' });
    await waitForState(host, s => s.phase === 'night');

    let doc = null, det = null, mur = null, civs = [];
    for (const b of bots) {
      const st = await waitForState(b, s => s.phase === 'night');
      if (st.myRole === 'doctor') doc = b;
      else if (st.myRole === 'detective') det = b;
      else if (st.myRole === 'murderer') mur = b;
      else civs.push(b);
    }

    assert(doc && det && mur && civs.length === 3, 'Roles allocated: 1 Murderer, 1 Doctor, 1 Detective, 3 Civilians');

    mur.emit('game_action', { action: 'murderer_vote', targetId: civs[0].id });
    doc.emit('game_action', { action: 'doctor_save', targetId: civs[0].id });
    det.emit('game_action', { action: 'detective_investigate', targetId: mur.id });

    const detState = await waitForState(det, s => s.detectiveData && s.detectiveData.currentInquiry);
    assert(detState.detectiveData.currentInquiry.isMurderer === true, 'Detective accurately identified Murderer');

    host.emit('game_action', { action: 'host_advance_phase' }); // morning_narration
    await waitForState(host, s => s.phase === 'morning_narration');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_morning
    const mornState = await waitForState(civs[0], s => s.phase === 'day_morning');
    assert(mornState.morningAnnouncement.wasSaved === true && !mornState.isEliminated, 'Doctor miracle save resolved at sunrise');

    host.emit('game_action', { action: 'host_advance_phase' }); // day_discussion
    await waitForState(host, s => s.phase === 'day_discussion');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_voting
    await waitForState(host, s => s.phase === 'day_voting');

    for (const b of bots) {
      if (b !== mur) b.emit('game_action', { action: 'submit_day_vote', targetId: mur.id });
    }
    mur.emit('game_action', { action: 'submit_day_vote', targetId: civs[0].id });
    await delay(100);

    host.emit('game_action', { action: 'host_end_voting' });
    await waitForState(host, s => s.phase === 'vote_narration');
    host.emit('game_action', { action: 'host_advance_phase' });

    const finalState = await waitForState(bots[0], s => s.winner === 'civilians' && s.phase === 'ended');
    assert(finalState.winner === 'civilians', 'Civilians Win triggered on eliminating last Murderer');

    host.disconnect();
    bots.forEach(b => b.disconnect());
  }

  // --- SUITE 3: MAFIA EDGE CASES ---
  console.log('\n--- [SUITE 3] Mafia Edge Cases: Consecutive Saves & Strict Majority ---');
  {
    const host = await createClient('HostM3', '👑');
    const bots = [];
    for (let i = 1; i <= 6; i++) bots.push(await createClient(`M3_${i}`, '👤'));

    let hostCreate = await new Promise(r => host.emit('create_room', { playerName: host.playerName, avatar: host.avatar, pin: '1234' }, r));
    const roomCode = hostCreate.roomCode;
    for (const b of bots) await new Promise(r => b.emit('join_room', { roomCode, playerName: b.playerName, avatar: b.avatar, pin: '1234' }, r));

    host.emit('select_game', { gameId: 'mafia' });
    host.emit('update_settings', { gameId: 'mafia', settings: { murderersCount: 1, discussionTimer: 0, votingTimer: 0, eliminationMode: 'majority' } });
    await delay(100);
    host.emit('start_game');
    await waitForState(host, s => s.phase === 'role_reveal');
    host.emit('game_action', { action: 'host_start_round_1' });
    await waitForState(host, s => s.phase === 'night');

    let doc = null;
    for (const b of bots) {
      const st = await waitForState(b, s => s.phase === 'night');
      if (st.myRole === 'doctor') doc = b;
    }

    doc.emit('game_action', { action: 'doctor_save', targetId: bots[0].id });
    host.emit('game_action', { action: 'host_advance_phase' }); // morning_narration
    await waitForState(host, s => s.phase === 'morning_narration');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_morning
    await waitForState(host, s => s.phase === 'day_morning');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_discussion
    await waitForState(host, s => s.phase === 'day_discussion');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_voting
    await waitForState(host, s => s.phase === 'day_voting');

    // 2 votes for B0, 2 votes for B1, 2 abstains
    bots[0].emit('game_action', { action: 'submit_day_vote', targetId: bots[1].id });
    bots[1].emit('game_action', { action: 'submit_day_vote', targetId: bots[0].id });
    bots[2].emit('game_action', { action: 'submit_day_vote', targetId: bots[0].id });
    bots[3].emit('game_action', { action: 'submit_day_vote', targetId: bots[1].id });
    bots[4].emit('game_action', { action: 'submit_day_vote', targetId: 'ABSTAIN' });
    bots[5].emit('game_action', { action: 'submit_day_vote', targetId: 'ABSTAIN' });
    await delay(100);

    host.emit('game_action', { action: 'host_end_voting' });
    await waitForState(host, s => s.phase === 'vote_narration');
    host.emit('game_action', { action: 'host_advance_phase' }); // day_tally
    const tallyState = await waitForState(host, s => s.phase === 'day_tally');
    assert(!tallyState.eliminatedInTallyId, 'Majority threshold failure resulted in 0 eliminations');

    host.emit('game_action', { action: 'host_advance_phase' }); // Round 2 Night
    await waitForState(host, s => s.phase === 'night' && s.round === 2);

    // Consecutive save prevention
    doc.emit('game_action', { action: 'doctor_save', targetId: bots[0].id });
    await delay(100);
    const docR2 = getLatestState(doc);
    assert(!docR2.doctorData || docR2.doctorData.currentSavedTargetId !== bots[0].id, 'Doctor consecutive save restriction enforced');

    host.disconnect();
    bots.forEach(b => b.disconnect());
  }

  // --- SUITE 4: SPY MATCH & BLIND MODE ---
  console.log('\n--- [SUITE 4] Spy: Blind Mode & Location Guess ---');
  {
    const host = await createClient('HostSpy', '👑');
    const sBots = [];
    for (let i = 1; i <= 3; i++) sBots.push(await createClient(`SB_${i}`, '🕵️'));

    let hostCreate = await new Promise(r => host.emit('create_room', { playerName: host.playerName, avatar: host.avatar, pin: '1234' }, r));
    const roomCode = hostCreate.roomCode;
    for (const b of sBots) await new Promise(r => b.emit('join_room', { roomCode, playerName: b.playerName, avatar: b.avatar, pin: '1234' }, r));

    host.emit('select_game', { gameId: 'spy' });
    host.emit('update_settings', { gameId: 'spy', settings: { spiesCount: 1, spyKnowledgeMode: 'blind', timer: 0, coverTyping: false } });
    await delay(100);
    host.emit('start_game');
    await waitForState(host, s => s.phase === 'discussion');

    let spy = null, inn = null;
    for (const b of [host, ...sBots]) {
      const st = await waitForState(b, s => s.phase === 'discussion');
      if (st.isSpy) spy = b;
      else if (!inn) inn = b;
    }

    assert(getLatestState(spy).category === '❓ BLIND SPY (No Category)', 'Blind Spy receives no category data');
    const secretLoc = getLatestState(inn).location;

    spy.emit('game_action', { action: 'spy_guess_location', location: secretLoc });
    const spyEnd = await waitForState(sBots[0], s => s.winner === 'impostors' && s.phase === 'ended');
    assert(spyEnd.winner === 'impostors', 'Spy correctly guessed location and won match');

    host.disconnect();
    sBots.forEach(b => b.disconnect());
  }

  // --- SUITE 5: CODENAMES ROLE RULES & SOFT ASSASSIN ---
  console.log('\n--- [SUITE 5] Codenames: Role Separation & Soft Assassin ---');
  {
    const host = await createClient('HostCN', '👑');
    const redOp = await createClient('RedOp', '🔴');
    const blueSpy = await createClient('BlueSpy', '🔵');
    const blueOp = await createClient('BlueOp', '🔷');

    const cnClients = [host, redOp, blueSpy, blueOp];
    let hostCreate = await new Promise(r => host.emit('create_room', { playerName: host.playerName, avatar: host.avatar, pin: '1234' }, r));
    const roomCode = hostCreate.roomCode;

    for (const c of [redOp, blueSpy, blueOp]) await new Promise(r => c.emit('join_room', { roomCode, playerName: c.playerName, avatar: c.avatar, pin: '1234' }, r));

    host.emit('game_action', { action: 'set_team', team: 'red' });
    redOp.emit('game_action', { action: 'set_team', team: 'red' });
    blueSpy.emit('game_action', { action: 'set_team', team: 'blue' });
    blueOp.emit('game_action', { action: 'set_team', team: 'blue' });
    await delay(100);

    host.emit('game_action', { action: 'claim_spymaster' });
    blueSpy.emit('game_action', { action: 'claim_spymaster' });
    await delay(100);

    host.emit('select_game', { gameId: 'codenames' });
    host.emit('update_settings', { gameId: 'codenames', settings: { startingTeamMode: 'red', timerPerTurn: 0, assassinMode: 'soft', guessLimitMode: 'strict' } });
    await delay(100);

    host.emit('start_game');
    await waitForState(host, s => s.currentRole === 'spymaster');

    // Operatives blocked from clues
    redOp.emit('game_action', { action: 'submit_clue', word: 'HACK', count: 1 });
    await delay(50);
    assert(!getLatestState(host).currentClue, 'Operatives blocked from giving clues');

    // Red Spymaster clue
    host.emit('game_action', { action: 'submit_clue', word: 'OCEAN', count: 1 });
    await waitForState(redOp, s => s.currentRole === 'operative');

    // Soft assassin
    const assassinCard = getLatestState(host).grid.find(c => c.type === 'assassin');
    redOp.emit('game_action', { action: 'guess_card', cardId: assassinCard.id });
    const afterAssassin = await waitForState(host, s => s.currentTurn === 'blue');
    assert(afterAssassin.winner === null, 'Soft Assassin passed turn without ending match');

    cnClients.forEach(c => c.disconnect());
  }

  console.log('\n================================================================');
  console.log(`🎉 REGRESSION SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (activeServer) {
    activeServer.close();
  }
}

runRegression().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ FATAL REGRESSION ERROR:', err);
  if (activeServer) activeServer.close();
  process.exit(1);
});
