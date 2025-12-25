// roomManager.js
// Classic (1v1) + Royale combined

const {
  TIMERS,
  WINNING_SCORE,
  PHASES,

  MODES,
  MIN_LENGTH_1V1,
  MIN_LENGTH_ROYALE,
  ROYALE_ROUNDS,
  ROYALE_SCORES,
  ROYALE_DEFAULT_SCORE,
  ROYALE_MAX_PLAYERS,
} = require("./constants");

const { randomLetter, randId, generateRoomCode, validateMove } = require("./utils");

const rooms = Object.create(null);
const pendingMatches = Object.create(null); // 1v1 queue matches waiting for accept
let queue = []; // FIFO 1v1 matchmaking queue

// -------------------- Internal Helpers --------------------

const clearTimer = (id) => {
  if (id) clearTimeout(id);
};

const clearAllTimers = (room) => {
  if (!room) return;

  clearTimer(room.preTimeoutId);
  clearTimer(room.pickTimeoutId);
  clearTimer(room.roundTimeoutId);
  clearTimer(room.resultTimeoutId);

  room.preTimeoutId = null;
  room.pickTimeoutId = null;
  room.roundTimeoutId = null;
  room.resultTimeoutId = null;

  // Classic disconnect timers
  if (room.mode === MODES?.CLASSIC || room.mode == null) {
    clearTimer(room.p1DisconnectTimeoutId);
    clearTimer(room.p2DisconnectTimeoutId);
    room.p1DisconnectTimeoutId = null;
    room.p2DisconnectTimeoutId = null;
  }

  // Royale disconnect timers (optional grace)
  if (room.mode === MODES?.ROYALE && room.disconnectTimeouts) {
    for (const k of Object.keys(room.disconnectTimeouts)) {
      clearTimer(room.disconnectTimeouts[k]);
    }
    room.disconnectTimeouts = Object.create(null);
  }
};

const clearDisconnectTimerClassic = (room, role) => {
  if (!room) return;
  if (role === "p1") {
    clearTimer(room.p1DisconnectTimeoutId);
    room.p1DisconnectTimeoutId = null;
  } else {
    clearTimer(room.p2DisconnectTimeoutId);
    room.p2DisconnectTimeoutId = null;
  }
};

const getRoom = (code) => rooms[code];

// Classic identity helpers
const roleOfKey = (r, k) => (k === r.p1Key ? "p1" : k === r.p2Key ? "p2" : null);
const roleOfSocket = (r, id) => (r.p1 === id ? "p1" : r.p2 === id ? "p2" : null);
const opponentSocketId = (r, role) => (role === "p1" ? r.p2 : r.p1);

// Phase computation
const computePhase = (room) => {
  if (!room) return PHASES.LOBBY;
  if (room.matchOver) return PHASES.GAME_OVER;
  if (room.resultActive) return PHASES.ROUND_RESULT;
  if (room.preActive) return PHASES.PRE;
  if (room.roundActive) return PHASES.RACING;
  if (room.pickingActive) return PHASES.PICKING;
  return PHASES.LOBBY;
};

// -------------------- Royale Helpers --------------------

const getNextHost = (room) => {
  if (!room || !room.players) return null;
  return room.players.find((p) => p.connected);
};

const updateRoyaleHost = (io, room) => {
  const nextHost = getNextHost(room);
  if (nextHost) {
    room.hostId = nextHost.id;
    io.to(room.code).emit("host_update", { hostId: room.hostId });
  }
};

const sortLeaderboardCopy = (players) => [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

const broadcastRoyaleState = (io, room) => {
  if (!room || room.mode !== MODES.ROYALE) return;

  const playerList = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.id === room.hostId,
    connected: p.connected,
    ready: p.ready,

    finishedRound: !!p.finishedRound,
    roundPoints: p.roundPoints || 0,
  }));

  io.to(room.code).emit("royale_state_update", {
    phase: computePhase(room),
    players: playerList,
    round: room.currentRound,
    totalRounds: ROYALE_ROUNDS,
    letters: room.activeLetters,
    roundEndsAt: room.roundEndsAt,
    resultEndsAt: room.resultEndsAt,
    preEndsAt: room.preEndsAt,
  });
};

