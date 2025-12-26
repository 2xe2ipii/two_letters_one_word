import { useEffect, useState, useRef } from 'react';
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
    <div className="h-full w-full relative overflow-hidden flex flex-col transition-colors">
      
      {/* --- ROYALE PLAYER GRID --- */}
      {state.mode === 'ROYALE' && (
        <div className="w-full shrink-0 pt-2 px-2 z-20 flex justify-center">
          <div className="flex flex-wrap justify-center gap-2 max-w-5xl">
            {activePlayers.map((p) => {
               const isFinished = p.finishedRound;
               return (
                 <div 
                    key={p.id} 
                    className={`
                        w-20 md:w-28 h-10 md:h-12 flex items-center justify-center rounded-lg border transition-colors duration-300
                        ${isFinished 
                            ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                            : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }
                    `}
                 >
                    <div className={`text-[10px] md:text-xs font-black truncate px-1 uppercase tracking-tight max-w-full ${isFinished ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {p.name}
                    </div>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      {/* --- MAIN GAMEPLAY --- */}
      {/* Changed justify-center to justify-start and added top padding to keep elements high up */}
      <div className="flex-1 relative w-full h-full flex flex-col justify-start items-center pt-8 md:pt-12 px-4 gap-6 md:gap-8">
        
        {state.mode !== 'ROYALE' && <FloatingFeedback />}

        <div className="absolute inset-0 z-0 pointer-events-none">
          {clouds.map((cloud) => (
            <div
              key={cloud.id}
              className={`absolute whitespace-nowrap text-2xl font-black uppercase px-4 py-2 rounded-xl backdrop-blur-sm border shadow-xl animate-[slideRight_4s_linear_forwards] ${
                cloud.isError ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-200' : 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-200'
              }`}
              style={{ top: `${cloud.top}%`, left: '-20%' }}
            >
              {cloud.text}
            </div>
          ))}
        </div>

        {/* Letters Display */}
        <div className="shrink-0 flex justify-center gap-3 md:gap-8 z-10">
            {state.activeLetters.map((l, i) => (
            <div key={i} className="w-20 h-20 md:w-36 md:h-36 flex items-center justify-center bg-white dark:bg-slate-900 border-4 md:border-[6px] border-slate-200 dark:border-slate-700 rounded-2xl md:rounded-[2rem] text-5xl md:text-8xl font-black text-slate-800 dark:text-white shadow-xl">
                {l}
            </div>
            ))}
        </div>

        {/* Timer Bar */}
        <div className="w-full max-w-xs md:max-w-lg shrink-0 h-2 md:h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden z-10">
            <div className={`h-full transition-[width] duration-75 ease-linear ${ratio < 0.2 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${ratio * 100}%` }} />
        </div>

        {/* INPUT FIELD */}
        <div className="shrink-0 w-full max-w-2xl z-10 min-h-[80px] flex items-center justify-center">
            <div className={`
                text-4xl md:text-7xl font-black uppercase tracking-wider text-center w-full bg-transparent border-b-4 outline-none pb-2 transition-colors
                ${currentInput ? 'border-emerald-500 text-slate-900 dark:text-white' : 'border-slate-300 dark:border-slate-700 text-slate-300 dark:text-slate-600'}
            `}>
                {currentInput || "TYPE WORD"}
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