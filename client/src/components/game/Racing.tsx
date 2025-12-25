import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

export function Racing({ state, currentInput }: { state: GameState; currentInput: string }) {
  const [now, setNow] = useState(Date.now());
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  // Auto-scroll the log when it updates
  useEffect(() => { 
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [state.battleLog]);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  // REQUIREMENT: "See entire screen above keyboard"
  // We use a flex-col layout that fills the available height.
  // 'justify-start' packs items to the top (under the letters).
  return (
    <div className="h-full w-full px-4 pt-2 pb-2 flex flex-col justify-start items-center relative gap-4">
      
      {/* 1. TIMER (Fixed Height) */}
      <FloatingFeedback />
      <div className="w-full max-w-xl shrink-0 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
        <div className="h-full bg-cyan-400 transition-[width] duration-75 ease-linear" style={{ width: `${ratio * 100}%` }} />
      </div>

      {/* 2. LETTERS (Never shrink) */}
      <div className="shrink-0 flex justify-center gap-4 z-10">
        {state.activeLetters.map((l, i) => (
          <div key={i} className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center bg-slate-900 border-2 border-slate-700 rounded-2xl md:rounded-3xl text-4xl md:text-7xl font-black text-white shadow-lg">
            {l}
          </div>
        ))}
      </div>

      {/* 3. WORD INPUT (Never shrink) */}
      <div className="shrink-0 w-full max-w-xl relative z-20">
        <div className="bg-slate-900/80 backdrop-blur rounded-2xl px-4 py-3 border border-slate-800 shadow-2xl min-h-[70px] flex items-center justify-center">
            <span className="text-4xl md:text-6xl font-black text-white uppercase break-all leading-none">
                {currentInput}
                <span className="inline-block w-1 h-8 md:h-12 bg-emerald-500 animate-[pulse_0.7s_infinite] align-middle ml-1" />
            </span>
            
            {!currentInput && (
                <span className="absolute text-slate-700 text-2xl font-black select-none pointer-events-none">TYPE WORD</span>
            )}
        </div>

        {/* Anxiety Overlay */}
        {state.opponentTyping && (
          <div className="absolute -top-3 right-0 flex justify-end pointer-events-none">
             <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest animate-pulse shadow-lg">
              OPPONENT TYPING
            </div>
          </div>
        )}
      </div>

      {/* 4. WRONG ANSWERS / LOG (Fills remaining space) 
          'flex-1' makes it expand.
          'min-h-0' allows it to shrink very small if keyboard is huge.
          'overflow-y-auto' keeps it scrollable.
      */}
      <div className="flex-1 w-full max-w-xl min-h-0 overflow-y-auto px-2 mask-linear flex flex-col space-y-2 border-t border-slate-800/50 pt-2">
        {state.battleLog.length === 0 && (
            <div className="text-center text-slate-600 text-xs uppercase tracking-widest mt-4">Battle Log</div>
        )}
        {state.battleLog.map((log) => {
          const isMe = log.by === state.myRole;
          return (
            <div key={log.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] text-xs font-bold px-3 py-1.5 rounded-xl border ${
                log.isError 
                  ? (isMe ? 'bg-red-500/10 text-red-200 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700') 
                  : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
              }`}>
                {isMe ? '' : 'OPP: '}{log.text}
              </div>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}