// NEW: Explicit Leave Room (button click)
const handleLeaveRoom = (io, code, room, socketId) => {
  if (!room) return;

  // ROYALE: remove immediately
  if (room.mode === MODES.ROYALE) {
    room.players = room.players.filter((p) => p.id !== socketId);

    if (room.players.length === 0) {
      clearAllTimers(room);
      delete rooms[code];
      return;
    }

    if (room.hostId === socketId) updateRoyaleHost(io, room);

    broadcastRoyaleState(io, room);
    return;
  }

  // CLASSIC: just reuse disconnect logic (safe + consistent)
  handleDisconnect(io, code, room, socketId);
};

// NEW: Reset Royale to Lobby (Host only)
// Intended to be triggered at GAME_OVER so the same lobby can restart.
// - Keeps the room + players
// - Clears timers and round/game state
// - Resets all player scores/ready/round flags
const resetRoyaleToLobby = (io, code, room, socketId) => {
  if (!room || room.mode !== MODES.ROYALE) return;
  if (room.hostId !== socketId) return;

  clearAllTimers(room);

  room.matchOver = false;
  room.currentRound = 0;
  room.roundActive = false;
  room.resultActive = false;
  room.preActive = false;
  room.pickingActive = false;

  room.activeLetters = [];
  room.roundWinners = [];
  room.lastWinningWord = null;

  room.preEndsAt = null;
  room.roundEndsAt = null;
  room.resultEndsAt = null;

  room.players.forEach((p) => {
    p.score = 0;
    p.ready = false;
    p.finishedRound = false;
    p.roundPoints = 0;
  });

  broadcastRoyaleState(io, room);
};

// -------------------- State Transitions (Classic 1v1) --------------------

const resetToPicking = (io, code, room) => {
  if (!room || room.matchOver) return;

  // Royale does not use picking phase
  if (room.mode === MODES.ROYALE) return;

  clearAllTimers(room);

  room.preActive = false;
  room.roundActive = false;
  room.resultActive = false;

  room.pickingActive = true;
  room.p1Letter = null;
  room.p2Letter = null;
  room.pickEndsAt = Date.now() + TIMERS.PICK_MS;

  io.to(code).emit("pick_start", { endsAt: room.pickEndsAt });

  room.pickTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver || !still.pickingActive) return;

    // Auto-pick
    if (!still.p1Letter) still.p1Letter = randomLetter();
    if (!still.p2Letter) still.p2Letter = randomLetter();

    startRound(io, code, still);
  }, TIMERS.PICK_MS);
};

const startRoundResult = (io, code, room, lastWinner, lastWord) => {
  if (!room) return;

  // Royale uses a different result flow
  if (room.mode === MODES.ROYALE) return;

  clearAllTimers(room);

  room.roundActive = false;
  room.pickingActive = false;

  room.resultActive = true;
  room.resultEndsAt = Date.now() + TIMERS.RESULT_MS;

  io.to(code).emit("round_result", {
    winnerRole: lastWinner, // 'p1', 'p2', or null
    word: lastWord,
    scores: { p1: room.p1Score, p2: room.p2Score },
    endsAt: room.resultEndsAt,
  });

  room.resultTimeoutId = setTimeout(() => {
    resetToPicking(io, code, rooms[code]);
  }, TIMERS.RESULT_MS);
};

