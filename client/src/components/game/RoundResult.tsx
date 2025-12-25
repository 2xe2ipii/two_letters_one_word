import { useEffect, useState } from 'react';
import type { GameState } from '../../types';

export function RoundResult({ state }: { state: GameState }) {
  const [now, setNow] = useState(Date.now());

  // Update time for the countdown bar
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(i);
  }, []);

  // --- 1V1 LOGIC (Preserved) ---
  if (state.mode === '1v1') {
    const result = state.roundResult;
    if (!result) return null;
    const winner = result.winnerRole;
    const isMe = winner === state.myRole;
    const noPoint = !winner;
    
    const bgClass = noPoint ? 'bg-slate-900' : isMe ? 'bg-emerald-950' : 'bg-red-950';
    const textClass = noPoint ? 'text-slate-400' : isMe ? 'text-emerald-400' : 'text-red-400';

    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${bgClass} transition-colors duration-500`}>
        <div className="text-center space-y-6 animate-in zoom-in-90 duration-300 px-4">
          <div className="text-xs font-black tracking-[0.5em] uppercase text-white/50">
            {noPoint ? 'TIME UP' : isMe ? 'POINT SCORED' : 'OPPONENT SCORED'}
          </div>
          {noPoint ? (
            <div className="text-4xl md:text-6xl font-black text-slate-500">NO WINNER</div>
          ) : (
            <div className="bg-black/30 px-8 py-6 rounded-3xl border border-white/10 backdrop-blur-sm">
              <div className={`text-5xl md:text-8xl font-black ${textClass} tracking-wider break-all`}>
                {result.word?.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ROYALE LOGIC ---
  const sortedPlayers = [...state.royalePlayers].sort((a, b) => b.score - a.score);
  const maxPoints = Math.max(...state.royalePlayers.map(p => p.roundPoints));
  const roundWinnerId = maxPoints > 0 ? state.royalePlayers.find(p => p.roundPoints === maxPoints)?.id : null;

  // Countdown Logic
  const timeLeft = state.resultEndsAt ? Math.max(0, state.resultEndsAt - now) : 0;
  // Total duration is 7000ms (7s)
  const progressPercent = Math.min(100, (timeLeft / 7000) * 100);
  const secondsLeft = Math.ceil(timeLeft / 1000);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        <div className="shrink-0 text-center mb-6 space-y-2">
           <div className="text-emerald-400 font-black tracking-widest uppercase text-sm">ROUND {state.currentRound} COMPLETE</div>
           <h2 className="text-5xl text-white font-black italic tracking-tighter">LEADERBOARD</h2>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-3xl border border-slate-800 p-2 space-y-2">
           {sortedPlayers.map((p, i) => {
             const isRoundWinner = p.id === roundWinnerId;
             const pts = p.roundPoints;
             
             let ptsColor = 'text-emerald-400';
             if (pts === 10) ptsColor = 'text-yellow-400';
             else if (pts === 8) ptsColor = 'text-slate-300';
             else if (pts === 6) ptsColor = 'text-amber-600';

             return (
               <div 
                 key={p.id} 
                 className={`
                   flex items-center justify-between p-4 rounded-2xl border transition-all
                   ${isRoundWinner ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-slate-800/40 border-slate-700/50'}
                   ${pts > 0 ? 'opacity-100' : 'opacity-60'}
                 `}
               >
                  <div className="flex items-center gap-4">
                     <div className={`font-mono font-black text-xl w-8 ${i < 3 ? 'text-white' : 'text-slate-600'}`}>
                        #{i + 1}
                     </div>
                     <div>
                        <div className={`font-bold text-lg ${isRoundWinner ? 'text-yellow-100' : 'text-slate-200'}`}>
                           {p.name}
                        </div>
                        {pts > 0 ? (
                           <div className={`text-xs font-black uppercase tracking-wider ${ptsColor}`}>
                              +{pts} PTS
                           </div>
                        ) : (
                           <div className="text-[10px] font-bold text-red-400/50 uppercase tracking-widest">NO WORD</div>
                        )}
                     </div>
                  </div>
                  
                  <div className="text-right">
                     <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">TOTAL</div>
                     <div className="text-3xl font-black text-white leading-none">{p.score}</div>
                  </div>
               </div>
             );
           })}
        </div>

        {/* --- COUNTDOWN FOOTER --- */}
        <div className="shrink-0 mt-6 w-full max-w-md mx-auto space-y-3">
            <div className="flex justify-between items-end px-1">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Next Round</div>
                <div className="text-emerald-400 font-mono font-black text-xl">{secondsLeft}s</div>
            </div>
            
            {/* Progress Bar Container */}
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative shadow-inner">
               {/* Animated Bar */}
               <div 
                 className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-100 ease-linear" 
                 style={{ width: `${progressPercent}%` }} 
               />
            </div>
        </div>

      </div>
    </div>
  );
}