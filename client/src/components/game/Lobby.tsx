import { Copy } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { GameState } from '../../types';

interface Props {
  playerName: string; setPlayerName: (n: string) => void;
  state: GameState;
  onCreate: () => void; onJoin: (code: string) => void;
  onQueue: () => void; onLeaveQueue: () => void;
  onReady: () => void; onCopy: () => void;
  onAccept: () => void; onDecline: () => void;
}

export function Lobby({ 
  playerName, setPlayerName, state, 
  onCreate, onJoin, onQueue, onLeaveQueue, 
  onReady, onCopy, onAccept, onDecline 
}: Props) {
  const [tab, setTab] = useState<'FRIEND' | 'QUEUE'>('FRIEND');
  const [inputCode, setInputCode] = useState('');
  
  // Local state for queue timer
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  // Match Accept Timer
  const [matchTimeLeft, setMatchTimeLeft] = useState(10);
  const [hasAccepted, setHasAccepted] = useState(false);

  // Queue Timer Effect
  useEffect(() => {
    let i: number;
    if (isQueuing && !state.pendingMatch) {
      i = window.setInterval(() => setQueueTime(t => t + 1), 1000);
    } else {
      setQueueTime(0);
    }
    return () => clearInterval(i);
  }, [isQueuing, state.pendingMatch]);

  // Handle External Cancel (e.g. from server)
  useEffect(() => {
    if (!state.pendingMatch && hasAccepted) {
      setHasAccepted(false); // Reset accept state if match vanished
      setIsQueuing(false); // Stop queuing visuals
    }
  }, [state.pendingMatch]);

  // Match Countdown Effect
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

  // --- MATCH FOUND OVERLAY ---
  if (state.pendingMatch) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center space-y-8 shadow-2xl animate-in zoom-in-95">
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic text-emerald-400 tracking-tighter">MATCH FOUND</h2>
            <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">Accept to play</p>
          </div>

          {/* Circle Timer Visual */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="60" stroke="#1e293b" strokeWidth="8" fill="none" />
              <circle 
                cx="64" cy="64" r="60" 
                stroke="#10b981" strokeWidth="8" fill="none" 
                strokeDasharray="377" 
                strokeDashoffset={377 * (1 - matchTimeLeft / 10)} 
                className="transition-[stroke-dashoffset] duration-200 linear"
              />
            </svg>
            <span className="text-4xl font-black text-white">{matchTimeLeft}</span>
          </div>

          {!hasAccepted ? (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onDecline}
                className="py-4 rounded-xl border-2 border-slate-700 text-slate-300 font-black hover:bg-slate-800 hover:text-white transition"
              >
                DECLINE
              </button>
              <button 
                onClick={() => { setHasAccepted(true); onAccept(); }}
                className="py-4 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-400 shadow-lg shadow-emerald-900/40 transition active:scale-95"
              >
                ACCEPT
              </button>
            </div>
          ) : (
            <div className="py-4 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-black tracking-widest animate-pulse">
              WAITING FOR OPPONENT...
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ROOM LOBBY (Inside Room) ---
  if (state.roomCode) {
    const isP1 = state.myRole === 'p1';
    const meReady = isP1 ? state.readyStatus.p1 : state.readyStatus.p2;
    const oppReady = isP1 ? state.readyStatus.p2 : state.readyStatus.p1;
    const oppName = isP1 ? state.names.p2 : state.names.p1;

    return (
      <div className="min-h-[100dvh] flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic text-white">LOBBY</h2>
            <div className="flex items-center justify-center gap-3">
              <div className="text-4xl font-mono font-black tracking-widest text-emerald-300">{state.roomCode}</div>
              <button onClick={onCopy} className="p-2 rounded-xl bg-slate-800/70 border border-slate-700 hover:bg-slate-700 text-white"><Copy size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${meReady ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1">YOU</div>
              <div className={`font-bold ${meReady ? 'text-emerald-400' : 'text-slate-300'}`}>{meReady ? 'READY' : 'NOT READY'}</div>
            </div>
            <div className={`p-4 rounded-2xl border ${oppReady ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{oppName}</div>
              <div className={`font-bold ${oppReady ? 'text-emerald-400' : 'text-slate-300'}`}>{oppReady ? 'READY' : 'WAITING...'}</div>
            </div>
          </div>

          <button 
            onClick={onReady}
            disabled={meReady}
            className={`w-full py-4 rounded-2xl font-black text-xl transition active:scale-[0.99] ${
              meReady ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20'
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
    <div className="min-h-[100dvh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl relative overflow-hidden">
        <div className="text-center space-y-6 relative z-10">
          <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-none">
            2 LETTERS<br />1 WORD
          </h1>

          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Name"
            className="w-full bg-slate-800/70 border-2 border-slate-700 rounded-2xl p-4 text-center font-black text-lg focus:border-emerald-500 outline-none text-white placeholder:text-slate-600"
          />

          <div className="grid grid-cols-2 bg-slate-800/50 p-1 rounded-2xl">
            <button 
              onClick={() => { setTab('FRIEND'); if(isQueuing) { onLeaveQueue(); setIsQueuing(false); } }}
              className={`py-3 rounded-xl text-sm font-black tracking-wide transition ${tab === 'FRIEND' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              FRIENDS
            </button>
            <button 
              onClick={() => setTab('QUEUE')}
              className={`py-3 rounded-xl text-sm font-black tracking-wide transition ${tab === 'QUEUE' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              QUEUE
            </button>
          </div>

          {tab === 'FRIEND' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="w-full bg-slate-800/70 border-2 border-slate-700 rounded-2xl p-4 text-center font-mono text-xl uppercase focus:border-emerald-500 outline-none text-white"
                />
                <button onClick={() => onJoin(inputCode)} className="px-6 rounded-2xl font-black bg-slate-800 border-2 border-slate-700 text-white hover:bg-slate-700">
                  JOIN
                </button>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-xs font-bold uppercase tracking-widest my-2">
                <div className="h-px bg-slate-800 flex-1" /> OR <div className="h-px bg-slate-800 flex-1" />
              </div>
              <button onClick={onCreate} className="w-full py-4 rounded-2xl font-black text-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg">
                CREATE MATCH
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4 min-h-[140px] flex flex-col justify-center">
              {isQueuing ? (
                <div className="space-y-6">
                  {/* SEARCHING ANIMATION */}
                  <div className="relative w-24 h-24 mx-auto">
                     <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-ping" />
                     <div className="absolute inset-2 border-4 border-emerald-500/40 rounded-full animate-[spin_3s_linear_infinite]" />
                     <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-xl text-emerald-400">
                        {formatTime(queueTime)}
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-black tracking-[0.3em] uppercase text-emerald-500/70 animate-pulse">Searching</div>
                    <button 
                      onClick={() => { onLeaveQueue(); setIsQueuing(false); }} 
                      className="px-6 py-2 rounded-full border border-slate-700 text-slate-400 font-bold text-xs hover:bg-slate-800 hover:text-white transition"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Find a random opponent.</p>
                  <button 
                    onClick={() => { onQueue(); setIsQueuing(true); }}
                    className="w-full py-4 rounded-2xl font-black text-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
                  >
                    FIND MATCH
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}