const startRound = (io, code, room) => {
  if (!room || room.matchOver) return;

  // Royale starts via startRoyaleRound
  if (room.mode === MODES.ROYALE) return;

  clearAllTimers(room);

  room.preActive = false;
  room.resultActive = false;
  room.pickingActive = false;

  room.roundActive = true;

  if (!room.p1Letter) room.p1Letter = randomLetter();
  if (!room.p2Letter) room.p2Letter = randomLetter();

  room.roundEndsAt = Date.now() + TIMERS.ROUND_MS;

  io.to(code).emit("round_start", {
    letters: [room.p1Letter, room.p2Letter],
    endsAt: room.roundEndsAt,
  });

  room.roundTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver || !still.roundActive) return;

    // Timeout - No winner
    startRoundResult(io, code, still, null, null);
  }, TIMERS.ROUND_MS);
};

const startPreGame = (io, code, room) => {
  if (!room || room.matchOver) return;
  clearAllTimers(room);

  room.pickingActive = false;
  room.roundActive = false;
  room.resultActive = false;

  room.preActive = true;
  room.preEndsAt = Date.now() + TIMERS.PRE_MS;

  io.to(code).emit("pre_game", { endsAt: room.preEndsAt });

  room.preTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still) return;

    still.preActive = false;

    if (still.mode === MODES.ROYALE) {
      startRoyaleRound(io, code, still);
    } else {
      resetToPicking(io, code, still);
    }
  }, TIMERS.PRE_MS);
};

// -------------------- Royale Flow --------------------

const startRoyaleGame = (io, code, room, requesterId = null) => {
  if (!room || room.mode !== MODES.ROYALE) return;
  if (computePhase(room) !== PHASES.LOBBY) return;

  // Optional host-only gate
  if (requesterId && room.hostId && requesterId !== room.hostId) return;

  const connectedPlayers = room.players.filter((p) => p.connected);
  if (connectedPlayers.length < 2) return;

  room.matchOver = false;
  room.currentRound = 1;

  room.roundWinners = [];
  room.lastWinningWord = null;

  room.players.forEach((p) => {
    p.score = 0;
    p.ready = false;
    p.finishedRound = false;
    p.roundPoints = 0;
  });

  startPreGame(io, code, room);
  broadcastRoyaleState(io, room);
};

const startRoyaleRound = (io, code, room) => {
  if (!room || room.matchOver || room.mode !== MODES.ROYALE) return;
  clearAllTimers(room);

  room.preActive = false;
  room.resultActive = false;
  room.pickingActive = false;

  room.roundActive = true;

  room.roundWinners = [];
  room.lastWinningWord = null;

  room.activeLetters = [randomLetter(), randomLetter()];

  // Reset round stats for all players
  room.players.forEach((p) => {
    p.finishedRound = false;
    p.roundPoints = 0;
  });

  room.roundEndsAt = Date.now() + TIMERS.ROUND_MS;

  io.to(code).emit("round_start", {
    letters: room.activeLetters,
    endsAt: room.roundEndsAt,
    round: room.currentRound,
  });

  broadcastRoyaleState(io, room);

  room.roundTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver || !still.roundActive) return;
    finishRoyaleRound(io, code, still);
  }, TIMERS.ROUND_MS);
};

const submitRoyaleWord = (io, code, room, playerKey, word) => {
  if (!room || room.mode !== MODES.ROYALE) return;
  if (!room.roundActive) return;

  const player = room.players.find((p) => p.key === playerKey);
  if (!player || !player.connected) return;

  // Already finished this round?
  if (player.finishedRound) return;

  const { isValid, reason, cleanWord } = validateMove(
    word,
    room.activeLetters[0],
    room.activeLetters[1],
    MIN_LENGTH_ROYALE
  );

  if (!isValid) {
    io.to(player.id).emit("attempt_failed", { text: word, reason, playerId: player.id });
    return;
  }

  // Valid move
  room.roundWinners.push(player.id);
  player.finishedRound = true;

  const rankIndex = room.roundWinners.length - 1;
  const points = rankIndex < ROYALE_SCORES.length ? ROYALE_SCORES[rankIndex] : ROYALE_DEFAULT_SCORE;

  player.score += points;
  player.roundPoints = points;

  if (rankIndex === 0) {
    room.lastWinningWord = cleanWord;
  }

  io.to(code).emit("royale_submission", {
    playerId: player.id,
    points,
    rank: rankIndex + 1,
    word: cleanWord,
  });

  broadcastRoyaleState(io, room);

  // End early if all connected players finished
  const activePlayers = room.players.filter((p) => p.connected);
  if (room.roundWinners.length >= activePlayers.length) {
    finishRoyaleRound(io, code, room);
  }
};

