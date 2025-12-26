export type GamePhase = 'LOBBY' | 'PRE' | 'PICKING' | 'RACING' | 'ROUND_RESULT' | 'GAME_OVER';
export type GameMode = '1v1' | 'ROYALE';

export interface RoyalePlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  finishedRound?: boolean;
  roundPoints?: number;
}

export interface Toast {
  id: number;
  msg: string;
}

export interface Names {
  p1: string;
  p2: string;
}

export interface Scores {
  p1: number;
  p2: number;
}

export interface ReadyStatus {
  p1: boolean;
  p2: boolean;
}

export interface RematchStatus {
  p1: boolean;
  p2: boolean;
}

export interface PendingMatch {
  matchId: string;
  expiresAt: number;
}

export interface LogEntry {
  id: number;
  text: string;
  by: 'me' | 'opp' | 'p1' | 'p2';
  isError: boolean;
}

export interface RoundResultData {
  winnerRole?: 'p1' | 'p2' | null;
  winnerName?: string | null;
  word?: string | null;
}

export interface GameState {
  phase: GamePhase;
  roomCode: string;
  playerKey: string;
  myRole: 'p1' | 'p2' | null;
  mode: GameMode;
  
  // 1v1 Specific
  names: Names;
  scores: Scores;
  matchWins: { me: number; opp: number };
  readyStatus: ReadyStatus;
  opponentTyping: boolean;
  rematchStatus: RematchStatus | null;
  pendingMatch: PendingMatch | null;

  // Royale Specific
  royalePlayers: RoyalePlayer[];
  currentRound: number;
  totalRounds: number;

  // Shared / Game Logic
  preEndsAt: number | null;
  pickEndsAt: number | null;
  roundEndsAt: number | null;
  resultEndsAt: number | null;
  activeLetters: string[];
  lockedLetter: string | null;
  battleLog: LogEntry[];
  matchWord: string;
  roundResult: RoundResultData | null;
}