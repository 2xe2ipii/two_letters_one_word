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
        // Aggressively keep focus
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }, 500); // Increased frequency for stability
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
    // FIX 1: Use 'fixed inset-0' to lock the viewport size and prevent body scrolling
    <div onClick={ensureFocus} className="fixed inset-0 bg-slate-950 text-white font-sans overflow-hidden flex flex-col">
      <ToastContainer toasts={toasts} />

      {/* FIX 2: Input moved to top-0. This anchors the browser view to the top. */}
      <form 
        onSubmit={handleGlobalSubmit} 
        className="fixed top-0 left-0 w-px h-px opacity-0 overflow-hidden pointer-events-none"
      >
         <input
           ref={inputRef}
           value={globalInput}
           onChange={(e) => handleGlobalChange(e.target.value)}
           autoComplete="off"
           autoCorrect="off"
           autoCapitalize="characters"
           spellCheck="false"
           // 16px font size prevents iOS from zooming in
           style={{ fontSize: '16px' }} 
         />
         <button type="submit" />
      </form>

      {showSound && <SoundPanel onClose={() => setShowSound(false)} {...audioProps} />}
      {state.phase === 'ROUND_RESULT' && <RoundResult state={state} />}

      {/* HUD: Shrinkable if needed, but usually fits */}
      {state.phase !== 'LOBBY' && (
        <div className="shrink-0 z-30">
          <GameHUD
            state={state}
            onSoundOpen={() => wrap(() => setShowSound(true))}
            sfxMuted={audioProps.sfxMuted}
            musicMuted={audioProps.musicMuted}
          />
        </div>
      )}

      {/* Main Content: Flex column that handles the squeeze */}
      <div className="flex-1 relative w-full max-w-5xl mx-auto flex flex-col min-h-0">
        {state.phase === 'LOBBY' && (
          <div className="h-full overflow-y-auto w-full">
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
           <div className="h-full overflow-y-auto w-full">
              <GameOver state={state} onRematch={() => wrap(requestRematch)} />
           </div>
        )}
      </div>
    </div>
  );
}