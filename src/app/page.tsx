'use client';

import { useState, useEffect, useRef, lazy, Suspense } from 'react';

// Importar VideoPlayer dinamicamente para evitar SSR (video.js é client-only)
const VideoPlayer = lazy(() => import('./components/VideoPlayer'));

type Media = {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'image';
  withAudio: boolean;
};

const REFRESH_INTERVAL_MS = 10000;
const IMAGE_DURATION_MS = 7000;

export default function Home() {
  const [playlist, setPlaylist] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [globalMute, setGlobalMute] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchPlaylist();
    fetchConfig();
    const interval = setInterval(() => {
      fetchPlaylist();
      fetchConfig();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.isMuted !== undefined) setGlobalMute(data.isMuted);
      }
    } catch (e) {}
  };

  const fetchPlaylist = async () => {

    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      if (data.files) {
        setPlaylist(prev =>
          JSON.stringify(prev) !== JSON.stringify(data.files) ? data.files : prev
        );
      }
    } catch (e) {
      console.error('Falha ao buscar playlist', e);
    }
  };

  const nextMedia = () => setCurrentIndex(prev => (prev + 1) % playlist.length);

  // Timer para imagens
  useEffect(() => {
    if (playlist.length === 0) return;
    const media = playlist[currentIndex];
    if (media.type !== 'image') return;
    const t = setTimeout(nextMedia, IMAGE_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playlist]);

  const unlockAudio = () => {
    setShowUnmuteHint(false);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Silencioso se falhar (alguns navegadores barram)
      });
    }
  };


  if (!mounted || playlist.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
        <p>Aguardando mídias...</p>
      </div>
    );
  }

  const nextItem = playlist[(currentIndex + 1) % playlist.length];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
      onClick={unlockAudio}
    >
      {playlist.map((media, index) => {
        const isActive = index === currentIndex;
        if (!isActive) return null; // Apenas renderiza o ativo para economizar memória no Silk

        const src = `/api/stream?id=${media.id}`;

        return (
          <div
            key={media.id}
            className="fullscreen-media active"
          >
            {media.type === 'video' ? (
              <Suspense fallback={null}>
                <div className="media-fg">
                  <VideoPlayer
                    src={src}
                    muted={globalMute || !media.withAudio}
                    onEnded={nextMedia}
                    onError={() => setTimeout(nextMedia, 1000)}
                    preload="auto"
                  />

                </div>
              </Suspense>
            ) : (
              <img
                src={src}
                className="media-fg"
                alt={media.name}
                loading="eager"
              />
            )}
          </div>
        );
      })}

      {/* Pré-carrega metadados do próximo item de forma leve */}
      {nextItem && (
        <link
          rel="prefetch"
          href={`/api/stream?id=${nextItem.id}`}
        />
      )}


      {showUnmuteHint && (
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          padding: '10px 20px', borderRadius: '30px',
          fontSize: '0.9rem', zIndex: 10000, pointerEvents: 'none',
        }}>
          🔇 Clique para ativar o som
        </div>
      )}
    </div>
  );
}
