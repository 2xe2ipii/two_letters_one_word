import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

export function Racing({ state, onSubmit, onTyping }: { state: GameState; onSubmit: (w: string) => void; onTyping: (t: boolean) => void }) {
  const [input, setInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.battleLog]);

  const handleChange = (val: string) => {
    setInput(val);
    onTyping(val.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSubmit(input.trim());
    setInput('');
  };

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

      {/* Input Area */}
      <div className="relative">
        <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur rounded-3xl px-4 py-6 border border-slate-800 shadow-2xl">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="TYPE WORD"
            className="w-full bg-transparent border-b-4 border-slate-700 pb-2 text-center text-6xl md:text-7xl font-black outline-none focus:border-emerald-500 text-white uppercase placeholder:text-slate-700 transition-colors"
          />
        </form>

        {/* Typing Anxiety Overlay */}
        {state.opponentTyping && (
          <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-1 rounded-full text-xs font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              OPPONENT IS TYPING...
            </div>
          </div>
        )}
      </div>

      {/* Log - Separated by Side */}
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