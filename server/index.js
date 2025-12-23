// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const checkWord = require('check-word');

const words = checkWord('en');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;

// Rules
const WINNING_SCORE = 10;
const MIN_LENGTH = 3;

// Timers
const PRE_MS = 5000; // pre-first-round "get ready"
const PICK_MS = 5000; // 5s to pick a letter (then auto-pick)
const ROUND_MS = 20000; // 20s to find a word (then no-point reset)
const RECONNECT_GRACE_MS = 8000; // refresh grace window

const rooms = Object.create(null);

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const randId = (len = 16) =>
  Math.random().toString(36).slice(2, 2 + len) + Math.random().toString(36).slice(2, 2 + len);

const randomLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));

const generateRoomCode = () => {
  let code = '';
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms[code]);
  return code;
};

const roleOfKey = (room, playerKey) => {
  if (!room || !playerKey) return null;
  if (playerKey === room.p1Key) return 'p1';
  if (playerKey === room.p2Key) return 'p2';
  return null;
};

const roleOfSocket = (room, socketId) => {
  if (!room) return null;
  if (room.p1 === socketId) return 'p1';
  if (room.p2 === socketId) return 'p2';
  return null;
};

const opponentSocketId = (room, role) => {
  if (!room || !role) return null;
  if (role === 'p1') return room.p2;
  if (role === 'p2') return room.p1;
  return null;
};

const clearTimer = (id) => {
  if (id) clearTimeout(id);
};

const clearPickTimer = (room) => {
  if (!room) return;
  clearTimer(room.pickTimeoutId);
  room.pickTimeoutId = null;
};

const clearRoundTimer = (room) => {
  if (!room) return;
  clearTimer(room.roundTimeoutId);
  room.roundTimeoutId = null;
};

const clearPreTimer = (room) => {
  if (!room) return;
  clearTimer(room.preTimeoutId);
  room.preTimeoutId = null;
};

const clearDisconnectTimer = (room, role) => {
  if (!room || !role) return;
  if (role === 'p1') {
    clearTimer(room.p1DisconnectTimeoutId);
    room.p1DisconnectTimeoutId = null;
  } else {
    clearTimer(room.p2DisconnectTimeoutId);
    room.p2DisconnectTimeoutId = null;
  }
};

const emitNames = (code, room) => {
  io.to(code).emit('names_update', {
    p1: room.p1Name || 'Player 1',
    p2: room.p2Name || 'Player 2',
  });
};

const computePhase = (room) => {
  if (!room) return 'LOBBY';
  if (room.matchOver) return 'GAME_OVER';
  if (room.preActive) return 'PRE';
  if (room.roundActive) return 'RACING';
  if (room.pickingActive) return 'PICKING';
  return 'LOBBY';
};

const emitSyncState = (socket, code, room, role) => {
  socket.emit('sync_state', {
    code,
    role,
    phase: computePhase(room),
    names: { p1: room.p1Name || 'Player 1', p2: room.p2Name || 'Player 2' },
    scores: { p1: room.p1Score, p2: room.p2Score },
    matchOver: !!room.matchOver,
    preEndsAt: room.preEndsAt || null,
    pickEndsAt: room.pickEndsAt || null,
    roundEndsAt: room.roundEndsAt || null,
    letters: [room.p1Letter, room.p2Letter],
    rematch: { p1: !!room.rematch.p1, p2: !!room.rematch.p2 },
    winningWord: room.lastWinningWord || '',
  });
};

const resetToPicking = (code, room) => {
  if (!room) return;
  if (room.matchOver) return;
  if (!room.p1 || !room.p2) return;

  clearRoundTimer(room);
  clearPickTimer(room);

  room.preActive = false;
  room.pickingActive = true;
  room.roundActive = false;

  room.p1Letter = null;
  room.p2Letter = null;

  room.pickEndsAt = Date.now() + PICK_MS;

  io.to(code).emit('pick_start', { endsAt: room.pickEndsAt });

  room.pickTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver) return;
    if (!still.p1 || !still.p2) return;
    if (!still.pickingActive) return;

    if (!still.p1Letter) still.p1Letter = randomLetter();
    if (!still.p2Letter) still.p2Letter = randomLetter();

    startRound(code, still);
  }, PICK_MS);
};

const startPreIfFirstTime = (code, room) => {
  if (!room) return;
  if (!room.p1 || !room.p2) return;
  if (room.matchOver) return;

  if (room.hasEverStarted) {
    resetToPicking(code, room);
    return;
  }

  room.hasEverStarted = true;

  clearPreTimer(room);
  clearPickTimer(room);
  clearRoundTimer(room);

  room.preActive = true;
  room.pickingActive = false;
  room.roundActive = false;

  room.preEndsAt = Date.now() + PRE_MS;

  io.to(code).emit('pre_game', { endsAt: room.preEndsAt });

  room.preTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver) return;
    if (!still.p1 || !still.p2) return;

    still.preActive = false;
    still.preEndsAt = null;

    resetToPicking(code, still);
  }, PRE_MS);
};