// FIXED: Use RESULT_MS_ROYALE if available, else fallback to RESULT_MS
const finishRoyaleRound = (io, code, room) => {
  if (!room || room.mode !== MODES.ROYALE) return;

  clearAllTimers(room);

  room.roundActive = false;
  room.resultActive = true;

  const isLastRound = room.currentRound >= ROYALE_ROUNDS;

  const resultMs = Number.isFinite(TIMERS.RESULT_MS_ROYALE) ? TIMERS.RESULT_MS_ROYALE : TIMERS.RESULT_MS;
  room.resultEndsAt = Date.now() + resultMs;

  // Optional: winnerName + word
  const roundWinnerId = room.roundWinners.length > 0 ? room.roundWinners[0] : null;
  const winnerName = roundWinnerId ? room.players.find((p) => p.id === roundWinnerId)?.name : null;

  io.to(code).emit("round_result", {
    winnerName: winnerName || null,
    word: room.lastWinningWord || null,
    endsAt: room.resultEndsAt,
    round: room.currentRound,
  });

  broadcastRoyaleState(io, room);

  room.resultTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still) return;

    if (isLastRound) {
      still.matchOver = true;
      still.resultActive = false;

      io.to(code).emit("match_over", {
        leaderboard: sortLeaderboardCopy(still.players),
      });

      broadcastRoyaleState(io, still);
      return;
    }

    still.currentRound += 1;
    still.resultActive = false;
    startRoyaleRound(io, code, still);
  }, resultMs);
};

// -------------------- Room Creation --------------------

const createRoom = (mode = MODES?.CLASSIC ?? "classic") => {
  const code = generateRoomCode(rooms);

  const base = {
    code,
    mode,

    // State
    preActive: false,
    pickingActive: false,
    roundActive: false,
    resultActive: false,
    matchOver: false,

    // Timers + EndsAt
    preEndsAt: null,
    pickEndsAt: null,
    roundEndsAt: null,
    resultEndsAt: null,

    preTimeoutId: null,
    pickTimeoutId: null,
    roundTimeoutId: null,
    resultTimeoutId: null,
  };

  if (mode === MODES.ROYALE) {
    rooms[code] = {
      ...base,
      players: [], // { id, key, name, score, connected, ready, finishedRound, roundPoints }
      hostId: null,
      currentRound: 1,
      activeLetters: [],
      roundWinners: [],
      lastWinningWord: null,
      disconnectTimeouts: Object.create(null),
    };
    return rooms[code];
  }

  // Classic (1v1)
  rooms[code] = {
    ...base,

    // Players
    p1: null,
    p2: null,
    p1Key: "p1_" + randId(18),
    p2Key: null,
    p1Name: "Player 1",
    p2Name: "Player 2",
    p1Score: 0,
    p2Score: 0,

    // Ready Status
    p1Ready: false,
    p2Ready: false,

    // State
    p1Letter: null,
    p2Letter: null,
    rematch: { p1: false, p2: false },

    // Disconnect grace
    p1DisconnectTimeoutId: null,
    p2DisconnectTimeoutId: null,
  };

  return rooms[code];
};

// -------------------- Classic Room Actions --------------------

