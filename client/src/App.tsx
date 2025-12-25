import { useState, useEffect } from 'react';
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

  // Game Hook (UPDATED: accept/decline)
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

  const wrap = (fn: () => void) => {
    armAudio();
    playSfx('click');
    fn();
  };

  const requireName = () => {
    if (!playerName.trim()) {
      alert('Enter name');
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] bg-slate-950 text-white font-sans overflow-hidden">
      <ToastContainer toasts={toasts} />

      {showSound && <SoundPanel onClose={() => setShowSound(false)} {...audioProps} />}

      {/* DEAD SCREEN OVERLAY */}
      {state.phase === 'ROUND_RESULT' && <RoundResult state={state} />}

      {/* GAME HUD (Only in active game phases) */}
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
          onAccept={() => wrap(acceptMatch)} // NEW
          onDecline={() => wrap(declineMatch)} // NEW
          onCopy={() =>
            wrap(async () => {
              await navigator.clipboard.writeText(state.roomCode);
              addToast('Code Copied');
            })
          }
        />
      )}

      {(state.phase === 'PRE' || state.phase === 'PICKING') && (
        <Picking state={state} onSubmit={(l) => wrap(() => submitLetter(l))} />
      )}

      {state.phase === 'RACING' && (
        <Racing state={state} onSubmit={(w) => wrap(() => submitWord(w))} onTyping={sendTyping} />
      )}

      {state.phase === 'GAME_OVER' && <GameOver state={state} onRematch={() => wrap(requestRematch)} />}
    </div>
  );
}
