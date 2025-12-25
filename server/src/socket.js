const { normalizeCode, validateMove, randId } = require('./utils');
const { MIN_LENGTH } = require('./constants');
const RoomManager = require('./roomManager');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // --- LOBBY / QUEUE ---

    socket.on('create_room', () => {
      const room = RoomManager.createRoom();
      room.p1 = socket.id;
      socket.join(room.code);
      socket.emit('room_created', { code: room.code, role: 'p1', playerKey: room.p1Key });
      io.to(room.code).emit('names_update', { p1: room.p1Name, p2: room.p2Name });
      io.to(room.code).emit('ready_status', { p1: false, p2: false });
    });

    socket.on('join_room', (rawCode) => {
      const code = normalizeCode(rawCode);
      const room = RoomManager.getRoom(code);

      if (!room) return socket.emit('error_message', 'Room not found!');
      if (room.p2 && room.p2 !== socket.id) return socket.emit('error_message', 'Room is full!');
      if (room.p1 === socket.id) return socket.emit('error_message', 'Already in room!');

      if (!room.p2) {
        room.p2 = socket.id;
        if (!room.p2Key) room.p2Key = 'p2_' + randId(18);
        socket.join(code);
        socket.emit('joined_room', { code, role: 'p2', playerKey: room.p2Key });
        if (room.p1) io.to(room.p1).emit('opponent_joined');
        io.to(code).emit('names_update', { p1: room.p1Name, p2: room.p2Name });
        io.to(code).emit('ready_status', { p1: room.p1Ready, p2: room.p2Ready });
        return;
      }
      
      socket.join(code);
      socket.emit('joined_room', { code, role: 'p2', playerKey: room.p2Key });
    });

    socket.on('rejoin_room', ({ roomCode, playerKey }) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      if (!room) return socket.emit('rejoin_failed', 'Room no longer exists');
      
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!role) return socket.emit('rejoin_failed', 'Invalid session');

      socket.join(code);
      RoomManager.handleRejoin(io, socket, code, room, role);
    });

    socket.on('join_queue', () => {
      RoomManager.joinQueue(io, socket);
    });

    socket.on('leave_queue', () => {
      RoomManager.leaveQueue(socket.id);
    });

    socket.on('accept_match', ({ matchId }) => {
      RoomManager.handleAcceptMatch(io, socket, matchId);
    });

    socket.on('decline_match', ({ matchId }) => {
      RoomManager.handleDeclineMatch(io, socket, matchId);
    });

    socket.on('player_ready', ({ roomCode, playerKey }) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      const role = RoomManager.roleOfKey(room, playerKey);
      if (room && role) {
        RoomManager.setPlayerReady(io, code, room, role);
      }
    });

    // --- GAMEPLAY ---

    socket.on('set_name', ({ roomCode, playerKey, name }) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!room || !role) return;

      const clean = String(name || '').trim().slice(0, 16);
      const finalName = clean.length ? clean : (role === 'p1' ? 'Player 1' : 'Player 2');

      if (role === 'p1') room.p1Name = finalName;
      else room.p2Name = finalName;

      io.to(room.code).emit('names_update', { p1: room.p1Name, p2: room.p2Name });
    });

    socket.on('submit_letter', ({ roomCode, playerKey, letter }) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!room || !role || !room.pickingActive) return;

      const char = String(letter || '').trim().toUpperCase();
      if (!/^[A-Z]$/.test(char)) return;

      if (role === 'p1') room.p1Letter = char;
      else room.p2Letter = char;

      if (room.p1Letter && room.p2Letter) {
        // FIXED: Call startRound directly from RoomManager
        RoomManager.startRound(io, code, room);
      }
    });

    socket.on('submit_word', ({ roomCode, playerKey, word }) => {
      const code = normalizeCode(roomCode);
      const room = RoomManager.getRoom(code);
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!room || !role || !room.roundActive) return;

      const { isValid, reason, cleanWord } = validateMove(
        word, room.p1Letter, room.p2Letter, MIN_LENGTH
      );

      if (!isValid) {
        io.to(code).emit('failed_attempt', { by: role, word, reason });
        return;
      }

      RoomManager.applyScore(io, code, room, role, cleanWord);
    });

    socket.on('typing', ({ roomCode, playerKey }) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!room || !role || !room.roundActive) return;
      
      const oppId = RoomManager.opponentSocketId(room, role);
      if (oppId) io.to(oppId).emit('opponent_typing', { typing: true });
    });

    socket.on('typing_stop', ({ roomCode, playerKey }) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      const role = RoomManager.roleOfKey(room, playerKey);
      if (!room || !role) return;
      
      const oppId = RoomManager.opponentSocketId(room, role);
      if (oppId) io.to(oppId).emit('opponent_typing', { typing: false });
    });

    socket.on('request_rematch', ({ roomCode, playerKey }) => {
      const room = RoomManager.getRoom(normalizeCode(roomCode));
      const role = RoomManager.roleOfKey(room, playerKey);
      if (room && role) RoomManager.handleRematchRequest(io, room.code, room, role);
    });

    socket.on('disconnect', () => {
      const { rooms } = require('./roomManager');
      RoomManager.leaveQueue(socket.id);
      
      for (const code of Object.keys(rooms)) {
        const room = rooms[code];
        if (room.p1 === socket.id || room.p2 === socket.id) {
          RoomManager.handleDisconnect(io, code, room, socket.id);
          break;
        }
      }
    });
  });
};