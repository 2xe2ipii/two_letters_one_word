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
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// STATE
const rooms = {};
const WINNING_SCORE = 10;

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // 1. CREATE ROOM
    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            p1: socket.id,
            p2: null,
            p1Letter: null,
            p2Letter: null,
            p1Score: 0,
            p2Score: 0,
            roundActive: false // Prevents late answers from counting
        };
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
    });

    // 2. JOIN ROOM
    socket.on('join_room', (roomCode) => {
        const code = roomCode.toUpperCase();
        if (rooms[code] && !rooms[code].p2) {
            rooms[code].p2 = socket.id;
            socket.join(code);
            io.to(code).emit('game_started'); // Triggers "Pick Letter" screen
        } else {
            socket.emit('error_message', 'Room not found or full!');
        }
    });

    // 3. SUBMIT LETTER
    socket.on('submit_letter', ({ roomCode, letter }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (socket.id === room.p1) room.p1Letter = letter.toUpperCase();
        if (socket.id === room.p2) room.p2Letter = letter.toUpperCase();

        // If both are ready, START RACE
        if (room.p1Letter && room.p2Letter) {
            room.roundActive = true;
            io.to(roomCode).emit('round_start', {
                letters: [room.p1Letter, room.p2Letter]
            });
        }
    });

    // 4. SUBMIT WORD (THE RACE)
    socket.on('submit_word', ({ roomCode, word }) => {
        const room = rooms[roomCode];
        if (!room || !room.roundActive) return;

        const cleanWord = word.trim().toLowerCase(); // Trim whitespace
        const p1L = room.p1Letter.toLowerCase();
        const p2L = room.p2Letter.toLowerCase();

        // VALIDATION HELPERS
        const isEnglish = words.check(cleanWord);
        const startsWithP1 = cleanWord.startsWith(p1L);
        const endsWithP1 = cleanWord.endsWith(p1L);
        const startsWithP2 = cleanWord.startsWith(p2L);
        const endsWithP2 = cleanWord.endsWith(p2L);
        const validPattern = (startsWithP1 && endsWithP2) || (startsWithP2 && endsWithP1);

        // FAILURE HANDLING
        if (!isEnglish || !validPattern) {
            let reason = !isEnglish ? "Not a word" : "Wrong letters";
            
            // Broadcast the failure to BOTH players
            io.to(roomCode).emit('failed_attempt', {
                socketId: socket.id,
                word: word,
                reason: reason
            });
            return;
        }

        // SUCCESS HANDLING (SCORING)
        room.roundActive = false; 
        
        if (socket.id === room.p1) room.p1Score += 1;
        else room.p2Score += 1;

        // Check Match Win
        if (room.p1Score >= WINNING_SCORE || room.p2Score >= WINNING_SCORE) {
            io.to(roomCode).emit('match_over', {
                winnerId: socket.id,
                scores: { p1: room.p1Score, p2: room.p2Score }
            });
            delete rooms[roomCode];
        } else {
            // Send Round Results immediately
            io.to(roomCode).emit('next_round', {
                winnerId: socket.id,
                winningWord: word,
                scores: { p1: room.p1Score, p2: room.p2Score }
            });
            
            // Clean up for next round
            room.p1Letter = null;
            room.p2Letter = null;
        }
    });

    socket.on('disconnect', () => {
        // Simple cleanup: if anyone leaves, kill the room
        for (const code in rooms) {
            if (rooms[code].p1 === socket.id || rooms[code].p2 === socket.id) {
                io.to(code).emit('player_left');
                delete rooms[code];
            }
        }
    });
});

// server.listen(3001, () => console.log('SERVER RUNNING ON PORT 3001'));
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER RUNNING ON PORT ${PORT}`));