// types.ts

export type GamePhase = 'LOBBY' | 'PRE' | 'PICKING' | 'RACING' | 'ROUND_RESULT' | 'GAME_OVER';
export type GameMode = '1v1' | 'ROYALE';
export type Role = 'p1' | 'p2';

export type Names = { p1: string; p2: string };
export type Scores = { p1: number; p2: number };

export type RoyalePlayer = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  ready?: boolean;
  // New fields for tracking round progress
  finishedRound: boolean;
  roundPoints: number; // Points gained in the *current/last* round
};

export type LogEntry = {
  id: number;
  text: string;
  by: Role | string;
  isError: boolean;
};

export type Toast = { id: number; msg: string };

export type RoundResultData = {
  winnerRole: Role | null;
  winnerName?: string | null;
  word: string | null;
  scores?: Scores;
};

export type RematchStatus = { p1: boolean; p2: boolean };
export type ReadyStatus = { p1: boolean; p2: boolean };
export type PendingMatch = { matchId: string; expiresAt: number };

export type GameState = {
  mode: GameMode;
  phase: GamePhase;
  roomCode: string;
  playerKey: string;
  
  // 1v1
  myRole: Role | null;
  names: Names;
  scores: Scores;
  matchWins: { me: number; opp: number };
  readyStatus: ReadyStatus;
  
  // Royale
  royalePlayers: RoyalePlayer[];
  currentRound: number;
  totalRounds: number;
  
  // Shared
  preEndsAt: number | null;
  pickEndsAt: number | null;
  roundEndsAt: number | null;
  resultEndsAt: number | null;
  activeLetters: string[];
  lockedLetter: string | null;
  battleLog: LogEntry[];
  opponentTyping: boolean; 
  roundResult: RoundResultData | null; 
  matchWord: string;
  rematchStatus: RematchStatus | null;
  pendingMatch: PendingMatch | null;
};