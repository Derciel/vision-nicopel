'use client';

import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  muted: boolean;
  onEnded: () => void;
  onError: () => void;
  className?: string;
  preload?: 'auto' | 'metadata' | 'none';
}

export default function VideoPlayer({
  src,
  muted,
  onEnded,
  onError,
  className,
  preload = 'auto',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleWaiting = () => {
      stallTimer = setTimeout(() => {
        if (videoRef.current) {
          if (videoRef.current.paused || videoRef.current.readyState < 3) {
            console.warn('[Video] Demora alta no carregamento, pulando...');
            onError();
          }
        }
      }, 10000); // 10s de tolerância
    };

    const handlePlaying = () => {
      if (stallTimer) clearTimeout(stallTimer);
    };

    const el = videoRef.current;
    if (el) {
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('error', onError);
    }
    
    return () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (el) {
        el.removeEventListener('waiting', handleWaiting);
        el.removeEventListener('playing', handlePlaying);
        el.removeEventListener('error', onError);
      }
    };
  }, [onError]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={`native-video ${className || ''}`}
      autoPlay
      muted={muted}
      preload={preload}
      playsInline
      onEnded={onEnded}
      disableRemotePlayback
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        position: 'absolute',
        top: 0,
        left: 0,
        border: 'none',
        background: '#000'
      }}
    />
  );
}