const setPlayerReady = (io, code, room, role) => {
  if (!room) return;
  if (room.mode === MODES.ROYALE) return;

  if (role === "p1") room.p1Ready = true;
  else room.p2Ready = true;

  io.to(code).emit("ready_status", { p1: room.p1Ready, p2: room.p2Ready });

  if (room.p1Ready && room.p2Ready) startPreGame(io, code, room);
};

const applyScore = (io, code, room, role, word) => {
  if (!room) return;
  if (room.mode === MODES.ROYALE) return;

  room.roundActive = false;
  clearAllTimers(room);

  if (role === "p1") room.p1Score += 1;
  else room.p2Score += 1;

  const matchOver = room.p1Score >= WINNING_SCORE || room.p2Score >= WINNING_SCORE;

  if (matchOver) {
    room.matchOver = true;
    room.rematch = { p1: false, p2: false };

    io.to(code).emit("match_over", {
      winnerRole: role,
      winningWord: word,
      scores: { p1: room.p1Score, p2: room.p2Score },
    });
  } else {
    startRoundResult(io, code, room, role, word);
  }
};

const handleRematchRequest = (io, code, room, role) => {
  if (!room) return;
  if (room.mode === MODES.ROYALE) return;

  room.rematch[role] = true;
  io.to(code).emit("rematch_status", { p1: room.rematch.p1, p2: room.rematch.p2 });

  if (room.rematch.p1 && room.rematch.p2) {
    room.p1Score = 0;
    room.p2Score = 0;
    room.matchOver = false;
    room.rematch = { p1: false, p2: false };
    room.p1Ready = false;
    room.p2Ready = false;

    clearAllTimers(room);

    io.to(code).emit("rematch_started", { scores: { p1: 0, p2: 0 } });
    io.to(code).emit("ready_status", { p1: false, p2: false });
  }
};

// -------------------- Disconnect/Rejoin --------------------

const handleDisconnect = (io, code, room, socketId) => {
  if (!room) return;

  // ---------------- ROYALE ----------------
  if (room.mode === MODES.ROYALE) {
    const p = room.players.find((x) => x.id === socketId);
    if (!p) return;

    p.connected = false;

    if (room.hostId === socketId) updateRoyaleHost(io, room);

    // Lobby: remove immediately
    if (computePhase(room) === PHASES.LOBBY) {
      room.players = room.players.filter((x) => x.id !== socketId);

      if (room.players.length === 0) {
        clearAllTimers(room);
        delete rooms[code];
        return;
      }

      updateRoyaleHost(io, room);
      broadcastRoyaleState(io, room);
      return;
    }

    // In-game: keep for leaderboard, just mark disconnected
    broadcastRoyaleState(io, room);
    return;
  }

  // ---------------- CLASSIC (1v1) ----------------
  let role = null;
  if (room.p1 === socketId) {
    role = "p1";
    room.p1 = null;
    room.p1Ready = false;
  } else if (room.p2 === socketId) {
    role = "p2";
    room.p2 = null;
    room.p2Ready = false;
  } else return;

  if (computePhase(room) === PHASES.LOBBY) {
    io.to(code).emit("ready_status", { p1: room.p1Ready, p2: room.p2Ready });
  }

  if (!room.p1 && !room.p2) {
    clearAllTimers(room);
    delete rooms[code];
    return;
  }

  clearDisconnectTimerClassic(room, role);

  const opp = opponentSocketId(room, role);
  if (opp) io.to(opp).emit("opponent_left");

  const timerId = setTimeout(() => {
    const still = rooms[code];
    if (!still) return;

    if ((role === "p1" && !still.p1) || (role === "p2" && !still.p2)) {
      clearAllTimers(still);
      delete rooms[code];
    }
  }, TIMERS.RECONNECT_GRACE_MS);

  if (role === "p1") room.p1DisconnectTimeoutId = timerId;
  else room.p2DisconnectTimeoutId = timerId;
};

