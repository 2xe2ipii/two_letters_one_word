module.exports = {
  WINNING_SCORE: 10,
  MIN_LENGTH: 3,
  
  TIMERS: {
    PRE_MS: 3000,           // "Get Ready" time
    PICK_MS: 5000,          // Letter picking time
    ROUND_MS: 20000,        // Racing time
    RESULT_MS: 3000,        // Dead screen time (New)
    RECONNECT_GRACE_MS: 8000, 
  },

  PHASES: {
    LOBBY: 'LOBBY',
    PRE: 'PRE',
    PICKING: 'PICKING',
    RACING: 'RACING',
    ROUND_RESULT: 'ROUND_RESULT', // New Phase
    GAME_OVER: 'GAME_OVER',
  }
};