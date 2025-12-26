import { Volume2, VolumeX, Trophy, Clock } from 'lucide-react';
import type { GameState } from '../../types';
import { socket } from '../../socketClient';

export function GameHUD({ state, onSoundOpen, sfxMuted, musicMuted }: { state: GameState, onSoundOpen: () => void, sfxMuted: boolean, musicMuted: boolean }) {
  
  // --- ROYALE HUD ---
  if (state.mode === 'ROYALE') {
    const sorted = [...state.royalePlayers].sort((a, b) => b.score - a.score);
    const myIndex = sorted.findIndex(p => p.id === socket.id);
    
    const myRank = myIndex !== -1 ? myIndex + 1 : '-';
    const totalPlayers = state.royalePlayers.length;
    const maxRounds = state.totalRounds || 20; 

    // FIX: Added items-center
    return (
      <div className="w-full px-4 pt-4 pb-2 relative z-20 flex justify-between items-center gap-4">
        
        {/* Left: Round Info */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2 md:px-5 md:py-3 shadow-lg flex flex-col items-center min-w-[80px] md:min-w-[100px]">
            <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Clock size={10} /> Round
            </span>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-none">{state.currentRound}</span>
                <span className="text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500">/ {maxRounds}</span>
            </div>
        </div>

        {/* Center: Sound Toggle */}
        <button onClick={onSoundOpen} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition shadow-sm border border-slate-200 dark:border-slate-700">
            {sfxMuted && musicMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* Right: Rank Info */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2 md:px-5 md:py-3 shadow-lg flex flex-col items-center min-w-[80px] md:min-w-[100px]">
            <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Trophy size={10} /> Rank
            </span>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl md:text-3xl font-black leading-none ${myIndex === 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {myRank}
                </span>
                <span className="text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500">/ {totalPlayers}</span>
            </div>
        </div>

      </div>
    );
  }

  // --- CLASSIC 1v1 HUD ---
  const isP1 = state.myRole === 'p1';
  const myScore = isP1 ? state.scores.p1 : state.scores.p2;
  const oppScore = isP1 ? state.scores.p2 : state.scores.p1;
  const oppName = isP1 ? state.names.p2 : state.names.p1;

  return (
    <div className="w-full px-4 pt-4 pb-2 relative z-20 flex justify-between items-center">
       <div className="flex-1 flex justify-start">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-emerald-500/30 px-4 py-2 md:px-6 md:py-3 shadow-lg shadow-emerald-500/10">
                <div className="text-[8px] md:text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest">YOU</div>
                <div className="text-3xl md:text-4xl font-black text-emerald-500 dark:text-emerald-400 leading-none">{myScore}</div>
            </div>
       </div>

       <button onClick={onSoundOpen} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition border border-slate-200 dark:border-slate-700">
          {sfxMuted && musicMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
       </button>

       <div className="flex-1 flex justify-end">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-red-500/30 px-4 py-2 md:px-6 md:py-3 shadow-lg shadow-red-500/10 text-right">
                <div className="text-[8px] md:text-[10px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-widest max-w-[80px] md:max-w-[100px] truncate">{oppName}</div>
                <div className="text-3xl md:text-4xl font-black text-red-500 dark:text-red-400 leading-none">{oppScore}</div>
            </div>
       </div>
    </div>
  );
}