const handleRejoin = (io, socket, code, room, role) => {
  if (!room) return;
  if (room.mode === MODES.ROYALE) return;

  if (role === "p1") room.p1 = socket.id;
  else room.p2 = socket.id;

  clearDisconnectTimerClassic(room, role);

  socket.emit("rejoined_room", {
    code,
    role,
    playerKey: role === "p1" ? room.p1Key : room.p2Key,
  });

  socket.emit("sync_state", {
    code,
    role,
    phase: computePhase(room),
    names: { p1: room.p1Name, p2: room.p2Name },
    scores: { p1: room.p1Score, p2: room.p2Score },
    matchOver: room.matchOver,
    ready: { p1: room.p1Ready, p2: room.p2Ready },
    preEndsAt: room.preEndsAt,
    pickEndsAt: room.pickEndsAt,
    roundEndsAt: room.roundEndsAt,
    resultEndsAt: room.resultEndsAt,
    letters: [room.p1Letter, room.p2Letter],
    rematch: { p1: room.rematch.p1, p2: room.rematch.p2 },
  });

  if (room.p1 && room.p2 && !room.matchOver) {
    if (room.preActive) io.to(code).emit("pre_game", { endsAt: room.preEndsAt });
    else if (room.pickingActive) io.to(code).emit("pick_start", { endsAt: room.pickEndsAt });
    else if (room.roundActive) {
      io.to(code).emit("round_start", {
        letters: [room.p1Letter, room.p2Letter],
        endsAt: room.roundEndsAt,
      });
    }
  }
};

// Royale rejoin (by playerKey)
const handleRoyaleRejoin = (io, socket, code, room, playerKey) => {
  if (!room || room.mode !== MODES.ROYALE) return;

  const player = room.players.find((p) => p.key === playerKey);
  if (!player) return;

  player.id = socket.id;
  player.connected = true;

  socket.join(room.code);

  if (!room.hostId || !room.players.some((p) => p.id === room.hostId && p.connected)) {
    updateRoyaleHost(io, room);
  }

  socket.emit("rejoined_room", {
    code: room.code,
    mode: MODES.ROYALE,
    playerKey: player.key,
    hostId: room.hostId,
  });

  broadcastRoyaleState(io, room);

  if (room.roundActive) {
    socket.emit("round_start", {
      letters: room.activeLetters,
      endsAt: room.roundEndsAt,
      round: room.currentRound,
    });
  } else if (room.preActive) {
    socket.emit("pre_game", { endsAt: room.preEndsAt });
  } else if (room.resultActive) {
    const roundWinnerId = room.roundWinners?.[0] || null;
    const winnerName = roundWinnerId
      ? room.players.find((p) => p.id === roundWinnerId)?.name || null
      : null;

    socket.emit("round_result", {
      winnerName,
      word: room.lastWinningWord || null,
      endsAt: room.resultEndsAt,
      round: room.currentRound,
    });
  }
};

// -------------------- 1v1 Queue + Accept/Decline Match --------------------

const joinQueue = (io, socket) => {
  if (queue.find((q) => q.id === socket.id)) return;
  queue.push(socket);

  if (queue.length >= 2) {
    const s1 = queue.shift();
    const s2 = queue.shift();
    createPendingMatch(io, s1, s2);
  }
};

const leaveQueue = (socketId) => {
  queue = queue.filter((s) => s.id !== socketId);
};

const createPendingMatch = (io, s1, s2) => {
  const matchId = "m_" + randId(10);
  const expiresAt = Date.now() + 10_000;

  pendingMatches[matchId] = {
    id: matchId,
    p1: s1,
    p2: s2,
    p1Accepted: false,
    p2Accepted: false,
    timer: setTimeout(() => handleMatchTimeout(io, matchId), 10_000),
  };

  s1.emit("match_found", { matchId, expiresAt });
  s2.emit("match_found", { matchId, expiresAt });
};

