import { useEffect, useState } from 'react';
import type { GameState } from '../../types';

export function Picking({ state }: { state: GameState }) {
  const [now, setNow] = useState(Date.now());
  const target = state.phase === 'PRE' ? state.preEndsAt : state.pickEndsAt;
  const duration = state.phase === 'PRE' ? 3000 : 5000;
  
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  const ratio = target ? Math.max(0, Math.min(1, (target - now) / duration)) : 0;

  // REQUIREMENT: "Place the Letter Input Field ... higher."
  // We use 'justify-start' and 'pt-8' to bias the content to the top.
  return (
    <div className="h-full w-full flex flex-col justify-start items-center pt-8 px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-8 shadow-2xl relative overflow-hidden">
        
        <div className="space-y-6 text-center relative z-10">
          <div className="space-y-4">
            <div className="text-[10px] font-black tracking-[0.35em] uppercase text-slate-400">
              {state.phase === 'PRE' ? 'GET READY' : 'PICK A LETTER'}
            </div>
            
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div className={`h-full transition-[width] duration-75 ${state.phase === 'PRE' ? 'bg-cyan-400' : 'bg-emerald-500'}`} style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>

          {state.phase === 'PICKING' && (
            <div className="flex items-center justify-center">
              {!state.lockedLetter ? (
                <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-800/70 border-4 border-slate-700 rounded-3xl flex items-center justify-center">
                   {/* Blinking cursor */}
                   <div className="w-1 h-12 bg-slate-500 animate-pulse" />
                </div>
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-800/70 border-4 border-emerald-600/70 rounded-3xl flex items-center justify-center">
                  <div className="text-6xl md:text-8xl font-black text-emerald-300">{state.lockedLetter}</div>
                </div>
              )}
            </div>
          )}

          {state.phase === 'PRE' && (
             <div className="text-4xl font-black text-white animate-pulse">STARTING...</div>
          )}
          
          <div className="text-slate-500 text-sm">
            {state.phase === 'PRE' ? 'Prepare yourself.' : state.lockedLetter ? 'Locked. Waiting for opponent...' : 'Type a letter [A-Z].'}
          </div>
        </div>
      </div>
    </div>
  );
}