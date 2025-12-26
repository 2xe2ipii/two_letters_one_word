// socket.js (combined)
// Keeps ALL 1v1 events/behavior from "Before" and adds Royale events/behavior from "After".
// Assumes RoomManager is the combined one you asked for earlier (supports MODES.CLASSIC + MODES.ROYALE).
// Also assumes constants exports: MIN_LENGTH_1V1, MIN_LENGTH_ROYALE, MODES (and legacy MIN_LENGTH may exist).

const { normalizeCode, validateMove, randId } = require("./utils");
const { MIN_LENGTH_1V1, MIN_LENGTH_ROYALE, MODES } = require("./constants");
const RoomManager = require("./roomManager");

module.exports = (io) => {
  io.on("connection", (socket) => {
    // --- ONLINE COUNT LOGIC ---
    io.emit("online_count", io.engine.clientsCount);

    socket.on("request_online_count", () => {
      socket.emit("online_count", io.engine.clientsCount);
    });

    // -------------------------
    // LOBBY / ROOMS / QUEUE
    // -------------------------

    // Create a room (supports Classic + Royale)
    // Backward-compatible:
    //   create_room() => Classic
    //   create_room({ mode }) => Classic/Royale
    socket.on("create_room", (payload = {}) => {
      const modeRaw = payload?.mode;

      // Accept a few common spellings:
      // "ROYALE", "royale", MODES.ROYALE => Royale
      // otherwise => Classic
      const wantsRoyale =
        modeRaw === MODES?.ROYALE ||
        String(modeRaw || "")
          .trim()
          .toUpperCase() === "ROYALE";

      const finalMode = wantsRoyale ? MODES.ROYALE : MODES.CLASSIC;

      if (finalMode === MODES.ROYALE) {
        // Create a new Royale lobby explicitly (host = creator)
        const room = RoomManager.createRoom(MODES.ROYALE);

        const host = {
          id: socket.id,
          key: randId(18),
          name: "Host",
          score: 0,
          connected: true,
          ready: false,
        };

        room.players.push(host);
        room.hostId = host.id;

        socket.join(room.code);

        socket.emit("joined_room", { code: room.code, mode: MODES.ROYALE, playerKey: host.key, hostId: room.hostId });

        // Let the manager broadcast full state if available, else emit minimal
        // (RoomManager from earlier provides broadcastRoyaleState, but not exported; so emit basic view here)
        io.to(room.code).emit("royale_state_update", {
          phase: "LOBBY",
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: p.score,
            isHost: p.id === room.hostId,
            connected: p.connected,
            ready: p.ready,
          })),
          round: room.currentRound || 0,
          totalRounds: undefined, // client can rely on constants if needed
          letters: room.activeLetters || [],
          roundEndsAt: room.roundEndsAt || null,
          resultEndsAt: room.resultEndsAt || null,
          preEndsAt: room.preEndsAt || null,
        });

        return;
      }

      // Classic 1v1 create (same as Before)
      const room = RoomManager.createRoom(MODES.CLASSIC);
      room.p1 = socket.id;
      socket.join(room.code);

      socket.emit("room_created", { code: room.code, role: "p1", playerKey: room.p1Key });
      io.to(room.code).emit("names_update", { p1: room.p1Name, p2: room.p2Name });
      io.to(room.code).emit("ready_status", { p1: false, p2: false });
    });

    // Join existing Classic room (unchanged)
    socket.on("join_room", (payload) => {
      // Allow payload to be object { code, name } or just string code
      let rawCode = "";
      let playerName = "";
      
      if (typeof payload === 'object') {
        rawCode = payload.code;
        playerName = payload.name;
      } else {
        rawCode = payload;
      }

      const code = normalizeCode(rawCode);
      const room = RoomManager.getRoom(code);

      if (!room) return socket.emit("error_message", "Room not found!");

      // 1. ROUTE TO ROYALE
      if (room.mode === MODES.ROYALE) {
        RoomManager.joinRoyaleByCode(io, socket, code, room, playerName);
        return;
      }

      // 2. ROUTE TO CLASSIC 1v1
      if (room.p2 && room.p2 !== socket.id) return socket.emit("error_message", "Room is full!");
      if (room.p1 === socket.id) return socket.emit("error_message", "Already in room!");

      if (!room.p2) {
        room.p2 = socket.id;
        if (!room.p2Key) room.p2Key = "p2_" + randId(18);
        if (playerName) room.p2Name = playerName; // Update name immediately if provided

        socket.join(code);
        socket.emit("joined_room", { code, role: "p2", playerKey: room.p2Key, mode: MODES.CLASSIC });

        if (room.p1) io.to(room.p1).emit("opponent_joined");
        io.to(code).emit("names_update", { p1: room.p1Name, p2: room.p2Name });
        io.to(code).emit("ready_status", { p1: room.p1Ready, p2: room.p2Ready });
        return;
      }

      // Re-ack if already p2
      socket.join(code);
      socket.emit("joined_room", { code, role: "p2", playerKey: room.p2Key, mode: MODES.CLASSIC });
    });

    // Rejoin (Classic or Royale) by playerKey
    socket.on("rejoin_room", ({ roomCode, playerKey } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room) return socket.emit("rejoin_failed", "Room no longer exists");

      // Royale uses a different key scheme (player.key)
      if (room.mode === MODES.ROYALE) {
        // Requires RoomManager.handleRoyaleRejoin in the combined manager
        if (typeof RoomManager.handleRoyaleRejoin !== "function") {
          return socket.emit("rejoin_failed", "Royale rejoin not supported by server");
        }
        socket.join(code);
        RoomManager.handleRoyaleRejoin(io, socket, code, room, playerKey);
        return;
      }

      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role) return socket.emit("rejoin_failed", "Invalid session");

      socket.join(code);
      RoomManager.handleRejoin(io, socket, code, room, role);
    });

    // 1v1 queue matchmaking (unchanged)
    socket.on("join_queue", () => {
      RoomManager.joinQueue(io, socket);
    });

    socket.on("leave_queue", () => {
      RoomManager.leaveQueue(socket.id);
    });

    socket.on("accept_match", ({ matchId } = {}) => {
      RoomManager.handleAcceptMatch(io, socket, matchId);
    });

    socket.on("decline_match", ({ matchId } = {}) => {
      RoomManager.handleDeclineMatch(io, socket, matchId);
    });

    // Royale "join lobby" matchmaking (new)
    socket.on("join_royale", ({ username } = {}) => {
      if (typeof RoomManager.joinRoyale !== "function") {
        return socket.emit("error_message", "Royale not supported by server");
      }
      RoomManager.joinRoyale(io, socket, username);
    });

    // Start Royale game (host only)
    socket.on("start_royale", ({ roomCode, config } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room || room.mode !== MODES.ROYALE) return;

      if (room.hostId !== socket.id) return;

      const connectedCount = room.players.filter((p) => p.connected).length;
      if (connectedCount < 2) return socket.emit("error_message", "Need at least 2 players!");

      // Pass the config (e.g. { totalRounds: 10 })
      RoomManager.startRoyaleGame(io, room.code, room, socket.id, config);
    });

    // Ready (Classic only; Royale uses host start)
    socket.on("player_ready", ({ roomCode, playerKey } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room || room.mode === MODES.ROYALE) return;

      const role = RoomManager.roleOfKey(room, playerKey);
      if (role) RoomManager.setPlayerReady(io, code, room, role);
    });

    // -------------------------
    // GAMEPLAY
    // -------------------------

    // Set name (Classic + Royale)
    socket.on("set_name", ({ roomCode, playerKey, name } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room) return;

      const clean = String(name || "").trim().slice(0, 16);
      if (!clean.length) return;

      if (room.mode === MODES.ROYALE) {
        const p = room.players.find((x) => x.key === playerKey);
        if (!p) return;

        p.name = clean;

        // Broadcast updated state (simple)
        io.to(room.code).emit("royale_state_update", {
          phase: computePhaseSafe(room),
          players: room.players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            score: pl.score,
            isHost: pl.id === room.hostId,
            connected: pl.connected,
            ready: pl.ready,
          })),
          round: room.currentRound,
          totalRounds: undefined,
          letters: room.activeLetters || [],
          roundEndsAt: room.roundEndsAt || null,
          resultEndsAt: room.resultEndsAt || null,
          preEndsAt: room.preEndsAt || null,
        });
        return;
      }

      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role) return;

      if (role === "p1") room.p1Name = clean;
      else room.p2Name = clean;

      io.to(room.code).emit("names_update", { p1: room.p1Name, p2: room.p2Name });
    });

    // Letter picking (Classic only)
    socket.on("submit_letter", ({ roomCode, playerKey, letter } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room || room.mode === MODES.ROYALE) return;

      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role || !room.pickingActive) return;

      const char = String(letter || "").trim().toUpperCase();
      if (!/^[A-Z]$/.test(char)) return;

      if (role === "p1") room.p1Letter = char;
      else room.p2Letter = char;

      if (room.p1Letter && room.p2Letter) {
        RoomManager.startRound(io, code, room);
      }
    });

    // Submit word (Classic + Royale)
    socket.on("submit_word", ({ roomCode, playerKey, word } = {}) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room) return;

      // Royale path
      if (room.mode === MODES.ROYALE) {
        if (typeof RoomManager.submitRoyaleWord !== "function") return;
        RoomManager.submitRoyaleWord(io, code, room, playerKey, word);
        return;
      }

      // Classic path
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role || !room.roundActive) return;

      const { isValid, cleanWord } = validateMove(word, room.p1Letter, room.p2Letter, MIN_LENGTH_1V1);

      if (!isValid) {
        // Floating words fix (broadcast to room including playerId)
        io.to(code).emit("attempt_failed", { text: word, playerId: socket.id });
        return;
      }

      RoomManager.applyScore(io, code, room, role, cleanWord);
    });

    socket.on("leave_room", ({ roomCode } = {}) => {
        const code = normalizeCode(roomCode);
        const room = RoomManager.getRoom(code);
        if (room) {
            RoomManager.handleLeaveRoom(io, code, room, socket.id);
        }
        socket.leave(code);
    });

    // Typing indicator (Classic only)
    socket.on("typing", ({ roomCode, playerKey } = {}) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      if (!room || room.mode === MODES.ROYALE) return;

      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role || !room.roundActive) return;

      const oppId = RoomManager.opponentSocketId(room, role);
      if (oppId) io.to(oppId).emit("opponent_typing", { typing: true });
    });

    socket.on("typing_stop", ({ roomCode, playerKey } = {}) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      if (!room || room.mode === MODES.ROYALE) return;

      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role) return;

      const oppId = RoomManager.opponentSocketId(room, role);
      if (oppId) io.to(oppId).emit("opponent_typing", { typing: false });
    });

    // UPDATED: Rematch / Return to Lobby
    socket.on("request_rematch", ({ roomCode, playerKey } = {}) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      if (!room) return;

      if (room.mode === MODES.ROYALE) {
        // Royale: host resets back to LOBBY after GAME_OVER
        if (typeof RoomManager.resetRoyaleToLobby === "function") {
          RoomManager.resetRoyaleToLobby(io, room.code, room, socket.id);
        }
        return;
      }

      // Classic 1v1: original rematch flow
      const role = RoomManager.roleOfKey(room, playerKey);
      if (role) RoomManager.handleRematchRequest(io, room.code, room, role);
    });

    // -------------------------
    // DISCONNECT
    // -------------------------

    socket.on("disconnect", () => {
      io.emit("online_count", io.engine.clientsCount);

      RoomManager.leaveQueue(socket.id);

      const { rooms } = require("./roomManager");

      for (const code of Object.keys(rooms)) {
        const room = rooms[code];

        if (room?.mode === MODES.ROYALE) {
          // Check players array
          if (room.players && room.players.some((p) => p.id === socket.id)) {
            RoomManager.handleDisconnect(io, code, room, socket.id);
            // do NOT break; a socket should only be in one room, but safe to exit
            break;
          }
        } else {
          // Classic
          if (room.p1 === socket.id || room.p2 === socket.id) {
            RoomManager.handleDisconnect(io, code, room, socket.id);
            break;
          }
        }
      }
    });

    // -------------------------
    // Local helper (socket.js only)
    // -------------------------
    function computePhaseSafe(room) {
      if (!room) return "LOBBY";
      if (room.matchOver) return "GAME_OVER";
      if (room.resultActive) return "ROUND_RESULT";
      if (room.preActive) return "PRE";
      if (room.roundActive) return "RACING";
      if (room.pickingActive) return "PICKING";
      return "LOBBY";
    }
  });
};
