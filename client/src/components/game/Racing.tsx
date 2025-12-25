import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

// New Prop: currentInput
export function Racing({ state, currentInput }: { state: GameState; currentInput: string }) {
  const [now, setNow] = useState(Date.now());
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.battleLog]);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  return (
    <div className="mt-6 md:mt-10 w-full max-w-xl mx-auto px-4 space-y-8">
      {/* Timer Bar */}
      <FloatingFeedback />
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
        <div className="h-full bg-cyan-400 transition-[width] duration-75 ease-linear" style={{ width: `${ratio * 100}%` }} />
      </div>

      {/* Letters */}
      <div className="flex justify-center gap-6">
        {state.activeLetters.map((l, i) => (
          <div key={i} className="w-28 h-28 flex items-center justify-center bg-slate-900 border-2 border-slate-700 rounded-3xl text-7xl font-black text-white shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            {l}
          </div>
        ))}
      </div>

      {/* Input Display Area (VISUAL ONLY) */}
      <div className="relative">
        <div className="bg-slate-900/80 backdrop-blur rounded-3xl px-4 py-6 border border-slate-800 shadow-2xl min-h-[100px] flex items-center justify-center">
            
            {/* Render the text from App.tsx */}
            <span className="text-6xl md:text-7xl font-black text-white uppercase break-all">
                {currentInput}
                {/* Simulated Cursor */}
                <span className="inline-block w-1 h-12 md:h-16 bg-emerald-500 animate-[pulse_0.7s_infinite] align-middle ml-1" />
            </span>
            
            {!currentInput && (
                <span className="absolute text-slate-700 text-4xl font-black select-none pointer-events-none">TYPE WORD</span>
            )}

        </div>

        {/* Typing Anxiety Overlay */}
        {state.opponentTyping && (
          <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-1 rounded-full text-xs font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              OPPONENT IS TYPING...
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      <div className="flex flex-col space-y-2 pt-2 h-40 overflow-y-auto px-2 mask-linear">
        {state.battleLog.map((log) => {
          const isMe = log.by === state.myRole;
          return (
            <div 
              key={log.id} 
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] text-xs md:text-sm font-bold px-4 py-2 rounded-2xl border ${
                log.isError 
                  ? (isMe ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-slate-800 text-slate-400 border-slate-700') 
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
              }`}>
                {isMe ? '' : 'OPPONENT: '}{log.text}
              </div>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}