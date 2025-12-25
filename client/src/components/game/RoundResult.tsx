import type { GameState } from '../../types';

export function RoundResult({ state }: { state: GameState }) {
  const result = state.roundResult;
  if (!result) return null;

  const winner = result.winnerRole;
  const isMe = winner === state.myRole;
  const noPoint = !winner;
  const word = result.word;

  // Visuals
  const bgClass = noPoint 
    ? 'bg-slate-900' 
    : isMe 
      ? 'bg-emerald-950' 
      : 'bg-red-950';
  
  const textClass = noPoint 
    ? 'text-slate-400' 
    : isMe 
      ? 'text-emerald-400' 
      : 'text-red-400';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${bgClass} transition-colors duration-500`}>
      <div className="text-center space-y-6 animate-in zoom-in-90 duration-300">
        <div className="text-xs font-black tracking-[0.5em] uppercase text-white/50">
          {noPoint ? 'TIME UP' : isMe ? 'POINT SCORED' : 'OPPONENT SCORED'}
        </div>
        
        {noPoint ? (
          <div className="text-4xl md:text-6xl font-black text-slate-500">
            NO WINNER
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-black/30 px-8 py-6 rounded-3xl border border-white/10 backdrop-blur-sm">
              <div className={`text-6xl md:text-8xl font-black ${textClass} tracking-wider`}>
                {word?.toUpperCase()}
              </div>
            </div>
          </div>
        )}
        
        <div className="h-1 w-24 bg-white/10 mx-auto rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-white/50 animate-[loading_3s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
}