const handleAcceptMatch = (io, socket, matchId) => {
  const m = pendingMatches[matchId];
  if (!m) return;

  if (m.p1.id === socket.id) m.p1Accepted = true;
  else if (m.p2.id === socket.id) m.p2Accepted = true;
  else return;

  m.p1.emit("match_accept_status", { p1: m.p1Accepted, p2: m.p2Accepted, matchId });
  m.p2.emit("match_accept_status", { p1: m.p1Accepted, p2: m.p2Accepted, matchId });

  if (m.p1Accepted && m.p2Accepted) {
    clearTimeout(m.timer);
    finalizeMatch(io, m);
    delete pendingMatches[matchId];
  }
};

const handleDeclineMatch = (io, socket, matchId) => {
  const m = pendingMatches[matchId];
  if (!m) return;

  clearTimeout(m.timer);

  const declinedByP1 = m.p1.id === socket.id;

  m.p1.emit("match_cancelled", { reason: declinedByP1 ? "You declined" : "Opponent declined" });
  m.p2.emit("match_cancelled", { reason: declinedByP1 ? "Opponent declined" : "You declined" });

  delete pendingMatches[matchId];
};

const handleMatchTimeout = (io, matchId) => {
  const m = pendingMatches[matchId];
  if (!m) return;

  m.p1.emit("match_cancelled", { reason: "Match timed out" });
  m.p2.emit("match_cancelled", { reason: "Match timed out" });

  delete pendingMatches[matchId];
};

const finalizeMatch = (io, m) => {
  const room = createRoom(MODES.CLASSIC);

  room.p1 = m.p1.id;
  room.p2 = m.p2.id;
  room.p2Key = "p2_" + randId(18);

  m.p1.join(room.code);
  m.p2.join(room.code);

  m.p1.emit("room_created", { code: room.code, role: "p1", playerKey: room.p1Key });
  m.p2.emit("joined_room", { code: room.code, role: "p2", playerKey: room.p2Key });

  io.to(room.code).emit("names_update", { p1: room.p1Name, p2: room.p2Name });
  io.to(room.code).emit("ready_status", { p1: false, p2: false });
};

// -------------------- Royale Join --------------------

const joinRoyale = (io, socket, username) => {
  let room = Object.values(rooms).find(
    (r) =>
      r.mode === MODES.ROYALE &&
      r.players.length < ROYALE_MAX_PLAYERS &&
      computePhase(r) === PHASES.LOBBY
  );

  if (!room) room = createRoom(MODES.ROYALE);

  const player = {
    id: socket.id,
    key: randId(18),
    name: username || `Player ${room.players.length + 1}`,
    score: 0,
    connected: true,
    ready: false,

    finishedRound: false,
    roundPoints: 0,
  };

  room.players.push(player);
  socket.join(room.code);

  if (room.players.length === 1) room.hostId = player.id;

  socket.emit("joined_room", {
    code: room.code,
    mode: MODES.ROYALE,
    playerKey: player.key,
    hostId: room.hostId,
  });

  broadcastRoyaleState(io, room);
};

// -------------------- Exports --------------------

module.exports = {
  rooms,
  pendingMatches,

  // room
  getRoom,
  createRoom,

  // classic room actions
  setPlayerReady,
  applyScore,
  handleRematchRequest,

  // 1v1 queue/match
  joinQueue,
  leaveQueue,
  handleAcceptMatch,
  handleDeclineMatch,

  // identity helpers (classic)
  roleOfKey,
  roleOfSocket,
  opponentSocketId,

  // lifecycle
  handleDisconnect,
  handleRejoin,

  // classic (optional)
  startRound,

  // royale
  joinRoyale,
  startRoyaleGame,
  startRoyaleRound, // optional
  submitRoyaleWord,
  handleRoyaleRejoin,

  // NEW
  handleLeaveRoom,
  resetRoyaleToLobby,
};
