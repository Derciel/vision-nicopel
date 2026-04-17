'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

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

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (playlist.length === 0) return;
    const media = playlist[currentIndex];

    if (media.type === 'image') {
      const t = setTimeout(nextMedia, IMAGE_DURATION_MS);
      return () => clearTimeout(t);
    }

    if (media.type === 'video' && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = 0;
      video.muted = !media.withAudio;

      // Aguardar dados suficientes antes de tentar play (evita erro em vídeos grandes)
      const tryPlay = () => {
        const p = video.play();
        if (p) {
          p.catch(() => {
            video.muted = true;
            setShowUnmuteHint(media.withAudio);
            video.play().catch(() => setTimeout(nextMedia, 3000));
          });
        }
      };

      if (video.readyState >= 3) {
        // Já tem dados suficientes
        tryPlay();
      } else {
        video.addEventListener('canplay', tryPlay, { once: true });
        return () => video.removeEventListener('canplay', tryPlay);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playlist]);

  const unlockAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !playlist[currentIndex]?.withAudio;
      setShowUnmuteHint(false);
      videoRef.current.play().catch(() => {});
    }
  };

  if (playlist.length === 0) {
    return (
      <div className="fullscreen-container" style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        <p>Aguardando mídias...</p>
      </div>
    );
  }

  const nextItem = playlist[(currentIndex + 1) % playlist.length];

  return (
    <div className="fullscreen-container" style={{ background: '#000', overflow: 'hidden' }} onClick={unlockAudio}>

      {playlist.map((media, index) => {
        const isActive = index === currentIndex;
        const streamUrl = `/api/stream?id=${media.id}`;

        return (
          <div key={media.id} className={`fullscreen-media ${isActive ? 'active' : ''}`}>
            {media.type === 'video' ? (
              <>
                {/* Background desfocado — só carrega quando ativo */}
                {isActive && (
                  <video
                    src={streamUrl}
                    className="media-bg"
                    muted
                    playsInline
                    preload="none"
                    aria-hidden="true"
                  />
                )}
                <video
                  ref={isActive ? videoRef : null}
                  src={streamUrl}
                  className="media-fg"
                  muted
                  playsInline
                  // metadata: baixa só o header do vídeo (duração, dimensões) — não o vídeo inteiro
                  preload={isActive ? 'auto' : 'none'}
                  onEnded={nextMedia}
                  onError={() => {
                    console.error('[player] Erro no vídeo, pulando...');
                    setTimeout(nextMedia, 1000);
                  }}
                  // Stall: se travar por mais de 8s, pula
                  onStalled={() => {
                    setTimeout(() => {
                      if (videoRef.current?.paused) nextMedia();
                    }, 8000);
                  }}
                />
              </>
            ) : (
              <>
                <img src={streamUrl} className="media-bg" alt="" loading="lazy" />
                <img src={streamUrl} className="media-fg" alt={media.name} loading={isActive ? 'eager' : 'lazy'} />
              </>
            )}
          </div>
        );
      })}

      {/* Pré-carrega só o próximo item */}
      <div style={{ display: 'none' }} aria-hidden="true">
        {nextItem.type === 'video' ? (
          <video
            src={`/api/stream?id=${nextItem.id}`}
            preload="metadata"
            muted
          />
        ) : (
          <img src={`/api/stream?id=${nextItem.id}`} alt="" />
        )}
      </div>

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
