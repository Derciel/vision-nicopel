'use client';

import { useEffect, useRef } from 'react';
import videojs from 'video.js';

interface VideoPlayerProps {
  src: string;
  muted: boolean;
  onEnded: () => void;
  onError: () => void;
  className?: string;
  preload?: 'auto' | 'metadata' | 'none';
  isBackground?: boolean;
}

export default function VideoPlayer({
  src,
  muted,
  onEnded,
  onError,
  className,
  preload = 'auto',
  isBackground = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Criar elemento video dentro do container
    const videoEl = document.createElement('video');
    videoEl.className = `video-js ${className || ''}`;
    videoEl.setAttribute('playsinline', '');
    containerRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: !isBackground,
      muted,
      loop: isBackground,
      preload,
      controls: false,
      fluid: false,
      fill: true,
      responsive: false,
      techOrder: ['html5'],
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          // Buffer mínimo para iniciar reprodução — reduz tempo de espera
          bufferWhilePaused: false,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
      sources: [{ src, type: 'video/mp4' }],
    });

    player.on('ended', onEnded);
    player.on('error', () => {
      console.error('[VideoPlayer] Erro:', player.error());
      onError();
    });

    // Stall: se travar por 8s sem progresso, pula
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    player.on('waiting', () => {
      stallTimer = setTimeout(() => {
        if (player.paused() || player.readyState() < 3) onError();
      }, 8000);
    });
    player.on('playing', () => {
      if (stallTimer) clearTimeout(stallTimer);
    });

    playerRef.current = player;

    return () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Atualizar muted sem recriar o player
  useEffect(() => {
    if (playerRef.current && !playerRef.current.isDisposed()) {
      playerRef.current.muted(muted);
    }
  }, [muted]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />;
}
