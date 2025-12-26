import { Copy, Users, LogOut, Swords, Crown, Play, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { GameState } from '../../types';
import { socket } from '../../socketClient';

interface Props {
  playerName: string;
  setPlayerName: (n: string) => void;
  state: GameState;
  onCreate: () => void;
  createRoyaleRoom: () => void;
  onJoin: (code: string) => void;
  onJoinRoyale: () => void;
  onQueue: () => void;
  onLeaveQueue: () => void;
  onReady: () => void;
  onCopy: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onStartRoyale: (rounds: number) => void;
  onLeaveRoom: () => void;
}

export function Lobby({
  playerName,
  setPlayerName,
  state,
  onCreate,
  createRoyaleRoom,
  onJoin,
  onJoinRoyale,
  onQueue,
  onLeaveQueue,
  onReady,
  onCopy,
  onAccept,
  onDecline,
  onStartRoyale,
  onLeaveRoom,
}: Props) {
  const [tab, setTab] = useState<'1V1' | 'ROYALE'>('1V1');
  const [inputCode, setInputCode] = useState('');
  const [roundsConfig, setRoundsConfig] = useState(10);
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueTime, setQueueTime] = useState(0);
  const [matchTimeLeft, setMatchTimeLeft] = useState(10);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const onCount = (c: number) => setOnlineCount(c);
    socket.on('online_count', onCount);
    socket.emit('request_online_count');
    return () => { socket.off('online_count', onCount); };
  }, []);

  useEffect(() => {
    const resetJoin = () => setIsJoining(false);
    socket.on('error_message', resetJoin);
    socket.on('joined_room', resetJoin);
    return () => {
      socket.off('error_message', resetJoin);
      socket.off('joined_room', resetJoin);
    };
  }, []);

  useEffect(() => {
    let i: number | undefined;
    if (isQueuing && !state.pendingMatch) {
      i = window.setInterval(() => setQueueTime((t) => t + 1), 1000);
    } else {
      setQueueTime(0);
    }
    return () => { if (i) clearInterval(i); };
  }, [isQueuing, state.pendingMatch]);

  useEffect(() => {
    if (!state.pendingMatch && hasAccepted) {
      setHasAccepted(false);
      setIsQueuing(false);
    }
  }, [state.pendingMatch, hasAccepted]);

  useEffect(() => {
    if (!state.pendingMatch) return;
    const end = state.pendingMatch.expiresAt;
    const i = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setMatchTimeLeft(left);
      if (left <= 0) clearInterval(i);
    }, 100);
    return () => clearInterval(i);
  }, [state.pendingMatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleJoinRoyaleRandom = () => {
    if (isJoining) return;
    setIsJoining(true);
    onJoinRoyale();
    setTimeout(() => setIsJoining(false), 3000);
  };

  // --- MATCH FOUND OVERLAY (High Contrast) ---
  if (state.pendingMatch) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100/90 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center space-y-8 shadow-2xl animate-in zoom-in-95">
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic text-emerald-500 dark:text-emerald-400 tracking-tighter">MATCH FOUND</h2>
            <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">Accept to play</p>
          </div>
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="60" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="8" fill="none" />
              <circle
                cx="64"
                cy="64"
                r="60"
                stroke="#10b981"
                strokeWidth="8"
                fill="none"
                strokeDasharray="377"
                strokeDashoffset={377 * (1 - matchTimeLeft / 10)}
                className="transition-[stroke-dashoffset] duration-200 linear"
              />
            </svg>
            <span className="text-4xl font-black text-slate-900 dark:text-white">{matchTimeLeft}</span>
          </div>
          {!hasAccepted ? (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={onDecline}
                className="py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-300 font-black hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition"
              >
                DECLINE
              </button>
              <button
                onClick={() => { setHasAccepted(true); onAccept(); }}
                className="py-4 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/40 transition active:scale-95"
              >
                ACCEPT
              </button>
            </div>
          ) : (
            <div className="py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 dark:text-emerald-400 font-black tracking-widest animate-pulse">
              WAITING...
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ROOM LOBBY (Royale - Purple) ---
  if (state.roomCode && state.mode === 'ROYALE') {
      const me = state.royalePlayers.find((p) => p.id === socket.id);
      const isHost = me?.isHost;

      return (
        <div className="h-full flex items-start justify-center p-4 pt-20 md:pt-32">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl space-y-6 flex flex-col max-h-[80vh] transition-colors">
            
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <Crown size={24} />
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">ROYALE LOBBY</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    CODE: <span className="text-purple-600 dark:text-purple-400 font-mono tracking-wider">{state.roomCode}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onCopy} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <Copy size={20} />
                </button>
                <button onClick={onLeaveRoom} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition">
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {state.royalePlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                        p.isHost ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}>
                      {p.isHost ? <Crown size={14} /> : p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-bold ${p.id === socket.id ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {p.name} {p.id === socket.id && '(YOU)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-white/5 space-y-4">
              {isHost && (
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Max Rounds</span>
                        <span className="font-mono text-purple-600 dark:text-purple-400 font-black text-lg">{roundsConfig}</span>
                    </div>
                    <input 
                        type="range" min={5} max={30} step={5} value={roundsConfig} 
                        onChange={(e) => setRoundsConfig(parseInt(e.target.value))}
                        className="w-full accent-purple-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
              )}

              {isHost ? (
                <button
                  onClick={() => onStartRoyale(roundsConfig)}
                  disabled={state.royalePlayers.length < 2}
                  className={`w-full py-4 rounded-xl font-black text-xl shadow-lg transition flex items-center justify-center gap-2 ${
                    state.royalePlayers.length < 2
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/30 dark:shadow-purple-900/40'
                  }`}
                >
                  {state.royalePlayers.length < 2 ? 'WAITING FOR PLAYERS...' : <><Play size={20} fill="currentColor"/> START GAME</>}
                </button>
              ) : (
                <div className="text-center text-slate-400 dark:text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs py-2">
                  Waiting for Host to start...
                </div>
              )}
            </div>
          </div>
        </div>
      );
  }

  // --- ROOM LOBBY (Classic 1v1 - Green) ---
  if (state.roomCode && state.mode === '1v1') {
      const isP1 = state.myRole === 'p1';
      const meReady = isP1 ? state.readyStatus.p1 : state.readyStatus.p2;
      const oppReady = isP1 ? state.readyStatus.p2 : state.readyStatus.p1;
      const oppName = isP1 ? state.names.p2 : state.names.p1;

    return (
      <div className="h-full flex items-start justify-center p-4 pt-20 md:pt-32">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl text-center space-y-6 relative transition-colors">
          <button onClick={onLeaveRoom} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition">
            <LogOut size={20} />
          </button>

          <div className="space-y-2">
            <h2 className="text-3xl font-black italic text-slate-900 dark:text-white">1v1 LOBBY</h2>
            <div className="flex items-center justify-center gap-3">
              <div className="text-4xl font-mono font-black tracking-widest text-emerald-500 dark:text-emerald-300">{state.roomCode}</div>
              <button onClick={onCopy} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-white">
                <Copy size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${meReady ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{playerName || 'YOU'}</div>
              <div className={`font-bold ${meReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`}>
                {meReady ? 'READY' : 'NOT READY'}
              </div>
            </div>
            <div className={`p-4 rounded-2xl border ${oppReady ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{oppName}</div>
              <div className={`font-bold ${oppReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`}>
                {oppReady ? 'READY' : 'WAITING...'}
              </div>
            </div>
          </div>

          <button
            onClick={onReady}
            disabled={meReady}
            className={`w-full py-4 rounded-2xl font-black text-xl transition active:scale-[0.99] ${
              meReady
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/20'
            }`}
          >
            {meReady ? 'WAITING FOR OPPONENT...' : 'I AM READY'}
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN MENU ---
  return (
    <div className="h-full flex items-start justify-center p-4 pt-20 md:pt-32">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-10 right-4 flex items-center gap-2 text-slate-500/80">
          <Users size={16} />
          <span className="font-bold font-mono text-sm">{onlineCount}</span>
        </div>

        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl relative overflow-hidden transition-colors">
          <div className="text-center space-y-4 relative z-10">
            
            <div className="space-y-4">
                <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-none pb-2">
                LETTERS
                </h1>
                <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-white dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center font-black text-lg focus:border-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE"
                    className="w-full bg-white dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center font-mono text-xl uppercase focus:border-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                />
                <button
                    onClick={() => onJoin(inputCode)}
                    disabled={!inputCode.trim()}
                    className="px-6 rounded-2xl font-black bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white disabled:opacity-50 transition"
                >
                    GO
                </button>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 w-full my-2" />

            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => { setTab('1V1'); if (isQueuing) { onLeaveQueue(); setIsQueuing(false); } }}
                className={`py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black tracking-wide transition ${
                  tab === '1V1' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow' : 'text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400'
                }`}
              >
                <Swords size={16} /> CLASSIC 1v1
              </button>

              <button
                onClick={() => { setTab('ROYALE'); }}
                className={`py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black tracking-wide transition ${
                  tab === 'ROYALE'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow'
                    : 'text-slate-400 hover:text-purple-500 dark:hover:text-purple-400'
                }`}
              >
                <Crown size={16} /> ROYALE
              </button>
            </div>

            {tab === '1V1' && (
              <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                {isQueuing ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-4">
                     <div className="relative flex items-center justify-center w-24 h-24">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-75"></div>
                        <div className="absolute inset-2 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border border-emerald-500/30 z-10">
                             <span className="font-mono font-black text-xl text-emerald-500 dark:text-emerald-400 tracking-wider">{formatTime(queueTime)}</span>
                        </div>
                     </div>
                     <div className="space-y-3 text-center">
                        <div className="text-xs font-black tracking-[0.4em] uppercase text-emerald-600/80 dark:text-emerald-500/80 animate-pulse">
                            Searching
                        </div>
                        <button onClick={() => { onLeaveQueue(); setIsQueuing(false); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white transition uppercase tracking-widest border-b border-transparent hover:border-slate-400">
                            Cancel
                        </button>
                     </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button onClick={() => { onQueue(); setIsQueuing(true); }} className="py-6 rounded-2xl font-black text-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/20 transition flex flex-col items-center gap-2">
                      <Swords size={24} /> FIND MATCH
                    </button>
                    <button onClick={onCreate} className="py-6 rounded-2xl font-black text-lg bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition flex flex-col items-center gap-2">
                        <Plus size={24} className="text-slate-400 dark:text-slate-400" /> CREATE 1v1
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === 'ROYALE' && (
              <div className="space-y-3 mt-4 animate-in slide-in-from-right-4 fade-in duration-300">
                <button onClick={handleJoinRoyaleRandom} disabled={isJoining} className="w-full py-4 rounded-2xl font-black text-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30 dark:shadow-purple-900/30 transition flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait">
                  {isJoining ? 'JOINING...' : <><Users size={24} /> JOIN RANDOM LOBBY</>}
                </button>
                <button onClick={createRoyaleRoom} className="w-full py-3 rounded-2xl font-bold text-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 flex items-center justify-center gap-2 transition">
                  <Crown size={20} /> CREATE ROYALE LOBBY
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}