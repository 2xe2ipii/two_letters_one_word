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

  // Focus Management: Force focus during game phases
  useEffect(() => {
    const isGameActive = ['PRE', 'PICKING', 'RACING'].includes(state.phase);
    
    if (isGameActive) {
      // Clear input on phase change
      setGlobalInput('');
      
      // Small delay to ensure render, then focus
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      
      // Re-focus loop (aggressive safety for mobile)
      const i = setInterval(() => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }, 1000);
      
      return () => { clearTimeout(t); clearInterval(i); };
    }
  }, [state.phase]);

  // Handle Text Changes
  const handleGlobalChange = (val: string) => {
    // 1. Logic for Picking Phase (Auto-submit single letter)
    if (state.phase === 'PICKING') {
      const char = val.slice(-1).toUpperCase(); // Get last char typed
      if (/^[A-Z]$/.test(char)) {
        wrap(() => submitLetter(char));
        setGlobalInput(''); // Reset immediately
        return;
      }
    }

    // 2. Logic for Racing Phase (Store text)
    if (state.phase === 'RACING') {
      setGlobalInput(val.toUpperCase());
      sendTyping(val.length > 0);
    }
  };

  // Handle "Enter" / "Go" Key
  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.phase === 'RACING' && globalInput.trim()) {
      wrap(() => submitWord(globalInput.trim()));
      setGlobalInput('');
    }
  };

  // Generic wrap function
  const wrap = (fn: () => void) => {
    armAudio();
    playSfx('click');
    fn();
  };
  
  // Refocus helper when user taps anywhere
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
    // Add onClick to container to capture clicks and force focus back to input
    <div onClick={ensureFocus} className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] bg-slate-950 text-white font-sans overflow-hidden relative">
      <ToastContainer toasts={toasts} />

      {/* --- THE INVISIBLE PERSISTENT INPUT --- */}
      <form 
        onSubmit={handleGlobalSubmit} 
        className="fixed top-0 left-0 w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
      >
         <input
           ref={inputRef}
           value={globalInput}
           onChange={(e) => handleGlobalChange(e.target.value)}
           autoComplete="off"
           autoCorrect="off"
           autoCapitalize="characters"
           spellCheck="false"
           // Important for iOS not to zoom
           style={{ fontSize: '16px' }} 
         />
         <button type="submit" />
      </form>
      {/* ----------------------------------- */}

      {showSound && <SoundPanel onClose={() => setShowSound(false)} {...audioProps} />}
      {state.phase === 'ROUND_RESULT' && <RoundResult state={state} />}

      {state.phase !== 'LOBBY' && (
        <GameHUD
          state={state}
          onSoundOpen={() => wrap(() => setShowSound(true))}
          sfxMuted={audioProps.sfxMuted}
          musicMuted={audioProps.musicMuted}
        />
      )}

      {state.phase === 'LOBBY' && (
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
      )}

      {(state.phase === 'PRE' || state.phase === 'PICKING') && (
        // Pass currentInput purely for visual purposes
        <Picking state={state} />
      )}

      {state.phase === 'RACING' && (
        // Pass currentInput purely for visual purposes
        <Racing state={state} currentInput={globalInput} />
      )}

      {state.phase === 'GAME_OVER' && <GameOver state={state} onRematch={() => wrap(requestRematch)} />}
    </div>
  );
}