import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

// const socket: Socket = io('http://localhost:3001');
// If we are in production, use the environment variable. Otherwise, localhost.
const socket: Socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');

type GamePhase = 'LOBBY' | 'PICKING' | 'RACING' | 'GAME_OVER';

type LogEntry = {
  id: number;
  text: string;
  isMe: boolean;
  isError: boolean;
};

function App() {
  const [phase, setPhase] = useState<GamePhase>('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myRole, setMyRole] = useState<'p1' | 'p2' | null>(null);
  
  // Gameplay Data
  const [activeLetters, setActiveLetters] = useState<string[]>([]);
  const [myInput, setMyInput] = useState('');
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  
  // Round Result Data
  const [roundWinner, setRoundWinner] = useState<string | null>(null); // 'YOU' or 'OPPONENT'
  const [winningWord, setWinningWord] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Helper to add log
  const addLog = (text: string, isMe: boolean, isError: boolean) => {
    setBattleLog(prev => [...prev.slice(-4), { id: Date.now(), text, isMe, isError }]); // Keep last 5
  };

  useEffect(() => {
    socket.on('room_created', (code) => {
      setRoomCode(code);
      setMyRole('p1');
    });

    socket.on('game_started', () => {
      setPhase('PICKING');
      if (!myRole) setMyRole('p2'); 
    });

    socket.on('round_start', ({ letters }) => {
      setActiveLetters(letters);
      setPhase('RACING');
      setMyInput('');
      setShowSummary(false); // Hide previous summary
      setBattleLog([]); // Clear log for fresh round
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    // NEW: Handle failed attempts (from me OR opponent)
    socket.on('failed_attempt', ({ socketId, word, reason }) => {
      const isMe = socketId === socket.id;
      addLog(`${word} (${reason})`, isMe, true);
      
      // If it was me, shake the screen (optional visual flair)
      if (isMe) {
        document.body.classList.add('bg-red-900/20');
        setTimeout(() => document.body.classList.remove('bg-red-900/20'), 100);
      }
    });

    socket.on('next_round', ({ winnerId, winningWord, scores }) => {
      setScores(scores);
      setWinningWord(winningWord);
      setRoundWinner(winnerId === socket.id ? 'YOU' : 'OPPONENT');
      setShowSummary(true); // TRIGGER THE BIG OVERLAY
      
      // Wait 3 seconds then go back to picking
      setTimeout(() => {
        setShowSummary(false);
        setPhase('PICKING');
      }, 3500);
    });

    socket.on('match_over', ({ winnerId, scores }) => {
      setScores(scores);
      setPhase('GAME_OVER');
      setRoundWinner(winnerId === socket.id ? 'YOU' : 'OPPONENT');
    });

    socket.on('player_left', () => {
      alert('Opponent disconnected!');
      window.location.reload();
    });

    return () => {
      socket.off('room_created');
      socket.off('game_started');
      socket.off('round_start');
      socket.off('failed_attempt');
      socket.off('next_round');
      socket.off('match_over');
    };
  }, [myRole]);

  // --- ACTIONS ---

  const joinGame = () => {
    socket.emit('join_room', joinCode);
    setRoomCode(joinCode);
  };

  const submitLetter = (char: string) => {
    if (char.length === 1 && /[a-zA-Z]/.test(char)) {
      socket.emit('submit_letter', { roomCode, letter: char });
      addLog(`Picked letter: ${char.toUpperCase()}`, true, false);
    }
  };

  const submitWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myInput) return;
    socket.emit('submit_word', { roomCode, word: myInput });
    setMyInput(''); // Clear immediately so they can try again if failed
  };

  // --- UI COMPONENTS ---

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center overflow-hidden selection:bg-emerald-500/30">
      
      {/* 1. TOP HUD (Scores) */}
      {phase !== 'LOBBY' && (
        <div className="w-full max-w-4xl flex justify-between items-end p-6 border-b border-slate-800">
          <div className="flex flex-col items-start">
            <span className="text-xs text-slate-500 font-bold tracking-widest">YOU</span>
            <span className="text-5xl font-black text-emerald-400">{myRole === 'p1' ? scores.p1 : scores.p2}</span>
          </div>
          <div className="mb-2 text-slate-600 font-mono text-sm">RACE TO 10</div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 font-bold tracking-widest">OPPONENT</span>
            <span className="text-5xl font-black text-red-400">{myRole === 'p1' ? scores.p2 : scores.p1}</span>
          </div>
        </div>
      )}

      {/* 2. MAIN GAME AREA */}
      <div className="flex-1 w-full max-w-2xl flex flex-col items-center justify-center p-4 relative">
        
        {/* LOBBY VIEW */}
        {phase === 'LOBBY' && (
          <div className="w-full max-w-md space-y-8 text-center animate-fade-in">
            <h1 className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              2 LETTERS<br/>1 WORD
            </h1>
            {!roomCode ? (
              <div className="space-y-4">
                <button onClick={() => socket.emit('create_room')} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black text-xl shadow-lg shadow-emerald-900/50 transition-all active:scale-95">
                  CREATE MATCH
                </button>
                <div className="flex gap-2">
                  <input 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-center font-mono text-xl uppercase focus:border-emerald-500 outline-none"
                  />
                  <button onClick={joinGame} className="px-8 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all">
                    JOIN
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 p-8 rounded-2xl border border-emerald-500/30 animate-pulse">
                <p className="text-slate-400 mb-2 font-mono uppercase text-xs">Waiting for Player 2</p>
                <div className="text-6xl font-mono font-bold tracking-widest text-emerald-400">{roomCode}</div>
              </div>
            )}
          </div>
        )}

        {/* PICKING VIEW */}
        {phase === 'PICKING' && !showSummary && (
          <div className="text-center space-y-8 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-slate-200">Pick a Letter</h2>
            <input 
              autoFocus
              maxLength={1}
              className="w-40 h-40 bg-slate-800 border-4 border-slate-600 rounded-3xl text-center text-8xl font-black uppercase focus:border-emerald-500 focus:shadow-[0_0_40px_rgba(16,185,129,0.3)] outline-none caret-transparent transition-all"
              onChange={(e) => submitLetter(e.target.value)}
            />
            <p className="text-slate-500 animate-pulse">Waiting for opponent...</p>
          </div>
        )}

        {/* RACING VIEW */}
        {phase === 'RACING' && !showSummary && (
          <div className="w-full text-center space-y-12">
            
            {/* The Target Letters */}
            <div className="flex justify-center gap-6">
              {activeLetters.map((l, i) => (
                <div key={i} className="w-32 h-32 flex items-center justify-center bg-slate-800 rounded-2xl text-7xl font-black border-b-8 border-slate-700 shadow-2xl">
                  {l}
                </div>
              ))}
            </div>

            {/* The Input Field */}
            <form onSubmit={submitWord} className="relative group">
              <input 
                ref={inputRef}
                value={myInput}
                onChange={(e) => setMyInput(e.target.value)}
                placeholder="TYPE HERE"
                className="w-full bg-transparent border-b-4 border-slate-700 pb-2 text-center text-7xl font-bold outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-800 uppercase"
              />
            </form>

            {/* Battle Log (The "Wrong Ones" Display) */}
            <div className="absolute bottom-0 left-0 w-full h-32 pointer-events-none flex flex-col items-center justify-end pb-4 space-y-2 opacity-80">
               {battleLog.map((log) => (
                 <div key={log.id} className={`text-sm font-bold px-4 py-1 rounded-full animate-fade-in-up ${log.isError ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-300'}`}>
                   {log.isMe ? "YOU: " : "OPPONENT: "} {log.text}
                 </div>
               ))}
               <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* 3. ROUND SUMMARY OVERLAY (The "Clear Indication") */}
        {showSummary && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-fade-in">
             <div className="text-center space-y-4">
                <div className={`text-xl font-bold tracking-[0.5em] uppercase ${roundWinner === 'YOU' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {roundWinner === 'YOU' ? 'Point Scored' : 'Point Lost'}
                </div>
                <h1 className="text-7xl font-black text-white drop-shadow-2xl">
                   {winningWord.toUpperCase()}
                </h1>
                <div className="text-slate-400 pt-4">Next round in 3...</div>
             </div>
          </div>
        )}

        {/* 4. GAME OVER SCREEN */}
        {phase === 'GAME_OVER' && (
          <div className="text-center space-y-6 animate-zoom-in">
            <h1 className={`text-9xl font-black ${roundWinner === 'YOU' ? 'text-emerald-400' : 'text-red-500'}`}>
              {roundWinner === 'YOU' ? 'WIN' : 'LOSE'}
            </h1>
            <div className="text-3xl font-mono text-slate-400">
              {scores.p1} - {scores.p2}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-5 bg-white text-slate-900 hover:bg-slate-200 rounded-full font-black text-xl transition-transform hover:scale-105"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;