export type GamePhase = 'LOBBY' | 'PRE' | 'PICKING' | 'RACING' | 'ROUND_RESULT' | 'GAME_OVER';

export type Role = 'p1' | 'p2';

export type Names = { p1: string; p2: string };

export type Scores = { p1: number; p2: number };

export type LogEntry = {
  id: number;
  text: string;
  by: Role;
  isError: boolean;
};

export type Toast = { id: number; msg: string };

export type RoundResultData = {
  winnerRole: Role | null;
  word: string | null;
};

export type RematchStatus = { p1: boolean; p2: boolean };

export type ReadyStatus = { p1: boolean; p2: boolean };

export type PendingMatch = {
  matchId: string;
  expiresAt: number;
};

export type GameState = {
  phase: GamePhase;
  roomCode: string;
  playerKey: string;
  myRole: Role | null;
  names: Names;
  scores: Scores;
  matchWins: { me: number; opp: number };
  
  // Ready
  readyStatus: ReadyStatus;
  
  // Timers
  preEndsAt: number | null;
  pickEndsAt: number | null;
  roundEndsAt: number | null;
  resultEndsAt: number | null;
  
  // Round Specific
  activeLetters: string[];
  lockedLetter: string | null;
  battleLog: LogEntry[];
  opponentTyping: boolean;
  roundResult: RoundResultData | null; // Data for dead screen
  matchWord: string;
  
  // Rematch
  rematchStatus: RematchStatus | null;

  pendingMatch: PendingMatch | null;
};