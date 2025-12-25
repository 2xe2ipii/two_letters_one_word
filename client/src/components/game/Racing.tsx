import { useEffect, useState } from 'react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

export function Racing({ state, currentInput }: { state: GameState; currentInput: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  return (
    <div className="h-full w-full relative">
      
      {/* --- LAYER 1: BATTLE LOG (BACKGROUND OVERLAY) --- 
          This is absolutely positioned so it takes 0 space. 
          It won't push anything. It just sits there.
      */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none p-4 flex flex-col justify-end pb-20 opacity-40">
        {/* We just show a few recent logs floating in the background */}
        <div className="flex flex-col gap-2 items-center">
            {state.battleLog.slice(-5).map(log => (
                <div key={log.id} className={`text-sm font-black uppercase ${
                    log.by === state.myRole 
                    ? (log.isError ? 'text-red-500' : 'text-emerald-500') 
                    : 'text-slate-500'
                }`}>
                    {log.text}
                </div>
            ))}
        </div>
      </div>

      {/* --- LAYER 2: MAIN GAME UI (FOREGROUND) --- 
          This is what matters. It uses standard flow.
          It is top-aligned (pt-4) and will NEVER move up because 
          the Battle Log isn't pushing it.
      */}
      <div className="relative z-10 w-full h-full flex flex-col justify-start items-center pt-4 px-4 gap-6">
        
        {/* TIMER */}
        <FloatingFeedback />
        <div className="w-full max-w-xl shrink-0 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
            <div className="h-full bg-cyan-400 transition-[width] duration-75 ease-linear" style={{ width: `${ratio * 100}%` }} />
        </div>

        {/* LETTERS */}
        <div className="shrink-0 flex justify-center gap-4">
            {state.activeLetters.map((l, i) => (
            <div key={i} className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center bg-slate-900 border-2 border-slate-700 rounded-2xl md:rounded-3xl text-4xl md:text-7xl font-black text-white shadow-lg">
                {l}
            </div>
            ))}
        </div>

        {/* INPUT BOX */}
        <div className="shrink-0 w-full max-w-xl">
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl px-4 py-4 border border-slate-700 shadow-2xl min-h-[80px] flex items-center justify-center relative overflow-hidden">
                {/* Visual Flair for Typing */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-20 pointer-events-none" />
                
                <span className="text-4xl md:text-6xl font-black text-white uppercase break-all leading-none z-10">
                    {currentInput}
                    <span className="inline-block w-1 h-8 md:h-12 bg-emerald-500 animate-[pulse_0.7s_infinite] align-middle ml-1" />
                </span>
                
                {!currentInput && (
                    <span className="absolute text-slate-700 text-2xl font-black select-none pointer-events-none z-0">TYPE WORD</span>
                )}
            </div>

            {/* Anxiety Overlay */}
            {state.opponentTyping && (
            <div className="flex justify-center mt-2">
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-3 py-1 rounded-full text-[10px] font-black tracking-widest animate-pulse">
                OPPONENT IS TYPING...
                </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
}