const startRound = (code, room) => {
  if (!room) return;
  if (room.matchOver) return;
  if (!room.p1 || !room.p2) return;
  if (room.roundActive) return;

  clearPreTimer(room);
  clearPickTimer(room);
  clearRoundTimer(room);

  room.preActive = false;
  room.pickingActive = false;
  room.roundActive = true;

  if (!room.p1Letter) room.p1Letter = randomLetter();
  if (!room.p2Letter) room.p2Letter = randomLetter();

  room.roundEndsAt = Date.now() + ROUND_MS;

  io.to(code).emit('round_start', {
    letters: [room.p1Letter, room.p2Letter],
    endsAt: room.roundEndsAt,
  });

  room.roundTimeoutId = setTimeout(() => {
    const still = rooms[code];
    if (!still || still.matchOver) return;
    if (!still.roundActive) return;

    still.roundActive = false;

    io.to(code).emit('round_timeout', {
      letters: [still.p1Letter, still.p2Letter],
      scores: { p1: still.p1Score, p2: still.p2Score },
    });

    resetToPicking(code, still);
  }, ROUND_MS);
};

const finalizeRoomIfDead = (code, room) => {
  if (!room) return;
  const nobodyConnected = !room.p1 && !room.p2;
  if (nobodyConnected) {
    clearPreTimer(room);
    clearPickTimer(room);
    clearRoundTimer(room);
    delete rooms[code];
  }
};

const scheduleDisconnectFinalization = (code, room, role) => {
  if (!room || !role) return;

  clearDisconnectTimer(room, role);

  const opp = opponentSocketId(room, role);

  const timerId = setTimeout(() => {
    const still = rooms[code];
    if (!still) return;

    const isStillGone = role === 'p1' ? !still.p1 : !still.p2;
    if (!isStillGone) return;

    if (opp) io.to(opp).emit('opponent_left');

    clearPreTimer(still);
    clearPickTimer(still);
    clearRoundTimer(still);

    delete rooms[code];
  }, RECONNECT_GRACE_MS);

  if (role === 'p1') room.p1DisconnectTimeoutId = timerId;
  else room.p2DisconnectTimeoutId = timerId;
};

