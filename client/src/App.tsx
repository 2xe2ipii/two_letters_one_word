import { useState, useEffect, useRef } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import { useAudio } from './hooks/useAudio';
import { useToast, ToastContainer } from './components/ui/Toast';
import { SoundPanel } from './components/ui/SoundPanel';
import { GameHUD } from './components/game/GameHUD';
import { Lobby } from './components/game/Lobby';
import { Picking } from './components/game/Picking';
import { Racing } from './components/game/Racing';
import { RoundResult } from './components/game/RoundResult';
import { GameOver } from './components/game/GameOver';

export default function App() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('wr_name') || '');
  useEffect(() => {
    if (playerName) localStorage.setItem('wr_name', playerName);
  }, [playerName]);

  const { playSfx, armAudio, ...audioProps } = useAudio();
  const { toasts, addToast } = useToast();

  const {
    state,
    createRoom,
    joinRoom,
    joinQueue,
    leaveQueue,
    sendReady,
    submitLetter,
    submitWord,
    sendTyping,
    requestRematch,
    acceptMatch,
    declineMatch,
  } = useGameSocket(playerName, playSfx, addToast);

  const [showSound, setShowSound] = useState(false);
  
  // --- PERSISTENT INPUT STATE ---
  const [globalInput, setGlobalInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isGameActive = ['PRE', 'PICKING', 'RACING'].includes(state.phase);
    
    if (isGameActive) {
      setGlobalInput('');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      const i = setInterval(() => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }, 1000);
      return () => { clearTimeout(t); clearInterval(i); };
    }
  }, [state.phase]);

  const handleGlobalChange = (val: string) => {
    if (state.phase === 'PICKING') {
      const char = val.slice(-1).toUpperCase();
      if (/^[A-Z]$/.test(char)) {
        wrap(() => submitLetter(char));
        setGlobalInput('');
        return;
      }
    }
    if (state.phase === 'RACING') {
      setGlobalInput(val.toUpperCase());
      sendTyping(val.length > 0);
    }
  };

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.phase === 'RACING' && globalInput.trim()) {
      wrap(() => submitWord(globalInput.trim()));
      setGlobalInput('');
    }
  };

  const wrap = (fn: () => void) => {
    armAudio();
    playSfx('click');
    fn();
  };
  
  const ensureFocus = () => {
    if (['PRE', 'PICKING', 'RACING'].includes(state.phase)) {
      inputRef.current?.focus();
    }
  };

  const requireName = () => {
    if (!playerName.trim()) {
      alert('Enter name');
      return false;
    }
    return true;
  };

  return (
    // CHANGE: h-[100dvh] + flex col + overflow-hidden to FORCE it to fit screen
    <div onClick={ensureFocus} className="h-[100dvh] w-full bg-slate-950 text-white font-sans overflow-hidden flex flex-col relative">
      <ToastContainer toasts={toasts} />

      {/* CHANGE: Input fixed to center to prevent scroll jumping */}
      <form 
        onSubmit={handleGlobalSubmit} 
        className="fixed top-1/2 left-1/2 w-px h-px opacity-0 overflow-hidden pointer-events-none -translate-x-1/2 -translate-y-1/2"
      >
         <input
           ref={inputRef}
           value={globalInput}
           onChange={(e) => handleGlobalChange(e.target.value)}
           autoComplete="off"
           autoCorrect="off"
           autoCapitalize="characters"
           spellCheck="false"
           style={{ fontSize: '16px' }} 
         />
         <button type="submit" />
      </form>

      {showSound && <SoundPanel onClose={() => setShowSound(false)} {...audioProps} />}
      {state.phase === 'ROUND_RESULT' && <RoundResult state={state} />}

      {/* HUD stays at top, natural height */}
      {state.phase !== 'LOBBY' && (
        <div className="shrink-0">
          <GameHUD
            state={state}
            onSoundOpen={() => wrap(() => setShowSound(true))}
            sfxMuted={audioProps.sfxMuted}
            musicMuted={audioProps.musicMuted}
          />
        </div>
      )}

      {/* Main Content Area: Fills remaining space */}
      <div className="flex-1 relative w-full max-w-5xl mx-auto flex flex-col overflow-hidden">
        {state.phase === 'LOBBY' && (
          <div className="h-full overflow-y-auto">
            <Lobby
              playerName={playerName}
              setPlayerName={setPlayerName}
              state={state}
              onCreate={() => requireName() && wrap(createRoom)}
              onJoin={(code) => requireName() && code && wrap(() => joinRoom(code))}
              onQueue={() => requireName() && wrap(joinQueue)}
              onLeaveQueue={() => wrap(leaveQueue)}
              onReady={() => wrap(sendReady)}
              onAccept={() => wrap(acceptMatch)}
              onDecline={() => wrap(declineMatch)}
              onCopy={() =>
                wrap(async () => {
                  await navigator.clipboard.writeText(state.roomCode);
                  addToast('Code Copied');
                })
              }
            />
          </div>
        )}

        {(state.phase === 'PRE' || state.phase === 'PICKING') && (
          <Picking state={state} />
        )}

        {state.phase === 'RACING' && (
          <Racing state={state} currentInput={globalInput} />
        )}

        {state.phase === 'GAME_OVER' && (
           <div className="h-full overflow-y-auto">
              <GameOver state={state} onRematch={() => wrap(requestRematch)} />
           </div>
        )}
      </div>
    </div>
  );
}