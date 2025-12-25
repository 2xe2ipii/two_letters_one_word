import { useEffect, useState } from 'react';
import type { GameState } from '../../types';

export function Picking({ state, onSubmit }: { state: GameState; onSubmit: (l: string) => void }) {
  const [now, setNow] = useState(Date.now());
  
  const target = state.phase === 'PRE' ? state.preEndsAt : state.pickEndsAt;
  const duration = state.phase === 'PRE' ? 3000 : 5000;
  
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  const ratio = target ? Math.max(0, Math.min(1, (target - now) / duration)) : 0;

  return (
    <div className="mt-8 md:mt-12 mx-auto max-w-md px-4">
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-10 shadow-2xl relative overflow-hidden">
        
        <div className="space-y-8 text-center relative z-10">
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
                <input
                  autoFocus
                  maxLength={1}
                  className="w-32 h-32 bg-slate-800/70 border-4 border-slate-700 rounded-3xl text-center text-8xl font-black uppercase focus:border-emerald-500 outline-none text-white caret-transparent"
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (/^[A-Z]$/.test(val)) onSubmit(val);
                  }}
                />
              ) : (
                <div className="w-32 h-32 bg-slate-800/70 border-4 border-emerald-600/70 rounded-3xl flex items-center justify-center">
                  <div className="text-8xl font-black text-emerald-300">{state.lockedLetter}</div>
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