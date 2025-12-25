import { useEffect, useRef, useState } from 'react';

type SfxKey = 'click' | 'point' | 'win' | 'lose';

export function useAudio() {
    const [sfxMuted, setSfxMuted] = useState(false);
    const [musicMuted, setMusicMuted] = useState(false);
    const [sfxVol, setSfxVol] = useState(0.7);
    const [musicVol, setMusicVol] = useState(0.35);
    const [audioArmed, setAudioArmed] = useState(false);

    const sfxRef = useRef<Record<SfxKey, HTMLAudioElement> | null>(null);
    const musicRef = useRef<HTMLAudioElement | null>(null);
    const stateRef = useRef({ sfxMuted, musicMuted, sfxVol, musicVol });

    useEffect(() => {
        stateRef.current = { sfxMuted, musicMuted, sfxVol, musicVol };
        if (musicRef.current) {
            musicRef.current.volume = musicMuted ? 0 : Math.min(1, Math.max(0, musicVol));
        }
    }, [sfxMuted, musicMuted, sfxVol, musicVol]);

    useEffect(() => {
        sfxRef.current = {
            click: new Audio('/click.mp3'),
            point: new Audio('/point.mp3'),
            win: new Audio('/win.mp3'),
            lose: new Audio('/lose.mp3'),
        };

        Object.values(sfxRef.current).forEach((a) => (a.preload = 'auto'));

        musicRef.current = new Audio('/bg.mp3');
        musicRef.current.loop = true;
        musicRef.current.preload = 'auto';

        return () => {
            Object.values(sfxRef.current || {}).forEach((a) => a.pause());
            musicRef.current?.pause();
        };
    }, []);

    const armAudio = () => {
        if (audioArmed) return;
        setAudioArmed(true);
        const m = musicRef.current;
        if (m) {
            m.volume = stateRef.current.musicMuted ? 0 : stateRef.current.musicVol;
            m.play().catch(() => {});
        }
    };

    const playSfx = (k: SfxKey) => {
        if (stateRef.current.sfxMuted) return;
        const a = sfxRef.current?.[k];
        if (a) {
            a.currentTime = 0;
            a.volume = Math.min(1, Math.max(0, stateRef.current.sfxVol));
            a.play().catch(() => {});
        }
    };

    return {
        sfxMuted, setSfxMuted,
        musicMuted, setMusicMuted,
        sfxVol, setSfxVol,
        musicVol, setMusicVol,
        armAudio, playSfx
    };
}