io.on('connection', (socket) => {
  socket.on('create_room', () => {
    const code = generateRoomCode();

    rooms[code] = {
      code,

      p1: socket.id,
      p2: null,

      p1Key: 'p1_' + randId(18),
      p2Key: null,

      p1Name: 'Player 1',
      p2Name: 'Player 2',

      p1Letter: null,
      p2Letter: null,

      p1Score: 0,
      p2Score: 0,

      hasEverStarted: false,

      preActive: false,
      preEndsAt: null,
      preTimeoutId: null,

      pickingActive: false,
      pickEndsAt: null,
      pickTimeoutId: null,

      roundActive: false,
      roundEndsAt: null,
      roundTimeoutId: null,

      matchOver: false,
      lastWinningWord: '',

      rematch: { p1: false, p2: false },

      p1DisconnectTimeoutId: null,
      p2DisconnectTimeoutId: null,
    };

    socket.join(code);

    socket.emit('room_created', {
      code,
      role: 'p1',
      playerKey: rooms[code].p1Key,
    });

    emitNames(code, rooms[code]);
  });

  socket.on('join_room', (roomCode) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];

    if (!room) return socket.emit('error_message', 'Room not found!');
    if (room.p2 && room.p2 !== socket.id) return socket.emit('error_message', 'Room is full!');
    if (room.p1 === socket.id) return socket.emit('error_message', 'You are already in this room!');

    if (!room.p2) {
      room.p2 = socket.id;
      room.p2Key = room.p2Key || 'p2_' + randId(18);
      clearDisconnectTimer(room, 'p2');

      socket.join(code);

      socket.emit('joined_room', {
        code,
        role: 'p2',
        playerKey: room.p2Key,
      });

      if (room.p1) io.to(room.p1).emit('opponent_joined');

      emitNames(code, room);
      startPreIfFirstTime(code, room);
      return;
    }

    socket.join(code);
    socket.emit('joined_room', { code, role: 'p2', playerKey: room.p2Key });
    emitNames(code, room);
  });

  socket.on('rejoin_room', ({ roomCode, playerKey }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];

    if (!room) return socket.emit('rejoin_failed', 'Room no longer exists');

    const role = roleOfKey(room, playerKey);
    if (!role) return socket.emit('rejoin_failed', 'Invalid session');

    if (role === 'p1') room.p1 = socket.id;
    else room.p2 = socket.id;

    clearDisconnectTimer(room, role);

    socket.join(code);

    socket.emit('rejoined_room', { code, role, playerKey });

    emitNames(code, room);
    emitSyncState(socket, code, room, role);

    if (room.p1 && room.p2) {
      if (!room.matchOver) {
        if (room.preActive) {
          io.to(code).emit('pre_game', { endsAt: room.preEndsAt });
        } else if (room.pickingActive) {
          io.to(code).emit('pick_start', { endsAt: room.pickEndsAt });
        } else if (room.roundActive) {
          io.to(code).emit('round_start', {
            letters: [room.p1Letter, room.p2Letter],
            endsAt: room.roundEndsAt,
          });
        } else {
          resetToPicking(code, room);
        }
      }
    }
  });

  socket.on('set_name', ({ roomCode, playerKey, name }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    const cleaned = String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 16);

    const finalName = cleaned.length ? cleaned : role === 'p1' ? 'Player 1' : 'Player 2';

    if (role === 'p1') room.p1Name = finalName;
    else room.p2Name = finalName;

    emitNames(code, room);
  });

  socket.on('submit_letter', ({ roomCode, playerKey, letter }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room || room.matchOver) return;
    if (!room.p1 || !room.p2) return;
    if (!room.pickingActive) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    const L = String(letter || '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;

    if (role === 'p1') room.p1Letter = L;
    else room.p2Letter = L;

    if (room.p1Letter && room.p2Letter) startRound(code, room);
  });

  socket.on('typing', ({ roomCode, playerKey }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room || room.matchOver) return;
    if (!room.roundActive) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    const opp = opponentSocketId(room, role);
    if (opp) io.to(opp).emit('opponent_typing', { typing: true });
  });

  socket.on('typing_stop', ({ roomCode, playerKey }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    const opp = opponentSocketId(room, role);
    if (opp) io.to(opp).emit('opponent_typing', { typing: false });
  });

  socket.on('submit_word', ({ roomCode, playerKey, word }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room || room.matchOver) return;
    if (!room.roundActive) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    const cleanWord = String(word || '').trim().toLowerCase();

    if (cleanWord.length < MIN_LENGTH) {
      io.to(code).emit('failed_attempt', { by: role, word, reason: `Min ${MIN_LENGTH} chars` });
      return;
    }

    if (!words.check(cleanWord)) {
      io.to(code).emit('failed_attempt', { by: role, word, reason: 'Not a word' });
      return;
    }

    const a = String(room.p1Letter || '').toLowerCase();
    const b = String(room.p2Letter || '').toLowerCase();

    const ok =
      (cleanWord.startsWith(a) && cleanWord.endsWith(b)) ||
      (cleanWord.startsWith(b) && cleanWord.endsWith(a));

    if (!ok) {
      io.to(code).emit('failed_attempt', { by: role, word, reason: 'Wrong letters' });
      return;
    }

    room.roundActive = false;
    clearRoundTimer(room);

    if (role === 'p1') room.p1Score += 1;
    else room.p2Score += 1;

    const scores = { p1: room.p1Score, p2: room.p2Score };
    room.lastWinningWord = String(word || '').trim();

    room.p1Letter = null;
    room.p2Letter = null;

    const matchOver = room.p1Score >= WINNING_SCORE || room.p2Score >= WINNING_SCORE;

    if (matchOver) {
      room.matchOver = true;
      room.rematch = { p1: false, p2: false };

      io.to(code).emit('match_over', {
        winnerRole: role,
        winningWord: room.lastWinningWord,
        scores,
      });
      return;
    }

    io.to(code).emit('next_round', {
      winnerRole: role,
      winningWord: room.lastWinningWord,
      scores,
    });

    resetToPicking(code, room);
  });

  socket.on('request_rematch', ({ roomCode, playerKey }) => {
    const code = normalizeCode(roomCode);
    const room = rooms[code];
    if (!room) return;

    const role = roleOfKey(room, playerKey) || roleOfSocket(room, socket.id);
    if (!role) return;

    room.rematch[role] = true;

    io.to(code).emit('rematch_status', { p1: !!room.rematch.p1, p2: !!room.rematch.p2 });

    if (room.rematch.p1 && room.rematch.p2) {
      room.p1Score = 0;
      room.p2Score = 0;
      room.matchOver = false;
      room.lastWinningWord = '';
      room.rematch = { p1: false, p2: false };

      room.preActive = false;
      room.preEndsAt = null;
      clearPreTimer(room);

      resetToPicking(code, room);

      io.to(code).emit('rematch_started', { scores: { p1: 0, p2: 0 } });
    }
  });

  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room) continue;

      if (room.p1 === socket.id) {
        room.p1 = null;
        scheduleDisconnectFinalization(code, room, 'p1');
        finalizeRoomIfDead(code, room);
        break;
      }

      if (room.p2 === socket.id) {
        room.p2 = null;
        scheduleDisconnectFinalization(code, room, 'p2');
        finalizeRoomIfDead(code, room);
        break;
      }
    }
  });
});

server.listen(PORT, () => console.log(`SERVER RUNNING ON PORT ${PORT}`));
