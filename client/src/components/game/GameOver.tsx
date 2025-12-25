import type { GameState } from '../../types';
import { Crown, Medal } from 'lucide-react';
import { socket } from '../../socketClient';

export function GameOver({ state, onRematch }: { state: GameState; onRematch: () => void }) {
  
  // --- ROYALE GAME OVER ---
  if (state.mode === 'ROYALE') {
    const sorted = [...state.royalePlayers].sort((a,b) => b.score - a.score);
    const winner = sorted[0];
    const me = state.royalePlayers.find(p => p.id === socket.id);
    const isHost = me?.isHost;

    return (
      <div className="min-h-full flex flex-col items-center pt-10 px-4 pb-20">
         
         <div className="text-center space-y-4 mb-10 animate-in zoom-in duration-500">
            <div className="relative inline-block">
               <Crown size={80} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-bounce" />
               <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-yellow-400/20 blur-xl rounded-full" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-5xl md:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm">
                 WINNER
              </h1>
              <div className="text-3xl text-white font-bold tracking-wide">{winner?.name}</div>
            </div>
         </div>

         {/* LIST */}
         <div className="w-full max-w-2xl space-y-3">
            {sorted.map((p, i) => {
               const isMe = p.id === socket.id;
               
               let rankColor = 'text-slate-500';
               let borderColor = 'border-slate-800';
               let bgColor = 'bg-slate-900/40';
               let icon = null;

               if (i === 0) {
                  rankColor = 'text-yellow-400';
                  borderColor = 'border-yellow-500/50';
                  bgColor = 'bg-gradient-to-r from-yellow-500/10 to-transparent';
                  icon = <Crown size={20} className="text-yellow-400 fill-yellow-400/20" />;
               } else if (i === 1) {
                  rankColor = 'text-slate-300';
                  borderColor = 'border-slate-400/50';
                  bgColor = 'bg-gradient-to-r from-slate-400/10 to-transparent';
                  icon = <Medal size={20} className="text-slate-300" />;
               } else if (i === 2) {
                  rankColor = 'text-amber-600';
                  borderColor = 'border-amber-700/50';
                  bgColor = 'bg-gradient-to-r from-amber-700/10 to-transparent';
                  icon = <Medal size={20} className="text-amber-600" />;
               }

               if (isMe) {
                 borderColor = 'border-emerald-500';
                 bgColor = 'bg-emerald-950/40';
               }

               return (
                  <div 
                    key={p.id} 
                    className={`relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${borderColor} ${bgColor} ${isMe ? 'shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02] z-10' : 'hover:bg-slate-800/60'}`}
                  >
                     <div className="flex items-center gap-4">
                        <div className={`font-mono font-black text-2xl w-8 text-center ${rankColor}`}>{i + 1}</div>
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                              <span className={`font-bold text-lg ${isMe ? 'text-emerald-300' : 'text-white'}`}>{p.name}</span>
                              {icon}
                              {isMe && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">YOU</span>}
                           </div>
                        </div>
                     </div>
                     <span className={`font-black text-3xl ${isMe ? 'text-emerald-400' : 'text-slate-200'}`}>{p.score}</span>
                  </div>
               );
            })}
         </div>

         {/* BACK TO LOBBY BUTTON */}
         <div className="mt-12 w-full max-w-sm">
            <button 
                onClick={onRematch} 
                disabled={!isHost}
                className={`w-full py-5 rounded-full font-black text-xl transition shadow-2xl 
                    ${isHost 
                        ? 'bg-white text-slate-950 hover:scale-105 active:scale-95 hover:bg-slate-200' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
                `}
            >
                {isHost ? 'BACK TO LOBBY' : 'WAITING FOR HOST...'}
            </button>
            {!isHost && (
                <p className="text-center text-slate-500 text-xs mt-3 font-bold uppercase tracking-widest animate-pulse">
                    Host controls the lobby
                </p>
            )}
         </div>
      </div>
    );
  }

  // --- 1V1 Logic (Preserved) ---
  const isP1 = state.myRole === 'p1';
  const myScore = isP1 ? state.scores.p1 : state.scores.p2;
  const oppScore = isP1 ? state.scores.p2 : state.scores.p1;
  const oppName = isP1 ? state.names.p2 : state.names.p1;
  
  const meReady = isP1 ? state.rematchStatus?.p1 : state.rematchStatus?.p2;
  const oppReady = isP1 ? state.rematchStatus?.p2 : state.rematchStatus?.p1;

  return (
    <div className="mt-12 mx-auto max-w-xl px-4">
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-12 shadow-2xl text-center space-y-8">
        <div className="space-y-2">
          <div className="text-[10px] font-black tracking-[0.5em] uppercase text-slate-400">FINAL SCORE</div>
          <div className="text-7xl md:text-8xl font-black flex justify-center items-center gap-4">
            <span className="text-emerald-400">{myScore}</span>
            <span className="text-slate-700 text-4xl">—</span>
            <span className="text-red-400">{oppScore}</span>
          </div>
        </div>

        {state.matchWord && (
          <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-6">
            <div className="text-[10px] font-black tracking-[0.45em] uppercase text-slate-500 mb-2">WINNING WORD</div>
            <div className="font-mono font-black text-3xl md:text-4xl tracking-wider text-white break-all">
              {state.matchWord.toUpperCase()}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <button
            onClick={onRematch}
            disabled={!!meReady}
            className={`w-full py-5 rounded-2xl font-black text-xl transition active:scale-[0.99] shadow-xl ${meReady ? 'bg-slate-800 text-slate-500 cursor-default' : 'bg-white text-slate-950 hover:bg-slate-200'}`}
          >
            {meReady ? 'REMATCH REQUESTED' : 'REMATCH'}
          </button>
          
          <div className="h-6 text-sm font-bold tracking-wide">
            {meReady && !oppReady && <span className="text-slate-500 animate-pulse">Waiting for opponent...</span>}
            {!meReady && oppReady && <span className="text-cyan-400">{oppName} wants a rematch!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}