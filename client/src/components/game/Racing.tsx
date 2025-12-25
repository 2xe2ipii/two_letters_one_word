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

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.battleLog]);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  // CHANGE: Layout uses h-full and flex-col to distribute space evenly in the available viewport
  return (
    <div className="h-full w-full px-4 pb-2 flex flex-col justify-evenly items-center relative gap-2 md:gap-4">
      {/* Timer Bar */}
      <FloatingFeedback />
      <div className="w-full max-w-xl shrink-0 h-2 md:h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
        <div className="h-full bg-cyan-400 transition-[width] duration-75 ease-linear" style={{ width: `${ratio * 100}%` }} />
      </div>

      {/* Letters - Dynamic sizing */}
      <div className="shrink-0 flex justify-center gap-3 md:gap-6">
        {state.activeLetters.map((l, i) => (
          // Adjusted sizes: w-16 h-16 for mobile, w-28 h-28 for desktop
          <div key={i} className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center bg-slate-900 border-2 border-slate-700 rounded-2xl md:rounded-3xl text-4xl md:text-7xl font-black text-white shadow-lg">
            {l}
          </div>
        ))}
      </div>

      {/* Input Display Area */}
      <div className="shrink-0 w-full max-w-xl relative">
        <div className="bg-slate-900/80 backdrop-blur rounded-3xl px-4 py-4 md:py-6 border border-slate-800 shadow-2xl min-h-[80px] md:min-h-[100px] flex items-center justify-center">
            <span className="text-5xl md:text-7xl font-black text-white uppercase break-all leading-none">
                {currentInput}
                <span className="inline-block w-1 h-10 md:h-16 bg-emerald-500 animate-[pulse_0.7s_infinite] align-middle ml-1" />
            </span>
            
            {!currentInput && (
                <span className="absolute text-slate-700 text-3xl md:text-4xl font-black select-none pointer-events-none">TYPE WORD</span>
            )}
        </div>

        {/* Typing Anxiety Overlay */}
        {state.opponentTyping && (
          <div className="absolute -top-10 md:-top-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-1 rounded-full text-[10px] md:text-xs font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              OPPONENT IS TYPING...
            </div>
          </div>
        )}
      </div>

      {/* Log - Flex-1 with min-h-0 allows this to SHRINK when keyboard is up */}
      <div className="flex-1 w-full max-w-xl min-h-0 overflow-y-auto px-2 mask-linear flex flex-col space-y-2">
        {state.battleLog.map((log) => {
          const isMe = log.by === state.myRole;
          return (
            <div key={log.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] text-xs font-bold px-3 py-1.5 rounded-xl border ${
                log.isError 
                  ? (isMe ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-slate-800 text-slate-400 border-slate-700') 
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
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