// App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX, Copy, X } from 'lucide-react';

const socket: Socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');

type GamePhase = 'LOBBY' | 'PRE' | 'PICKING' | 'RACING' | 'GAME_OVER';
type Names = { p1: string; p2: string };

type LogEntry = {
  id: number;
  text: string;
  by: 'p1' | 'p2';
  isError: boolean;
};

type Toast = { id: number; msg: string };

type RoundNotice =
  | { kind: 'POINT'; winnerRole: 'p1' | 'p2'; word: string }
  | { kind: 'NO_POINT' };

const PRE_MS = 5000;
const PICK_MS = 5000;
const ROUND_MS = 20000;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const cleanName = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 16);

export default function App() {
  // Identity/session
  const [playerName, setPlayerName] = useState('');
  const [playerKey, setPlayerKey] = useState('');
  const [myRole, setMyRole] = useState<'p1' | 'p2' | null>(null);

  const playerKeyRef = useRef('');
  const playerNameRef = useRef('');
  const myRoleRef = useRef<'p1' | 'p2' | null>(null);

  useEffect(() => {
    playerKeyRef.current = playerKey;
  }, [playerKey]);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);
  useEffect(() => {
    myRoleRef.current = myRole;
  }, [myRole]);

  // Room
  const [roomCode, setRoomCode] = useState('');
  const roomCodeRef = useRef('');
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  const [names, setNames] = useState<Names>({ p1: 'Player 1', p2: 'Player 2' });

  // UI phase
  const [phase, setPhase] = useState<GamePhase>('LOBBY');

  // Lobby join
  const [joinCode, setJoinCode] = useState('');

  // Timers (endsAt from server)
  const [preEndsAt, setPreEndsAt] = useState<number | null>(null);
  const [pickEndsAt, setPickEndsAt] = useState<number | null>(null);
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Round state
  const [lockedLetter, setLockedLetter] = useState<string | null>(null);
  const [activeLetters, setActiveLetters] = useState<string[]>([]);
  const [myInput, setMyInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Scores + session match wins
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [matchWins, setMatchWins] = useState({ me: 0, opp: 0 });

  // Battle log
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Typing indicator
  const [opponentTyping, setOpponentTyping] = useState(false);
  const opponentTypingTimeout = useRef<number | null>(null);

  // NON-BLOCKING round notice (shows above the pick UI, never a modal)
  const [roundNotice, setRoundNotice] = useState<RoundNotice | null>(null);
  // const roundNoticeTimerRef = useRef<number | null>(null);

  const showRoundNotice = (n: RoundNotice) => {
    setRoundNotice(n);
  };


  // Match over info (word is shown inside results card, not a pop-up)
  const [matchWord, setMatchWord] = useState('');

  // Rematch
  const [rematchStatus, setRematchStatus] = useState<{ p1: boolean; p2: boolean } | null>(null);

  // Toasts (ONLY: Code Copied, Opponent Joined, Opponent Left)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (msg: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, msg }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1800);
  };

  // Sound panel + audio
  const [showSoundPanel, setShowSoundPanel] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxVol, setSfxVol] = useState(0.7);
  const [musicVol, setMusicVol] = useState(0.35);

  const audioStateRef = useRef({ sfxMuted: false, musicMuted: false, sfxVol: 0.7, musicVol: 0.35 });
  const sfxRef = useRef<Record<'click' | 'point' | 'win' | 'lose', HTMLAudioElement> | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [audioArmed, setAudioArmed] = useState(false);

  useEffect(() => {
    audioStateRef.current = { sfxMuted, musicMuted, sfxVol, musicVol };
  }, [sfxMuted, musicMuted, sfxVol, musicVol]);

  // Load local name + audio
  useEffect(() => {
    const savedName = localStorage.getItem('wr_name');
    if (savedName) setPlayerName(savedName);

    sfxRef.current = {
      click: new Audio('/click.mp3'),
      point: new Audio('/point.mp3'),
      win: new Audio('/win.mp3'),
      lose: new Audio('/lose.mp3'),
    };
    Object.values(sfxRef.current).forEach((a) => (a.preload = 'auto'));

    musicRef.current = new Audio('/bg.mp3'); // optional
    musicRef.current.loop = true;
    musicRef.current.preload = 'auto';

    return () => {
      Object.values(sfxRef.current || {}).forEach((a) => a.pause());
      if (musicRef.current) musicRef.current.pause();
    };
  }, []);

  const armAudio = () => {
    if (audioArmed) return;
    setAudioArmed(true);

    const m = musicRef.current;
    if (!m) return;
    const st = audioStateRef.current;
    m.volume = st.musicMuted ? 0 : clamp01(st.musicVol);
    m.play().catch(() => {});
  };

  useEffect(() => {
    const m = musicRef.current;
    if (!m) return;
    m.volume = musicMuted ? 0 : clamp01(musicVol);
  }, [musicMuted, musicVol]);

  const playSfx = (k: 'click' | 'point' | 'win' | 'lose') => {
    const st = audioStateRef.current;
    if (st.sfxMuted) return;
    const a = sfxRef.current?.[k];
    if (!a) return;
    a.currentTime = 0;
    a.volume = clamp01(st.sfxVol);
    a.play().catch(() => {});
  };

  // Tick for bars
  useEffect(() => {
    if (!preEndsAt && !pickEndsAt && !roundEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(id);
  }, [preEndsAt, pickEndsAt, roundEndsAt]);

  const preRatio = useMemo(() => (preEndsAt ? clamp01((preEndsAt - now) / PRE_MS) : 0), [preEndsAt, now]);
  const pickRatio = useMemo(() => (pickEndsAt ? clamp01((pickEndsAt - now) / PICK_MS) : 0), [pickEndsAt, now]);
  const roundRatio = useMemo(() => (roundEndsAt ? clamp01((roundEndsAt - now) / ROUND_MS) : 0), [roundEndsAt, now]);

  // Scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [battleLog]);

  // Names
  const meName = useMemo(() => {
    if (!myRole) return 'You';
    return myRole === 'p1' ? names.p1 : names.p2;
  }, [myRole, names]);

  const oppName = useMemo(() => {
    if (!myRole) return 'Opponent';
    return myRole === 'p1' ? names.p2 : names.p1;
  }, [myRole, names]);

  const myScore = myRole === 'p1' ? scores.p1 : scores.p2;
  const oppScore = myRole === 'p1' ? scores.p2 : scores.p1;

  const meRematchReady = useMemo(() => {
    if (!rematchStatus || !myRole) return false;
    return myRole === 'p1' ? rematchStatus.p1 : rematchStatus.p2;
  }, [rematchStatus, myRole]);

  const oppRematchReady = useMemo(() => {
    if (!rematchStatus || !myRole) return false;
    return myRole === 'p1' ? rematchStatus.p2 : rematchStatus.p1;
  }, [rematchStatus, myRole]);

  const rematchMessage = useMemo(() => {
    if (!rematchStatus || !myRole) return '';
    if (meRematchReady && !oppRematchReady) return `Waiting for ${oppName}…`;
    if (!meRematchReady && oppRematchReady) return `${oppName} requested a rematch`;
    if (meRematchReady && oppRematchReady) return `Starting…`;
    return '';
  }, [rematchStatus, myRole, meRematchReady, oppRematchReady, oppName]);

  const resetRoundUI = () => {
    setLockedLetter(null);
    setActiveLetters([]);
    setMyInput('');
    setBattleLog([]);
    setOpponentTyping(false);
    setRoundEndsAt(null);
  };

  const clearSession = () => {
    localStorage.removeItem('wr_session');
    setPlayerKey('');
    setRoomCode('');
    setMyRole(null);
    setPhase('LOBBY');
    setNames({ p1: 'Player 1', p2: 'Player 2' });
    setScores({ p1: 0, p2: 0 });
    setPickEndsAt(null);
    setRoundEndsAt(null);
    setPreEndsAt(null);
    setRematchStatus(null);
    setMatchWord('');
    setRoundNotice(null);
    resetRoundUI();
  };

  // Auto-rejoin on connect (refresh-proof)
  const attemptedAutoRejoinRef = useRef(false);
  useEffect(() => {
    const tryAutoRejoin = () => {
      if (attemptedAutoRejoinRef.current) return;
      attemptedAutoRejoinRef.current = true;

      const raw = localStorage.getItem('wr_session');
      if (!raw) return;

      try {
        const sess = JSON.parse(raw);
        if (sess?.roomCode && sess?.playerKey) {
          socket.emit('rejoin_room', { roomCode: sess.roomCode, playerKey: sess.playerKey });
        }
      } catch {
        // ignore
      }
    };

    socket.on('connect', tryAutoRejoin);
    return () => {
      socket.off('connect', tryAutoRejoin);
    };
  }, []);

  // Socket listeners (ONCE)
  useEffect(() => {
    const onRoomCreated = ({ code, role, playerKey }: { code: string; role: 'p1' | 'p2'; playerKey: string }) => {
      setRoomCode(code);
      setMyRole(role);
      setPlayerKey(playerKey);
      localStorage.setItem('wr_session', JSON.stringify({ roomCode: code, playerKey }));
    };

    const onJoinedRoom = ({ code, role, playerKey }: { code: string; role: 'p1' | 'p2'; playerKey: string }) => {
      setRoomCode(code);
      setMyRole(role);
      setPlayerKey(playerKey);
      localStorage.setItem('wr_session', JSON.stringify({ roomCode: code, playerKey }));
    };

    const onRejoinedRoom = ({ code, role, playerKey }: { code: string; role: 'p1' | 'p2'; playerKey: string }) => {
      setRoomCode(code);
      setMyRole(role);
      setPlayerKey(playerKey);
      localStorage.setItem('wr_session', JSON.stringify({ roomCode: code, playerKey }));
    };

    const onRejoinFailed = () => {
      clearSession();
    };

    const onNamesUpdate = (n: Names) => {
      setNames({ p1: n?.p1 || 'Player 1', p2: n?.p2 || 'Player 2' });
    };

    const onSyncState = (s: any) => {
      if (s?.names) setNames(s.names);
      if (s?.scores) setScores(s.scores);
      if (s?.rematch) setRematchStatus(s.rematch);
      if (typeof s?.winningWord === 'string') setMatchWord(s.winningWord);

      setPreEndsAt(s?.preEndsAt || null);
      setPickEndsAt(s?.pickEndsAt || null);
      setRoundEndsAt(s?.roundEndsAt || null);

      const phaseFromServer: GamePhase =
        s?.phase === 'PRE'
          ? 'PRE'
          : s?.phase === 'PICKING'
          ? 'PICKING'
          : s?.phase === 'RACING'
          ? 'RACING'
          : s?.phase === 'GAME_OVER'
          ? 'GAME_OVER'
          : 'LOBBY';

      setPhase(phaseFromServer);

      const letters = s?.letters || [];
      if (Array.isArray(letters) && letters.length === 2 && letters[0] && letters[1]) {
        setActiveLetters([String(letters[0]), String(letters[1])]);
      }
    };

    const onOpponentJoined = () => {
      toast('Opponent joined');
    };

    const onPreGame = ({ endsAt }: { endsAt: number }) => {
      setPhase('PRE');
      setPreEndsAt(endsAt);
      setPickEndsAt(null);
      setRoundEndsAt(null);
      setRematchStatus(null);
      setRoundNotice(null);
      resetRoundUI();

      // push our name asap
      const nm = cleanName(playerNameRef.current);
      if (roomCodeRef.current && playerKeyRef.current && nm) {
        socket.emit('set_name', { roomCode: roomCodeRef.current, playerKey: playerKeyRef.current, name: nm });
      }
    };

    const onPickStart = ({ endsAt }: { endsAt: number }) => {
      setPhase('PICKING');
      setPreEndsAt(null);
      setPickEndsAt(endsAt);
      setRoundEndsAt(null);

      setLockedLetter(null);
      setActiveLetters([]);
      setMyInput('');
      setBattleLog([]);
      setOpponentTyping(false);
      // NOTE: keep roundNotice visible (non-blocking) if it exists
    };

    const onRoundStart = ({ letters, endsAt }: { letters: string[]; endsAt: number }) => {
      setRoundNotice(null); // ← IMPORTANT

      setPhase('RACING');
      setPickEndsAt(null);
      setRoundEndsAt(endsAt);

      setActiveLetters(letters);
      setMyInput('');
      setBattleLog([]);
      setOpponentTyping(false);

      setTimeout(() => inputRef.current?.focus(), 60);
  };


    const onFailedAttempt = ({ by, word, reason }: { by: 'p1' | 'p2'; word: string; reason: string }) => {
      setBattleLog((prev) => [
        ...prev.slice(-6),
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          text: `${String(word || '').trim()} (${reason})`,
          by,
          isError: true,
        },
      ]);
    };

    const onNextRound = ({
      winnerRole,
      winningWord,
      scores,
    }: {
      winnerRole: 'p1' | 'p2';
      winningWord: string;
      scores: { p1: number; p2: number };
    }) => {
      setScores(scores);

      // Force both clients out of racing immediately
      setPhase('PICKING');
      setRoundEndsAt(null);
      resetRoundUI();

      // Non-blocking notice (no modal)
      showRoundNotice({ kind: 'POINT', winnerRole, word: String(winningWord || '').trim() });

      playSfx(winnerRole === myRoleRef.current ? 'point' : 'click');
    };

    const onRoundTimeout = ({ scores }: { scores: { p1: number; p2: number } }) => {
      setScores(scores);
      setPhase('PICKING');
      setRoundEndsAt(null);
      resetRoundUI();
      showRoundNotice({ kind: 'NO_POINT' });
    };

    const onMatchOver = ({
      winnerRole,
      winningWord,
      scores,
    }: {
      winnerRole: 'p1' | 'p2';
      winningWord: string;
      scores: { p1: number; p2: number };
    }) => {
      setScores(scores);
      setPhase('GAME_OVER');

      const word = String(winningWord || '').trim();
      setMatchWord(word);

      const won = winnerRole === myRoleRef.current;

      setMatchWins((prev) => ({
        me: prev.me + (won ? 1 : 0),
        opp: prev.opp + (won ? 0 : 1),
      }));

      playSfx(won ? 'win' : 'lose');
      if (won) confetti({ particleCount: 180, spread: 75, origin: { y: 0.7 } });
    };

    const onOpponentLeft = () => {
      if (!roomCodeRef.current) return;
      toast('Opponent left');
      clearSession();
    };

    const onOpponentTyping = ({ typing }: { typing: boolean }) => {
      setOpponentTyping(typing);
      if (opponentTypingTimeout.current) window.clearTimeout(opponentTypingTimeout.current);
      if (typing) {
        opponentTypingTimeout.current = window.setTimeout(() => setOpponentTyping(false), 850);
      }
    };

    const onRematchStatus = ({ p1, p2 }: { p1: boolean; p2: boolean }) => {
      setRematchStatus({ p1, p2 });
    };

    const onRematchStarted = ({ scores }: { scores: { p1: number; p2: number } }) => {
      setScores(scores);
      setRematchStatus(null);
      setMatchWord('');
      setRoundNotice(null);
      resetRoundUI();
      // server will send pick_start
    };

    const onErrorMessage = (msg: string) => {
      alert(msg);
    };

    socket.on('room_created', onRoomCreated);
    socket.on('joined_room', onJoinedRoom);
    socket.on('rejoined_room', onRejoinedRoom);
    socket.on('rejoin_failed', onRejoinFailed);

    socket.on('names_update', onNamesUpdate);
    socket.on('sync_state', onSyncState);

    socket.on('opponent_joined', onOpponentJoined);
    socket.on('pre_game', onPreGame);
    socket.on('pick_start', onPickStart);
    socket.on('round_start', onRoundStart);

    socket.on('failed_attempt', onFailedAttempt);
    socket.on('next_round', onNextRound);
    socket.on('round_timeout', onRoundTimeout);
    socket.on('match_over', onMatchOver);

    socket.on('opponent_left', onOpponentLeft);
    socket.on('opponent_typing', onOpponentTyping);

    socket.on('rematch_status', onRematchStatus);
    socket.on('rematch_started', onRematchStarted);

    socket.on('error_message', onErrorMessage);

    return () => {
      socket.off('room_created', onRoomCreated);
      socket.off('joined_room', onJoinedRoom);
      socket.off('rejoined_room', onRejoinedRoom);
      socket.off('rejoin_failed', onRejoinFailed);

      socket.off('names_update', onNamesUpdate);
      socket.off('sync_state', onSyncState);

      socket.off('opponent_joined', onOpponentJoined);
      socket.off('pre_game', onPreGame);
      socket.off('pick_start', onPickStart);
      socket.off('round_start', onRoundStart);

      socket.off('failed_attempt', onFailedAttempt);
      socket.off('next_round', onNextRound);
      socket.off('round_timeout', onRoundTimeout);
      socket.off('match_over', onMatchOver);

      socket.off('opponent_left', onOpponentLeft);
      socket.off('opponent_typing', onOpponentTyping);

      socket.off('rematch_status', onRematchStatus);
      socket.off('rematch_started', onRematchStarted);

      socket.off('error_message', onErrorMessage);
    };
  }, []);

  // Actions
  const requireName = () => {
    const nm = cleanName(playerName);
    if (!nm.length) {
      alert('Please enter a name first.');
      return null;
    }
    localStorage.setItem('wr_name', nm);
    setPlayerName(nm);
    return nm;
  };

  const createRoom = () => {
    armAudio();
    playSfx('click');
    const nm = requireName();
    if (!nm) return;
    socket.emit('create_room');
  };

  const joinRoom = () => {
    armAudio();
    playSfx('click');

    const nm = requireName();
    if (!nm) return;

    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    socket.emit('join_room', code);
  };

  // Push our name whenever we have room + key
  useEffect(() => {
    if (!roomCode || !playerKey) return;
    const nm = cleanName(playerName);
    if (!nm) return;
    socket.emit('set_name', { roomCode, playerKey, name: nm });
  }, [roomCode, playerKey, playerName]);

  const submitLetter = (char: string) => {
    const c = String(char || '').toUpperCase();
    if (!/^[A-Z]$/.test(c)) return;

    armAudio();
    playSfx('click');

    setLockedLetter(c);
    socket.emit('submit_letter', { roomCode, playerKey, letter: c });
  };

  const submitWord = (e: React.FormEvent) => {
    e.preventDefault();
    const w = myInput.trim();
    if (!w) return;

    armAudio();
    playSfx('click');

    socket.emit('submit_word', { roomCode, playerKey, word: w });
    setMyInput('');
    socket.emit('typing_stop', { roomCode, playerKey });
  };

  const copyCode = async () => {
    armAudio();
    playSfx('click');

    try {
      await navigator.clipboard.writeText(roomCode);
      toast('Code copied');
    } catch {
      toast('Copy failed');
    }
  };

  const requestRematch = () => {
    armAudio();
    playSfx('click');
    socket.emit('request_rematch', { roomCode, playerKey });
  };

  // Typing pings
  const lastTypingEmit = useRef(0);
  const typingStopTimer = useRef<number | null>(null);

  const onType = (v: string) => {
    setMyInput(v);

    const t = Date.now();
    if (t - lastTypingEmit.current > 140) {
      socket.emit('typing', { roomCode, playerKey });
      lastTypingEmit.current = t;
    }

    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => {
      socket.emit('typing_stop', { roomCode, playerKey });
    }, 600);
  };

  // Notice text helpers (no “winning word” wording)
  const noticeWinnerName = useMemo(() => {
    if (!roundNotice || roundNotice.kind !== 'POINT') return '';
    return roundNotice.winnerRole === myRole ? meName : oppName;
  }, [roundNotice, myRole, meName, oppName]);

  return (
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] bg-slate-950 text-white font-sans overflow-hidden">
      {/* Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] space-y-2 w-[92vw] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/80 shadow-lg text-sm font-semibold backdrop-blur"
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* HUD */}
      {phase !== 'LOBBY' && (
        <div className="w-full max-w-5xl mx-auto px-4 pt-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-3 flex items-end justify-between">
            <div className="flex flex-col items-start min-w-[120px]">
              <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{meName}</span>
              <span className="text-4xl md:text-5xl font-black text-emerald-400">{myScore}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-slate-500 font-mono text-xs">RACE TO 10</div>

              <button
                onClick={() => {
                  armAudio();
                  playSfx('click');
                  setShowSoundPanel(true);
                }}
                className="px-3 py-2 rounded-full border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 active:scale-95 transition inline-flex items-center gap-2"
                aria-label="Sound"
              >
                {sfxMuted && musicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span className="text-xs font-black tracking-widest">SOUND</span>
              </button>
            </div>

            <div className="flex flex-col items-end min-w-[120px]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{oppName}</span>
                {opponentTyping && phase === 'RACING' && (
                  <span className="text-xs text-slate-400 animate-pulse select-none">…</span>
                )}
              </div>
              <span className="text-4xl md:text-5xl font-black text-red-400">{oppScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sound panel */}
      {showSoundPanel && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-black tracking-widest">SOUND</div>
              <button
                onClick={() => {
                  playSfx('click');
                  setShowSoundPanel(false);
                }}
                className="p-2 rounded-full hover:bg-slate-800 active:scale-95 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200">Music</div>
                  <button
                    onClick={() => {
                      armAudio();
                      playSfx('click');
                      setMusicMuted((v) => !v);
                    }}
                    className="px-3 py-1 rounded-full border border-slate-700 bg-slate-800/70 hover:bg-slate-700/60 active:scale-95 transition text-xs font-black tracking-widest"
                  >
                    {musicMuted ? 'OFF' : 'ON'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={musicVol}
                  onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200">SFX</div>
                  <button
                    onClick={() => {
                      armAudio();
                      playSfx('click');
                      setSfxMuted((v) => !v);
                    }}
                    className="px-3 py-1 rounded-full border border-slate-700 bg-slate-800/70 hover:bg-slate-700/60 active:scale-95 transition text-xs font-black tracking-widest"
                  >
                    {sfxMuted ? 'OFF' : 'ON'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sfxVol}
                  onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="text-xs text-slate-500">
                Put mp3 files in <span className="font-mono">/public</span>: click.mp3, point.mp3, win.mp3, lose.mp3
                (optional: bg.mp3)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="w-full max-w-5xl mx-auto px-4">
        {/* LOBBY */}
        {phase === 'LOBBY' && (
          <div className="min-h-[100dvh] flex items-center justify-center py-10">
            <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl">
              <div className="text-center space-y-5">
                <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-none">
                  2 LETTERS
                  <br />
                  1 WORD
                </h1>

                <div className="space-y-2">
                  <div className="text-[10px] font-black tracking-[0.35em] uppercase text-slate-400">Your name</div>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onBlur={() => {
                      const nm = cleanName(playerName);
                      setPlayerName(nm);
                      if (nm) localStorage.setItem('wr_name', nm);
                    }}
                    placeholder="Name"
                    className="w-full bg-slate-800/70 border-2 border-slate-700 rounded-2xl p-4 text-center font-black text-lg focus:border-emerald-500 outline-none"
                  />
                </div>

                {!roomCode ? (
                  <div className="space-y-3">
                    <button
                      onClick={createRoom}
                      className="w-full py-4 rounded-2xl font-black text-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] transition shadow-lg shadow-emerald-900/40"
                    >
                      CREATE MATCH
                    </button>

                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="CODE"
                        className="w-full bg-slate-800/70 border-2 border-slate-700 rounded-2xl p-4 text-center font-mono text-xl uppercase focus:border-emerald-500 outline-none"
                      />
                      <button
                        onClick={joinRoom}
                        className="px-6 rounded-2xl font-black bg-slate-800 border-2 border-slate-700 hover:bg-slate-700/60 active:scale-[0.99] transition"
                      >
                        JOIN
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 space-y-4">
                    <div className="text-xs text-slate-400 font-mono uppercase tracking-widest">Waiting for opponent</div>

                    <div className="flex items-center justify-center gap-3">
                      <div className="text-5xl md:text-6xl font-mono font-black tracking-widest text-emerald-300">
                        {roomCode}
                      </div>
                      <button
                        onClick={copyCode}
                        className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700 hover:bg-slate-700/60 active:scale-95 transition"
                        aria-label="Copy room code"
                      >
                        <Copy size={20} />
                      </button>
                    </div>

                    <div className="text-slate-500 text-sm">Share the code. The game starts when they join.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MATCH FLOW */}
        {phase !== 'LOBBY' && (
          <div className="pt-6 md:pt-7 pb-12">
            {/* PRE */}
            {phase === 'PRE' && (
              <div className="mt-8 md:mt-6 mx-auto max-w-md">
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl text-center space-y-4">
                  <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-400">Get ready</div>
                  <div className="text-3xl md:text-4xl font-black">Starting soon</div>

                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-cyan-400 transition-[width] duration-75"
                      style={{ width: `${preRatio * 100}%` }}
                    />
                  </div>

                  <div className="text-sm text-slate-500">Pick a letter after this.</div>
                </div>
              </div>
            )}

            {/* PICKING */}
            {phase === 'PICKING' && (
              <div className="mt-8 md:mt-6 mx-auto max-w-md">
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-7 shadow-2xl">
                  {/* non-blocking notice (inside layout, not modal) */}
                  {roundNotice && (
                    <div className="mb-6 flex justify-center pointer-events-none">
                      {roundNotice.kind === 'POINT' ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-4 text-center">
                          <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-400">
                            {noticeWinnerName} +1
                          </div>
                          <div className="mt-2 inline-flex items-center rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                            <span className="font-mono font-black text-lg md:text-xl tracking-wider">
                              {(roundNotice.word || '').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                          <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-400">
                            NO POINT
                          </div>
                          <div className="text-sm text-slate-400 mt-1">Pick again.</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-6 text-center">
                    <div className="space-y-3">
                      <div className="text-[10px] font-black tracking-[0.35em] uppercase text-slate-400">
                        Pick a letter
                      </div>

                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="h-full bg-emerald-500 transition-[width] duration-75"
                          style={{ width: `${pickRatio * 100}%` }}
                        />
                      </div>

                      <div className="text-xs text-slate-500">
                        If you don’t pick in time, you’ll get a random letter.
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      {!lockedLetter ? (
                        <input
                          autoFocus
                          maxLength={1}
                          autoComplete="off"
                          className="w-28 h-28 md:w-32 md:h-32 bg-slate-800/70 border-4 border-slate-700 rounded-3xl text-center text-7xl md:text-8xl font-black uppercase focus:border-emerald-500 outline-none caret-transparent transition-all"
                          onChange={(e) => submitLetter(e.target.value)}
                        />
                      ) : (
                        <div className="w-28 h-28 md:w-32 md:h-32 bg-slate-800/70 border-4 border-emerald-600/70 rounded-3xl flex items-center justify-center">
                          <div className="text-7xl md:text-8xl font-black text-emerald-300">
                            {lockedLetter}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-slate-500 text-sm">{lockedLetter ? 'Locked. Waiting…' : 'Type one letter.'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* RACING */}
            {phase === 'RACING' && (
              <div className="mt-6 md:mt-5">
                <div className="w-full max-w-xl mx-auto space-y-6">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-cyan-400 transition-[width] duration-75"
                      style={{ width: `${roundRatio * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-center gap-4">
                    {activeLetters.map((l, i) => (
                      <div
                        key={i}
                        className="w-24 h-24 md:w-28 md:h-28 flex items-center justify-center bg-slate-900/60 border border-slate-800 rounded-2xl text-6xl md:text-7xl font-black shadow-xl"
                      >
                        {l}
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={submitWord}
                    className="md:static sticky bottom-3 bg-slate-900/70 backdrop-blur rounded-2xl px-3 py-4 border border-slate-800"
                  >
                    <input
                      ref={inputRef}
                      value={myInput}
                      onChange={(e) => onType(e.target.value)}
                      placeholder="TYPE"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full bg-transparent border-b-4 border-slate-700 pb-2 text-center text-5xl md:text-7xl font-black outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600 uppercase"
                    />

                    <button type="submit" className="hidden" />
                  </form>

                  <div className="w-full flex flex-col items-center justify-start space-y-2 pt-1">
                    {battleLog.map((log) => (
                      <div
                        key={log.id}
                        className={`text-xs md:text-sm font-bold px-3 py-1 rounded-full ${
                          log.isError
                            ? 'bg-red-500/15 text-red-300 border border-red-700/30'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {log.by === myRole ? 'YOU: ' : `${oppName.toUpperCase()}: `} {log.text}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            )}

            {/* GAME OVER */}
            {phase === 'GAME_OVER' && (
              <div className="mt-10 md:mt-8 mx-auto max-w-xl">
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-10 shadow-2xl text-center space-y-6">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black tracking-[0.5em] uppercase text-slate-400">Final</div>
                    <div className="text-6xl md:text-7xl font-black">
                      <span className="text-emerald-400">{myScore}</span>
                      <span className="text-slate-600 px-3">—</span>
                      <span className="text-red-400">{oppScore}</span>
                    </div>
                  </div>

                  {/* match word shown here (not a pop-up) */}
                  {matchWord && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
                      <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-400">
                        Match word
                      </div>
                      <div className="mt-2 font-mono font-black text-2xl md:text-3xl tracking-wider break-all">
                        {matchWord.toUpperCase()}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                      <div className="text-[10px] font-black tracking-widest text-slate-400">
                        SETS ({meName.toUpperCase()})
                      </div>
                      <div className="text-3xl font-black text-emerald-300">{matchWins.me}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                      <div className="text-[10px] font-black tracking-widest text-slate-400">
                        SETS ({oppName.toUpperCase()})
                      </div>
                      <div className="text-3xl font-black text-red-300">{matchWins.opp}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={requestRematch}
                      disabled={meRematchReady}
                      className={`w-full py-4 rounded-2xl font-black text-lg transition active:scale-[0.99] ${
                        meRematchReady
                          ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                          : 'bg-white text-slate-950 hover:bg-slate-200'
                      }`}
                    >
                      {meRematchReady ? 'REQUESTED' : 'REQUEST REMATCH'}
                    </button>

                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black tracking-widest ${
                          meRematchReady
                            ? 'border-emerald-700/40 bg-emerald-900/15 text-emerald-200'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400'
                        }`}
                      >
                        YOU: {meRematchReady ? 'READY' : 'WAITING'}
                      </div>
                      <div
                        className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black tracking-widest ${
                          oppRematchReady
                            ? 'border-cyan-700/40 bg-cyan-900/15 text-cyan-200'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400'
                        }`}
                      >
                        {oppName.toUpperCase()}: {oppRematchReady ? 'READY' : 'WAITING'}
                      </div>
                    </div>

                    {rematchMessage && <div className="text-sm text-slate-400">{rematchMessage}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
