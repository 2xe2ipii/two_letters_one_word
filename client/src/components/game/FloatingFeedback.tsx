import { useEffect, useState } from 'react';
import { socket } from '../../socketClient'; // <--- Updated import path

interface FloatingWord {
  id: number;
  text: string;
  x: number;
  color: string;
}

export const FloatingFeedback = () => {
  const [words, setWords] = useState<FloatingWord[]>([]);

  useEffect(() => {
    const handleAttempt = (data: { text: string, playerId: string }) => {
      const isMe = data.playerId === socket.id;
      const id = Date.now();
      
      // Randomize X position (20% to 80%)
      const randomX = Math.floor(Math.random() * 60) + 20;

      const newWord: FloatingWord = {
        id,
        text: data.text,
        x: randomX,
        // Red for me, Orange for opponent
        color: isMe ? 'text-red-400' : 'text-orange-400', 
      };

      setWords(prev => [...prev, newWord]);

      // Cleanup after animation
      setTimeout(() => {
        setWords(prev => prev.filter(w => w.id !== id));
      }, 1500);
    };

    socket.on('attempt_failed', handleAttempt);
    return () => { socket.off('attempt_failed', handleAttempt); };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {words.map((word) => (
        <div
          key={word.id}
          className={`absolute bottom-1/4 ${word.color} font-bold text-2xl animate-float-fade`}
          style={{ left: `${word.x}%` }}
        >
          {word.text}
        </div>
      ))}
    </div>
  );
};