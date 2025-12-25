// SoundPanel.tsx
import { X } from 'lucide-react';

interface Props {
  sfxMuted: boolean; setSfxMuted: (v: boolean) => void;
  musicMuted: boolean; setMusicMuted: (v: boolean) => void;
  sfxVol: number; setSfxVol: (v: number) => void;
  musicVol: number; setMusicVol: (v: number) => void;
  onClose: () => void;
}

export function SoundPanel({ onClose, ...p }: Props) {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-5">
          <div className="font-black tracking-widest">SOUND</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="space-y-6">
          <VolumeControl label="Music" muted={p.musicMuted} vol={p.musicVol} onToggle={() => p.setMusicMuted(!p.musicMuted)} onChange={p.setMusicVol} />
          <VolumeControl label="SFX" muted={p.sfxMuted} vol={p.sfxVol} onToggle={() => p.setSfxMuted(!p.sfxMuted)} onChange={p.setSfxVol} />
        </div>
      </div>
    </div>
  );
}

function VolumeControl({ label, muted, vol, onToggle, onChange }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-bold text-slate-200">{label}</div>
        <button onClick={onToggle} className="px-3 py-1 rounded-full border border-slate-700 bg-slate-800/70 text-xs font-black tracking-widest">
          {muted ? 'OFF' : 'ON'}
        </button>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
    </div>
  );
}