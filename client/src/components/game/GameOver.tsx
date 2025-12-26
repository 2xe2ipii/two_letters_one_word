import type { GameState } from '../../types';
import { Crown, Medal } from 'lucide-react';
import { socket } from '../../socketClient';

export function GameOver({ state, onRematch }: { state: GameState; onRematch: () => void }) {
  
  // --- ROYALE GAME OVER ---
  if (state.mode === 'ROYALE') {
    const sorted = [...state.royalePlayers].sort((a,b) => b.score - a.score);
    const topScore = sorted[0]?.score || 0;
    
    // Find all players who tied for first
    const winners = sorted.filter(p => p.score === topScore);
    const winnerNames = winners.map(w => w.name).join(' & ');

    const me = state.royalePlayers.find(p => p.id === socket.id);
    const isHost = me?.isHost;

    return (
      <div className="min-h-full flex flex-col items-center pt-10 px-4 pb-20 transition-colors">
         
         <div className="text-center space-y-4 mb-10 animate-in zoom-in duration-500">
            <div className="relative inline-block">
               <Crown size={80} className="text-amber-400 dark:text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-bounce" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl md:text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-amber-600 dark:from-yellow-300 dark:to-yellow-600 drop-shadow-sm">
                 {winners.length > 1 ? 'WINNERS' : 'WINNER'}
              </h1>
              <div className="text-2xl md:text-3xl text-slate-800 dark:text-white font-bold tracking-wide">{winnerNames}</div>
            </div>
         </div>

         {/* LEADERBOARD LIST */}
         <div className="w-full max-w-2xl space-y-3">
            {sorted.map((p) => {
               const isMe = p.id === socket.id;
               const displayRank = sorted.findIndex(s => s.score === p.score) + 1;

               let rankColor = 'text-slate-400 dark:text-slate-500';
               let borderColor = 'border-slate-200 dark:border-slate-800';
               let bgColor = 'bg-white dark:bg-slate-900/40';
               let icon = null;

               if (displayRank === 1) {
                  rankColor = 'text-amber-500 dark:text-yellow-400';
                  borderColor = 'border-amber-200 dark:border-yellow-500/50';
                  bgColor = 'bg-gradient-to-r from-amber-50 to-transparent dark:from-yellow-500/10 dark:to-transparent';
                  icon = <Crown size={20} className="text-amber-500 dark:text-yellow-400 fill-amber-500/20 dark:fill-yellow-400/20" />;
               } 
               else if (displayRank === 2) {
                  rankColor = 'text-slate-400 dark:text-slate-300';
                  borderColor = 'border-slate-300 dark:border-slate-400/50';
                  bgColor = 'bg-gradient-to-r from-slate-100 to-transparent dark:from-slate-400/10 dark:to-transparent';
                  icon = <Medal size={20} className="text-slate-400 dark:text-slate-300" />;
               } 
               else if (displayRank === 3) {
                  rankColor = 'text-amber-700 dark:text-amber-600';
                  borderColor = 'border-amber-200 dark:border-amber-700/50';
                  bgColor = 'bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-700/10 dark:to-transparent';
                  icon = <Medal size={20} className="text-amber-700 dark:text-amber-600" />;
               }

               if (isMe) {
                 borderColor = 'border-emerald-500';
                 bgColor = 'bg-emerald-50 dark:bg-emerald-950/40';
               }

               return (
                  <div 
                    key={p.id} 
                    // REMOVED: scale-[1.02]
                    className={`relative flex items-center justify-between p-4 rounded-2xl border-2 transition-colors duration-300 ${borderColor} ${bgColor} ${isMe ? 'shadow-[0_0_20px_rgba(16,185,129,0.2)] z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                  >
                     <div className="flex items-center gap-4">
                        <div className={`font-mono font-black text-2xl w-8 text-center ${rankColor}`}>{displayRank}</div>
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                              <span className={`font-bold text-lg ${isMe ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>{p.name}</span>
                              {icon}
                              {isMe && <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 uppercase tracking-wider">YOU</span>}
                           </div>
                        </div>
                     </div>
                     <span className={`font-black text-3xl ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-200'}`}>{p.score}</span>
                  </div>
               );
            })}
         </div>

         <div className="mt-12 w-full max-w-sm">
            <button 
                onClick={onRematch} 
                disabled={!isHost}
                className={`w-full py-5 rounded-full font-black text-xl transition shadow-2xl 
                    ${isHost 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:scale-105 active:scale-95 hover:bg-slate-800 dark:hover:bg-slate-200' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'}
                `}
            >
                {isHost ? 'BACK TO LOBBY' : 'WAITING FOR HOST...'}
            </button>
         </div>
      </div>
    );
  }

  // --- 1V1 Logic (Classic) ---
  const isP1 = state.myRole === 'p1';
  const myScore = isP1 ? state.scores.p1 : state.scores.p2;
  const oppScore = isP1 ? state.scores.p2 : state.scores.p1;
  const oppName = isP1 ? state.names.p2 : state.names.p1;
  const meReady = isP1 ? state.rematchStatus?.p1 : state.rematchStatus?.p2;
  const oppReady = isP1 ? state.rematchStatus?.p2 : state.rematchStatus?.p1;

  return (
    <div className="mt-12 mx-auto max-w-xl px-4 transition-colors">
      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur px-6 py-12 shadow-2xl text-center space-y-8">
        <div className="space-y-2">
          <div className="text-[10px] font-black tracking-[0.5em] uppercase text-slate-400 dark:text-slate-400">FINAL SCORE</div>
          <div className="text-7xl md:text-8xl font-black flex justify-center items-center gap-4">
            <span className="text-emerald-500 dark:text-emerald-400">{myScore}</span>
            <span className="text-slate-300 dark:text-slate-700 text-4xl">—</span>
            <span className="text-red-500 dark:text-red-400">{oppScore}</span>
          </div>
        </div>

        {state.matchWord && (
          <div className="bg-slate-100 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-500 mb-2">WINNING WORD</div>
            <div className="font-mono font-black text-3xl md:text-4xl tracking-wider text-slate-900 dark:text-white break-all">
              {state.matchWord.toUpperCase()}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <button
            onClick={onRematch}
            disabled={!!meReady}
            className={`w-full py-5 rounded-2xl font-black text-xl transition active:scale-[0.99] shadow-xl ${
                meReady 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default' 
                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200'
            }`}
          >
            {meReady ? 'REMATCH REQUESTED' : 'REMATCH'}
          </button>
          
          <div className="h-6 text-sm font-bold tracking-wide">
            {meReady && !oppReady && <span className="text-slate-400 dark:text-slate-500 animate-pulse">Waiting for opponent...</span>}
            {!meReady && oppReady && <span className="text-cyan-600 dark:text-cyan-400">{oppName} wants a rematch!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}