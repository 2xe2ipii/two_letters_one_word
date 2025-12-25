import { Volume2, VolumeX } from 'lucide-react';
import type { GameState } from '../../types';
import { socket } from '../../socketClient'; // We need this to identify "Me" in the list

export function GameHUD({ state, onSoundOpen, sfxMuted, musicMuted }: { state: GameState, onSoundOpen: () => void, sfxMuted: boolean, musicMuted: boolean }) {
  
  // --- ROYALE HUD ---
  if (state.mode === 'ROYALE') {
    // 1. Calculate Rankings
    const sorted = [...state.royalePlayers].sort((a, b) => b.score - a.score);
    const myIndex = sorted.findIndex(p => p.id === socket.id); // Assuming socket.id matches player.id
    const myPlayer = sorted[myIndex];
    
    // Fallback if spectator or not found
    const myRank = myIndex !== -1 ? myIndex + 1 : '-';
    const totalPlayers = state.royalePlayers.length;
    const myScore = myPlayer?.score || 0;

    // 2. Calculate Gap
    let gapText = '';
    let gapColor = 'text-slate-500';

    if (myIndex === 0) {
      // I am first
      const secondPlace = sorted[1];
      const lead = secondPlace ? myScore - secondPlace.score : 0;
      gapText = `LEAD +${lead}`;
      gapColor = 'text-yellow-400';
    } else if (myIndex > 0) {
      // I am chasing
      const target = sorted[myIndex - 1];
      const diff = target.score - myScore;
      gapText = `TO #${myIndex}: ${diff}`; // e.g., "TO #3: 10"
      gapColor = 'text-red-400';
    }

    return (
      <div className="w-full max-w-5xl mx-auto px-4 pt-4 relative z-20">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3 flex items-center justify-between">
          
          {/* LEFT: ROUND INFO */}
          <div className="flex flex-col items-start min-w-[100px]">
            <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1">ROUND</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{state.currentRound}</span>
              <span className="text-sm font-bold text-slate-600">/ {state.totalRounds || 20}</span>
            </div>
          </div>

          {/* CENTER: SOUND & GAP */}
          <div className="flex flex-col items-center gap-2">
            <div className={`text-[10px] font-black tracking-[0.2em] uppercase ${gapColor} animate-pulse`}>
              {gapText}
            </div>
            <button onClick={onSoundOpen} className="px-4 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 hover:bg-slate-700/60 flex items-center gap-2 transition">
              {sfxMuted && musicMuted ? <VolumeX size={14} className="text-slate-400" /> : <Volume2 size={14} className="text-slate-300" />}
              <span className="text-[10px] font-black tracking-widest text-slate-400">SOUND</span>
            </button>
          </div>

          {/* RIGHT: RANK INFO */}
          <div className="flex flex-col items-end min-w-[100px]">
            <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1 flex items-center gap-1">
              MY RANK
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black ${myIndex === 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {myRank}
              </span>
              <span className="text-sm font-bold text-slate-600">/ {totalPlayers}</span>
            </div>
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
    <div className="w-full max-w-5xl mx-auto px-4 pt-4 relative z-20">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-end justify-between">
        <div className="flex flex-col items-start min-w-[120px]">
          <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">YOU</span>
          <span className="text-4xl md:text-5xl font-black text-emerald-400">{myScore}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-slate-500 font-mono text-xs font-bold tracking-wider">RACE TO 10</div>
          <button onClick={onSoundOpen} className="px-3 py-2 rounded-full border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 flex items-center gap-2">
            {sfxMuted && musicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="text-xs font-black tracking-widest text-white">SOUND</span>
          </button>
        </div>

        <div className="flex flex-col items-end min-w-[120px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase max-w-[100px] truncate">{oppName || 'OPPONENT'}</span>
          </div>
          <span className="text-4xl md:text-5xl font-black text-red-400">{oppScore}</span>
        </div>
      </div>
    </div>
  );
}