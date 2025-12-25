import { Volume2, VolumeX } from 'lucide-react';
import type { GameState } from '../../types';

export function GameHUD({ state, onSoundOpen, sfxMuted, musicMuted }: { state: GameState, onSoundOpen: () => void, sfxMuted: boolean, musicMuted: boolean }) {
  const isP1 = state.myRole === 'p1';
  const myScore = isP1 ? state.scores.p1 : state.scores.p2;
  const oppScore = isP1 ? state.scores.p2 : state.scores.p1;
  const oppName = isP1 ? state.names.p2 : state.names.p1;

  // We hide "Opponent Typing" here because we moved it to a big overlay in Racing.tsx
  // But the name indicator remains.

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-4 relative z-20">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-3 flex items-end justify-between">
        <div className="flex flex-col items-start min-w-[120px]">
          <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">YOU</span>
          <span className="text-4xl md:text-5xl font-black text-emerald-400">{myScore}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-slate-500 font-mono text-xs">RACE TO 10</div>
          <button onClick={onSoundOpen} className="px-3 py-2 rounded-full border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 flex items-center gap-2">
            {sfxMuted && musicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="text-xs font-black tracking-widest text-white">SOUND</span>
          </button>
        </div>

        <div className="flex flex-col items-end min-w-[120px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{oppName || 'Opponent'}</span>
          </div>
          <span className="text-4xl md:text-5xl font-black text-red-400">{oppScore}</span>
        </div>
      </div>
    </div>
  );
}