import type { GameState } from '../../types';

export function GameOver({ state, onRematch }: { state: GameState; onRematch: () => void }) {
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