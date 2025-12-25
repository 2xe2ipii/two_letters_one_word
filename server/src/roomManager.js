// gameState.js
const { TIMERS, WINNING_SCORE, PHASES } = require("./constants");
const { randomLetter, randId, generateRoomCode } = require("./utils");

const rooms = Object.create(null);
const pendingMatches = Object.create(null); // matches waiting for accept
let queue = []; // FIFO matchmaking queue

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
};

const clearDisconnectTimer = (room, role) => {
  if (!room) return;
  if (role === "p1") {
    clearTimer(room.p1DisconnectTimeoutId);
    room.p1DisconnectTimeoutId = null;
  } else {
    clearTimer(room.p2DisconnectTimeoutId);
    room.p2DisconnectTimeoutId = null;
  }
};

const computePhase = (room) => {
  if (!room) return PHASES.LOBBY;
  if (room.matchOver) return PHASES.GAME_OVER;
  if (room.resultActive) return PHASES.ROUND_RESULT;
  if (room.preActive) return PHASES.PRE;
  if (room.roundActive) return PHASES.RACING;
  if (room.pickingActive) return PHASES.PICKING;
  return PHASES.LOBBY;
};

const getRoom = (code) => rooms[code];
const roleOfKey = (r, k) => (k === r.p1Key ? "p1" : k === r.p2Key ? "p2" : null);
const roleOfSocket = (r, id) => (r.p1 === id ? "p1" : r.p2 === id ? "p2" : null);
const opponentSocketId = (r, role) => (role === "p1" ? r.p2 : r.p1);

// -------------------- State Transitions --------------------

const resetToPicking = (io, code, room) => {
  if (!room || room.matchOver) return;
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
    resetToPicking(io, code, still);
  }, TIMERS.PRE_MS);
};

// -------------------- Room Actions --------------------

const createRoom = () => {
  const code = generateRoomCode(rooms);
  rooms[code] = {
    code,

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
    preActive: false,
    pickingActive: false,
    roundActive: false,
    resultActive: false,
    matchOver: false,
    rematch: { p1: false, p2: false },

    // Timers + EndsAt
    preEndsAt: null,
    pickEndsAt: null,
    roundEndsAt: null,
    resultEndsAt: null,

    preTimeoutId: null,
    pickTimeoutId: null,
    roundTimeoutId: null,
    resultTimeoutId: null,

    // Disconnect grace
    p1DisconnectTimeoutId: null,
    p2DisconnectTimeoutId: null,
  };

  return rooms[code];
};

const setPlayerReady = (io, code, room, role) => {
  if (!room) return;

  if (role === "p1") room.p1Ready = true;
  else room.p2Ready = true;

  io.to(code).emit("ready_status", { p1: room.p1Ready, p2: room.p2Ready });

  if (room.p1Ready && room.p2Ready) {
    startPreGame(io, code, room);
  }
};

const handleDisconnect = (io, code, room, socketId) => {
  if (!room) return;

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

  // If disconnect in lobby, reflect unready
  if (computePhase(room) === PHASES.LOBBY) {
    io.to(code).emit("ready_status", { p1: room.p1Ready, p2: room.p2Ready });
  }

  // Delete room if empty
  if (!room.p1 && !room.p2) {
    clearAllTimers(room);
    clearDisconnectTimer(room, "p1");
    clearDisconnectTimer(room, "p2");
    delete rooms[code];
    return;
  }

  clearDisconnectTimer(room, role);

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

  if (role === "p1") room.p1 = socket.id;
  else room.p2 = socket.id;

  clearDisconnectTimer(room, role);

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
    else if (room.roundActive)
      io.to(code).emit("round_start", {
        letters: [room.p1Letter, room.p2Letter],
        endsAt: room.roundEndsAt,
      });
    // If resultActive, client should render based on sync_state.phase + resultEndsAt
  }
};

const applyScore = (io, code, room, role, word) => {
  if (!room) return;

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

    // Back to lobby; must ready again
    io.to(code).emit("rematch_started", { scores: { p1: 0, p2: 0 } });
    io.to(code).emit("ready_status", { p1: false, p2: false });
  }
};

// -------------------- Queue + Accept/Decline Match --------------------

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

  // Optional: live accept status updates
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
  const room = createRoom();
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

function joinRoom(roomCode, socketId, username) { // <--- Accept username
    const room = rooms.get(roomCode);
    if (!room) return null;

    const newPlayer = {
        id: socketId,
        username: username || `Player ${room.players.length + 1}`, // Fallback if empty
        score: 0,
        ready: false
    };

    room.players.push(newPlayer);
    return room;
}

// -------------------- Exports --------------------

module.exports = {
  rooms,
  pendingMatches,

  // room
  getRoom,
  createRoom,
  setPlayerReady,

  // queue/match
  joinQueue,
  leaveQueue,
  handleAcceptMatch,
  handleDeclineMatch,

  // identity helpers
  roleOfKey,
  roleOfSocket,
  opponentSocketId,

  // lifecycle
  handleDisconnect,
  handleRejoin,
  applyScore,
  handleRematchRequest,

  // (optional export if other files call it)
  startRound,
};
