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

  useEffect(() => {
    setMounted(true);
    fetchPlaylist();
    const interval = setInterval(fetchPlaylist, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
        // Vídeos usam URL direta do Drive — sem passar pelo servidor Render
        // Isso elimina o gargalo de RAM e timeout
        const videoSrc = `/api/stream?id=${media.id}`;
        const imgSrc = `/api/stream?id=${media.id}`;

        return (
          <div
            key={media.id}
            className={`fullscreen-media ${isActive ? 'active' : ''}`}
          >
            {media.type === 'video' ? (
              <Suspense fallback={null}>
                {/* Background desfocado */}
                {isActive && (
                  <div className="media-bg" style={{ overflow: 'hidden' }}>
                    <VideoPlayer
                      src={videoSrc}
                      muted={true}
                      onEnded={() => {}}
                      onError={() => {}}
                      isBackground={true}
                      preload="none"
                    />
                  </div>
                )}
                {/* Player principal */}
                {isActive && (
                  <div className="media-fg">
                    <VideoPlayer
                      src={videoSrc}
                      muted={!media.withAudio}
                      onEnded={nextMedia}
                      onError={() => setTimeout(nextMedia, 1000)}
                      preload="auto"
                    />
                  </div>
                )}
              </Suspense>
            ) : (
              <>
                <img src={imgSrc} className="media-bg" alt="" loading="lazy" />
                <img
                  src={imgSrc}
                  className="media-fg"
                  alt={media.name}
                  loading={isActive ? 'eager' : 'lazy'}
                />
              </>
            )}
          </div>
        );
      })}

      {/* Pré-carrega metadados do próximo item */}
      {nextItem.type === 'video' && (
        <link
          rel="preload"
          as="fetch"
          href={`/api/stream?id=${nextItem.id}`}
          crossOrigin="anonymous"
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
