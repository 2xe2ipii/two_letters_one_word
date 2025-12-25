import { useEffect, useState, useRef } from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

interface CloudLog {
  id: number;
  text: string;
  isMe: boolean;
  isError: boolean;
  top: number;
}

export function Racing({ state, currentInput }: { state: GameState; currentInput: string }) {
  const [now, setNow] = useState(Date.now());
  const [clouds, setClouds] = useState<CloudLog[]>([]);
  const lastLogIdRef = useRef<number | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  // --- CLOUD LOGIC ---
  useEffect(() => {
    // Disable cloud logs in Royale
    if (state.mode === 'ROYALE') return; 

    if (state.battleLog.length === 0) return;
    const latest = state.battleLog[state.battleLog.length - 1];
    
    if (latest.id !== lastLogIdRef.current) {
      lastLogIdRef.current = latest.id;

      const newCloud: CloudLog = {
        id: Date.now(),
        text: latest.text,
        isMe: latest.by === 'me' || latest.by === state.myRole,
        isError: latest.isError,
        top: 20 + Math.random() * 40
      };

      setClouds(prev => [...prev, newCloud]);
      setTimeout(() => {
        setClouds(prev => prev.filter(c => c.id !== newCloud.id));
      }, 4000);
    }
  }, [state.battleLog, state.myRole, state.mode]);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  const activePlayers = state.mode === 'ROYALE' 
    ? state.royalePlayers.filter(p => p.connected) 
    : [];

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col">
      
      {/* --- ROYALE PLAYER ICONS (TOP) --- */}
      {state.mode === 'ROYALE' && (
        <div className="w-full shrink-0 pt-2 px-4 pb-2 z-20">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {activePlayers.map((p) => {
               const isFinished = p.finishedRound;
               return (
                 <div key={p.id} className="flex flex-col items-center gap-1 transition-all duration-300">
                    <div 
                      className={`
                        w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border-2 transition-all duration-500
                        ${isFinished 
                          ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-110' 
                          : 'bg-slate-900/50 border-slate-700 opacity-70 grayscale'
                        }
                      `}
                    >
                      {isFinished ? (
                         <CheckCircle2 className="text-white w-6 h-6 md:w-8 md:h-8 animate-in zoom-in spin-in-12" />
                      ) : (
                         <User className="text-white/50 w-5 h-5 md:w-6 md:h-6" />
                      )}
                    </div>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      {/* --- MAIN GAMEPLAY --- */}
      {/* CHANGED: justify-center -> justify-start, added pt-4 to keep it at the top */}
      <div className="flex-1 relative w-full h-full flex flex-col justify-start items-center pt-4 md:pt-10 px-4 gap-6">
        
        {state.mode !== 'ROYALE' && <FloatingFeedback />}

        {/* Floating Clouds */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {clouds.map((cloud) => (
            <div
              key={cloud.id}
              className={`absolute whitespace-nowrap text-2xl font-black uppercase px-4 py-2 rounded-xl backdrop-blur-sm border shadow-xl animate-[slideRight_4s_linear_forwards] ${
                cloud.isError ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
              }`}
              style={{ top: `${cloud.top}%`, left: '-20%' }}
            >
              {cloud.text}
            </div>
          ))}
        </div>

        {/* Timer Bar */}
        <div className="w-full max-w-xl shrink-0 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner z-10">
            <div className={`h-full transition-[width] duration-75 ease-linear ${ratio < 0.2 ? 'bg-red-500' : 'bg-cyan-400'}`} style={{ width: `${ratio * 100}%` }} />
        </div>

        {/* Letters */}
        <div className="shrink-0 flex justify-center gap-6 z-10">
            {state.activeLetters.map((l, i) => (
            <div key={i} className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center bg-slate-900 border-4 border-slate-700 rounded-3xl text-5xl md:text-8xl font-black text-white shadow-2xl">
                {l}
            </div>
            ))}
        </div>

        {/* Input */}
        <div className="shrink-0 w-full max-w-xl z-10">
            <div className={`
              bg-slate-900/90 backdrop-blur-xl rounded-2xl px-4 py-6 border-2 shadow-2xl min-h-[100px] flex items-center justify-center relative overflow-hidden transition-colors
              ${state.mode === 'ROYALE' && state.royalePlayers.find(p => p.finishedRound) ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-700'}
            `}>
                <span className="text-5xl md:text-7xl font-black text-white uppercase break-all leading-none z-10">
                    {currentInput}
                    <span className="inline-block w-1 h-10 md:h-14 bg-emerald-500 animate-pulse align-middle ml-1" />
                </span>
                {!currentInput && (
                    <span className="absolute text-slate-700 text-3xl font-black select-none pointer-events-none">TYPE WORD</span>
                )}
            </div>
        </div>
      </div>
      <style>{`
        @keyframes slideRight {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(120vw); opacity: 0; }
        }
      `}</style>
    </div>
  );
}