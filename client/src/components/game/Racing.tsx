import { useEffect, useState, useRef } from 'react';
import type { GameState } from '../../types';
import { FloatingFeedback } from './FloatingFeedback';

interface CloudLog {
  id: number;
  text: string;
  isMe: boolean;
  isError: boolean;
  top: number; // Random vertical position %
}

export function Racing({ state, currentInput }: { state: GameState; currentInput: string }) {
  const [now, setNow] = useState(Date.now());
  
  // CLOUD LOGIC
  const [clouds, setClouds] = useState<CloudLog[]>([]);
  
  // FIX: Changed type from <string | null> to <number | null> to match log IDs
  const lastLogIdRef = useRef<number | null>(null);

  // Watch for new Battle Logs and spawn clouds
  useEffect(() => {
    if (state.battleLog.length === 0) return;
    
    const latest = state.battleLog[state.battleLog.length - 1];
    // Only add if we haven't seen this specific log ID yet
    if (latest.id !== lastLogIdRef.current) {
      lastLogIdRef.current = latest.id;
      
      const newCloud: CloudLog = {
        id: Date.now(), // Local animation ID
        text: latest.text,
        isMe: latest.by === state.myRole,
        isError: latest.isError,
        // Spawn randomly between 15% and 45% of screen height to avoid keyboard
        top: 15 + Math.random() * 30 
      };

      setClouds(prev => [...prev, newCloud]);

      // Cleanup after animation (4s)
      setTimeout(() => {
        setClouds(prev => prev.filter(c => c.id !== newCloud.id));
      }, 4000);
    }
  }, [state.battleLog, state.myRole]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  const ratio = state.roundEndsAt ? Math.max(0, Math.min(1, (state.roundEndsAt - now) / 20000)) : 0;
  
  return (
    <div className="h-full w-full relative overflow-hidden">
      
      {/* --- LAYER 1: FLOATING CLOUDS (Battle Log) --- */}
      {/* These animate smoothly across the screen in the 'safe zone' */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {clouds.map((cloud) => (
          <div
            key={cloud.id}
            className={`absolute whitespace-nowrap text-xl md:text-2xl font-black uppercase px-4 py-2 rounded-xl backdrop-blur-sm border shadow-xl animate-[slideRight_4s_linear_forwards] ${
              cloud.isMe 
                ? (cloud.isError ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200')
                : 'bg-slate-800/60 border-slate-600 text-slate-400'
            }`}
            style={{ 
              top: `${cloud.top}%`,
              // Starting slightly off-screen left
              left: '-20%' 
            }}
          >
            {cloud.isMe ? '' : 'OPP: '} {cloud.text}
          </div>
        ))}
      </div>

      {/* --- LAYER 2: MAIN GAME UI (FOREGROUND) --- */}
      <div className="relative z-10 w-full h-full flex flex-col justify-start items-center pt-6 px-4 gap-6">
        
        {/* TIMER */}
        <FloatingFeedback />
        <div className="w-full max-w-xl shrink-0 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
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
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl px-4 py-4 border border-slate-700 shadow-2xl min-h-[90px] flex items-center justify-center relative overflow-hidden">
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
            <div className="flex justify-center mt-4">
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-3 py-1 rounded-full text-[10px] font-black tracking-widest animate-pulse">
                OPPONENT IS TYPING...
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Style for the animation */}
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