import { useEffect, useRef, useState } from 'react';
import { socket } from '../socketClient';
import confetti from 'canvas-confetti';
import type {
  GameState,
  LogEntry,
  Names,
  PendingMatch,
  RematchStatus,
  Scores,
  ReadyStatus
} from '../types';

const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 16);

export function useGameSocket(
  playerName: string,
  playSfx: (k: 'click' | 'point' | 'win' | 'lose') => void,
  toast: (msg: string) => void
) {
  const [state, setState] = useState<GameState>({
    phase: 'LOBBY',
    roomCode: '',
    playerKey: '',
    myRole: null,
    names: { p1: 'Player 1', p2: 'Player 2' },
    scores: { p1: 0, p2: 0 },
    matchWins: { me: 0, opp: 0 },
    readyStatus: { p1: false, p2: false },
    preEndsAt: null,
    pickEndsAt: null,
    roundEndsAt: null,
    resultEndsAt: null,
    activeLetters: [],
    lockedLetter: null,
    battleLog: [],
    opponentTyping: false,
    roundResult: null,
    matchWord: '',
    rematchStatus: null,
    pendingMatch: null,

    // Royale State Defaults
    mode: '1v1',
    royalePlayers: [],
    currentRound: 0,
    totalRounds: 0
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const playerNameRef = useRef(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  const opponentTypingTimeout = useRef<number | null>(null);

  const updateState = (updates: Partial<GameState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const clearSession = () => {
    localStorage.removeItem('wr_session');
    setState((prev) => ({
      ...prev,
      roomCode: '',
      playerKey: '',
      myRole: null,
      phase: 'LOBBY',
      names: { p1: 'Player 1', p2: 'Player 2' },
      scores: { p1: 0, p2: 0 },
      readyStatus: { p1: false, p2: false },
      preEndsAt: null,
      pickEndsAt: null,
      roundEndsAt: null,
      resultEndsAt: null,
      activeLetters: [],
      lockedLetter: null,
      battleLog: [],
      matchWord: '',
      roundResult: null,
      rematchStatus: null,
      pendingMatch: null,

      // Royale Reset
      mode: '1v1',
      royalePlayers: [],
      currentRound: 0,
      totalRounds: 0
    }));
  };

  // -------------------------
  // Emits
  // -------------------------

  const createRoom = () => socket.emit('create_room'); // Default 1v1
  
  // FIX: This was missing from the export list below
  const createRoyaleRoom = () => socket.emit('create_room', { mode: 'ROYALE' });

  const joinRoom = (code: string) => {
    // Pass name so if we join Royale, we enter with a name immediately
    socket.emit('join_room', { code, name: playerNameRef.current });
  };

  const joinRoyale = () => {
    socket.emit('join_royale', { username: playerNameRef.current });
  };

  const startRoyale = (rounds: number) => {
    socket.emit('start_royale', { 
        roomCode: stateRef.current.roomCode,
        config: { totalRounds: rounds }
    });
  };

  // FIX: Explicit leave room action
  const leaveRoom = () => {
    const { roomCode } = stateRef.current;
    if (roomCode) {
        socket.emit('leave_room', { roomCode });
    }
    clearSession();
  };

  const joinQueue = () => socket.emit('join_queue');
  const leaveQueue = () => socket.emit('leave_queue');

  const acceptMatch = () => {
    const pm = stateRef.current.pendingMatch;
    if (pm) socket.emit('accept_match', { matchId: pm.matchId });
  };

  const declineMatch = () => {
    const pm = stateRef.current.pendingMatch;
    if (pm) {
      socket.emit('decline_match', { matchId: pm.matchId });
      updateState({ pendingMatch: null });
    }
  };

  const setName = () => {
    const { roomCode, playerKey } = stateRef.current;
    const name = cleanName(playerNameRef.current);
    if (roomCode && playerKey && name) {
      socket.emit('set_name', { roomCode, playerKey, name });
    }
  };

  const sendReady = () => {
    const { roomCode, playerKey } = stateRef.current;
    socket.emit('player_ready', { roomCode, playerKey });
  };

  const submitLetter = (l: string) => {
    const { roomCode, playerKey } = stateRef.current;
    updateState({ lockedLetter: l });
    socket.emit('submit_letter', { roomCode, playerKey, letter: l });
  };

  const submitWord = (w: string) => {
    const { roomCode, playerKey } = stateRef.current;
    socket.emit('submit_word', { roomCode, playerKey, word: w });
    socket.emit('typing_stop', { roomCode, playerKey });
  };

  const sendTyping = (isTyping: boolean) => {
    const { roomCode, playerKey } = stateRef.current;
    socket.emit(isTyping ? 'typing' : 'typing_stop', { roomCode, playerKey });
  };

  const requestRematch = () => {
    const { roomCode, playerKey } = stateRef.current;
    socket.emit('request_rematch', { roomCode, playerKey });
  };

  // -------------------------
  // Listeners
  // -------------------------

  useEffect(() => {
    const tryAutoRejoin = () => {
      const raw = localStorage.getItem('wr_session');
      if (!raw) return;
      try {
        const sess = JSON.parse(raw);
        if (sess?.roomCode && sess?.playerKey) socket.emit('rejoin_room', sess);
      } catch {}
    };

    socket.on('connect', tryAutoRejoin);

    const onJoin = ({ code, role, playerKey, mode }: any) => {
      const isRoyale = String(mode || '').toUpperCase() === 'ROYALE';
      updateState({
        roomCode: code,
        myRole: role ?? null,
        playerKey,
        pendingMatch: null,
        mode: isRoyale ? 'ROYALE' : '1v1'
      });

      localStorage.setItem('wr_session', JSON.stringify({ roomCode: code, playerKey }));
      setName();
    };

    socket.on('room_created', onJoin);
    socket.on('joined_room', onJoin);
    socket.on('rejoined_room', onJoin);
    socket.on('rejoin_failed', clearSession);

    socket.on('names_update', (names: Names) => updateState({ names }));
    socket.on('ready_status', (rs: ReadyStatus) => updateState({ readyStatus: rs }));

    socket.on('match_found', ({ matchId, expiresAt }: PendingMatch) => {
      playSfx('point');
      updateState({ pendingMatch: { matchId, expiresAt } });
    });

    socket.on('match_cancelled', ({ reason }: { reason: string }) => {
      updateState({ pendingMatch: null });
      toast(reason);
    });

    socket.on('sync_state', (s: any) => {
      updateState({
        phase: s.phase,
        names: s.names,
        scores: s.scores,
        matchWord: s.winningWord,
        readyStatus: s.ready || { p1: false, p2: false },
        preEndsAt: s.preEndsAt,
        pickEndsAt: s.pickEndsAt,
        roundEndsAt: s.roundEndsAt,
        resultEndsAt: s.resultEndsAt,
        activeLetters: s.letters || [],
        rematchStatus: s.rematch
      });
    });

    socket.on('pre_game', ({ endsAt }: any) => {
      updateState({
        phase: 'PRE',
        preEndsAt: endsAt,
        pickEndsAt: null,
        roundEndsAt: null,
        resultEndsAt: null,
        rematchStatus: null,
        roundResult: null,
        matchWord: '',
        activeLetters: [],
        lockedLetter: null,
        battleLog: []
      });
      setName();
    });

    socket.on('pick_start', ({ endsAt }: any) => {
      updateState({
        phase: 'PICKING',
        pickEndsAt: endsAt,
        preEndsAt: null,
        roundEndsAt: null,
        resultEndsAt: null,
        activeLetters: [],
        lockedLetter: null,
        battleLog: [],
        opponentTyping: false
      });
    });

    socket.on('round_start', ({ letters, endsAt, round }: any) => {
      const isRoyale = stateRef.current.mode === 'ROYALE' || typeof round === 'number';

      updateState({
        phase: 'RACING',
        roundEndsAt: endsAt,
        pickEndsAt: null,
        resultEndsAt: null,
        activeLetters: letters || [],
        roundResult: null,
        battleLog: [],
        opponentTyping: false,
        ...(isRoyale ? { mode: 'ROYALE', currentRound: round ?? stateRef.current.currentRound } : {})
      });
    });

    socket.on('round_result', (payload: any) => {
      const endsAt = payload?.endsAt;

      // Royale Result
      if (payload && typeof payload.winnerName !== 'undefined' && !payload.scores) {
        updateState({
          mode: 'ROYALE',
          phase: 'ROUND_RESULT',
          resultEndsAt: endsAt,
          roundEndsAt: null,
          lockedLetter: null,
          roundResult: { winnerRole: null, winnerName: payload.winnerName, word: payload.word || null } as any,
          currentRound: typeof payload.round === 'number' ? payload.round : stateRef.current.currentRound
        });
        playSfx('click');
        return;
      }

      // 1v1 Result
      const { winnerRole, word, scores } = payload || {};
      updateState({
        phase: 'ROUND_RESULT',
        resultEndsAt: endsAt,
        roundEndsAt: null,
        scores,
        roundResult: { winnerRole, word },
        lockedLetter: null
      });

      const won = winnerRole === stateRef.current.myRole;
      if (winnerRole) playSfx(won ? 'point' : 'click');
    });

    socket.on('match_over', (payload: any) => {
      // Royale Match Over
      if (payload && Array.isArray(payload.leaderboard)) {
        updateState({
          mode: 'ROYALE',
          phase: 'GAME_OVER'
        });
        playSfx('lose');
        return;
      }

      // 1v1 Match Over
      const { winnerRole, winningWord, scores } = payload || {};
      const won = winnerRole === stateRef.current.myRole;
      playSfx(won ? 'win' : 'lose');
      if (won) confetti({ particleCount: 180, spread: 75, origin: { y: 0.7 } });

      updateState({
        phase: 'GAME_OVER',
        scores,
        matchWord: winningWord,
        matchWins: {
          me: stateRef.current.matchWins.me + (won ? 1 : 0),
          opp: stateRef.current.matchWins.opp + (won ? 0 : 1)
        }
      });
    });

    socket.on('attempt_failed', ({ playerId, text, reason }: any) => {
      const by = playerId === socket.id ? 'me' : 'opp';
      const entry: LogEntry = {
        id: Date.now() + Math.random(),
        text: reason ? `${text} (${reason})` : String(text || ''),
        by: by as any,
        isError: true
      };
      setState((prev) => ({ ...prev, battleLog: [...prev.battleLog.slice(-6), entry] }));
    });

    socket.on('opponent_typing', ({ typing }: { typing: boolean }) => {
      updateState({ opponentTyping: typing });
      if (opponentTypingTimeout.current) clearTimeout(opponentTypingTimeout.current);
      if (typing) {
        opponentTypingTimeout.current = window.setTimeout(
          () => updateState({ opponentTyping: false }),
          850
        );
      }
    });

    socket.on('rematch_status', (rematchStatus: RematchStatus) => updateState({ rematchStatus }));

    socket.on('rematch_started', ({ scores }: { scores: Scores }) => {
      updateState({
        phase: 'LOBBY',
        scores,
        rematchStatus: null,
        matchWord: '',
        roundResult: null,
        activeLetters: [],
        lockedLetter: null,
        readyStatus: { p1: false, p2: false }
      });
    });

    socket.on('opponent_joined', () => toast('Opponent Joined'));
    socket.on('opponent_left', () => {
      toast('Opponent Left');
      clearSession();
    });

    socket.on('error_message', (msg: string) => alert(msg));

    // Royale Updates
    socket.on('royale_state_update', (data: any) => {
      updateState({
        mode: 'ROYALE',
        phase: data.phase ?? stateRef.current.phase,
        royalePlayers: data.players ?? stateRef.current.royalePlayers,
        currentRound: typeof data.round === 'number' ? data.round : stateRef.current.currentRound,
        totalRounds: typeof data.totalRounds === 'number' ? data.totalRounds : stateRef.current.totalRounds,
        activeLetters: data.letters || [],
        roundEndsAt: data.roundEndsAt || stateRef.current.roundEndsAt,
        resultEndsAt: data.resultEndsAt ?? stateRef.current.resultEndsAt,
        preEndsAt: data.preEndsAt ?? stateRef.current.preEndsAt
      });
    });

    socket.on('royale_submission', (data: any) => {
      const player = stateRef.current.royalePlayers?.find((p: any) => p.id === data.playerId);
      const name = player ? player.name : 'Unknown';
      const entry: LogEntry = {
        id: Date.now(),
        text: `${name}: ${data.word} (+${data.points})`,
        by: 'p1' as any,
        isError: false
      };
      setState((prev) => ({ ...prev, battleLog: [...prev.battleLog.slice(-6), entry] }));
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (state.roomCode) setName();
  }, [playerName]);

  return {
    state,
    createRoom,
    createRoyaleRoom,
    joinRoom,
    joinRoyale,
    startRoyale, // <--- This now accepts an argument
    leaveRoom,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    sendReady,
    submitLetter,
    submitWord,
    sendTyping,
    requestRematch
  };
}