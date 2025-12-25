// Toast.tsx
import type { Toast } from '../../types';
import { useState } from 'react';

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] space-y-2 w-[92vw] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/80 shadow-lg text-sm font-semibold backdrop-blur text-white animate-in fade-in slide-in-from-top-2 text-center">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (msg: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2000);
  };
  return { toasts, addToast };
}