'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

type Media = {
  id: string; // ID do Google Drive
  name: string;
  url: string;
  type: 'video' | 'image';
  withAudio: boolean;
};

const REFRESH_INTERVAL_MS = 10000; // 10 segundos para checar novas mídias

export default function Home() {
  const [playlist, setPlaylist] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(true); 
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);

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
        // Só atualiza se houver mudança real na lista para evitar "pulo" de vídeo
        setPlaylist(prev => {
           if (JSON.stringify(prev) !== JSON.stringify(data.files)) {
             return data.files;
           }
           return prev;
        });
      }
    } catch (e) {
      console.error('Falha ao buscar playlist', e);
    }
  };

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  useEffect(() => {
    if (playlist.length === 0) return;

    const currentMedia = playlist[currentIndex];
    
    if (currentMedia.type === 'image') {
      const timer = setTimeout(nextMedia, 7000); // 7 seg para imagens
      return () => clearTimeout(timer);
    } else if (currentMedia.type === 'video') {
      if (videoRef.current) {
         videoRef.current.currentTime = 0;
         videoRef.current.muted = !currentMedia.withAudio;
         
         const playPromise = videoRef.current.play();
         if (playPromise !== undefined) {
           playPromise.catch(e => {
             console.log("Autoplay bloqueado. Tentando mudo...", e);
             if (videoRef.current) {
                videoRef.current.muted = true;
                setShowUnmuteHint(true);
                videoRef.current.play().catch(err => {
                    console.error("Falha fatal no video. Pulando...", err);
                    nextMedia();
                });
             }
           });
         }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playlist.length, isStarted]);

  // Função para "desbloquear" o som globalmente ao clicar
  const unlockAudio = () => {
    if (videoRef.current) {
        videoRef.current.muted = !playlist[currentIndex]?.withAudio;
        setShowUnmuteHint(false);
    }
  };

  if (playlist.length === 0) {
    return (
      <div className="fullscreen-container" style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
        <p>Aguardando mídias...</p>
      </div>
    );
  }

  // Preloader para a Próxima Mídia (fica escondida)
  const nextMediaItem = playlist[(currentIndex + 1) % playlist.length];

  return (
    <div className="fullscreen-container" style={{ background: '#000', overflow: 'hidden' }} onClick={unlockAudio}>
      {playlist.map((media, index) => {
        const isActive = index === currentIndex;
        // Usamos a nossa rota de STREAM interna para garantir que o vídeo rode sem avisos de vírus do Google
        const streamUrl = `/api/stream?id=${media.id}`;
        
        return (
          <div key={media.id} className={`fullscreen-media ${isActive ? 'active' : ''}`}>
            {media.type === 'video' ? (
              <>
                 <video src={streamUrl} className="media-bg" muted playsInline />
                 <video
                    ref={isActive ? videoRef : null}
                    src={streamUrl}
                    className="media-fg"
                    onEnded={nextMedia}
                    muted={!media.withAudio}
                    playsInline
                    preload="auto"
                    onError={(e) => {
                        console.error("Erro no video do Drive. Pulando...", e);
                        nextMedia();
                    }}
                 />
              </>
            ) : (
              <>
                <img src={`/api/stream?id=${media.id}`} className="media-bg" alt="" />
                <img src={`/api/stream?id=${media.id}`} className="media-fg" alt={media.name} />
              </>
            )}
          </div>
        );
      })}

      {/* Camada Invisível de Pré-carregamento do Próximo Item */}
      <div style={{ display: 'none' }}>
        {nextMediaItem.type === 'video' ? (
            <video src={`/api/stream?id=${nextMediaItem.id}`} preload="auto" muted />
        ) : (
            <img src={`/api/stream?id=${nextMediaItem.id}`} alt="" />
        )}
      </div>

      {showUnmuteHint && (
          <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 20px', borderRadius: '30px', fontSize: '0.9rem', zIndex: 10000, pointerEvents: 'none', animation: 'pulse 2s infinite' }}>
              🔇 Clique para ativar o som
          </div>
      )}
    </div>
  );
}
