'use client';

import { useState, useEffect } from 'react';
import { Upload, Trash2, Video, Image as ImageIcon } from 'lucide-react';
import styles from './page.module.css';

type Media = {
  id?: string;
  name: string;
  url: string;
  type: string;
  createdAt: number;
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB por chunk — máximo de RAM usado no servidor

export default function AdminPage() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [browserProgress, setBrowserProgress] = useState(0);  // browser → servidor
  const [driveProgress, setDriveProgress] = useState(0);       // servidor → Drive
  const [error, setError] = useState('');
  const [withAudio, setWithAudio] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      if (data.files) setMediaList(data.files);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = '';

    setUploading(true);
    setBrowserProgress(0);
    setDriveProgress(0);
    setError('');

    try {
      // Etapa 1: iniciar sessão resumable no Drive (só metadados)
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          withAudio,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.sessionId) {
        setError(initData.error || 'Falha ao iniciar upload');
        setUploading(false);
        return;
      }

      const { sessionId } = initData;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Etapa 2: enviar chunks um a um
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE - 1, file.size - 1);
        const chunk = file.slice(start, end + 1);

        // Progresso do browser (leitura local do arquivo)
        setBrowserProgress(Math.round(((i + 1) / totalChunks) * 100));

        const chunkRes = await fetch('/api/upload/chunk', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'x-session-id': sessionId,
            'x-chunk-start': String(start),
            'x-chunk-end': String(end),
            'x-total-size': String(file.size),
          },
          body: chunk,
        });

        const chunkData = await chunkRes.json();

        if (!chunkRes.ok || chunkData.error) {
          setError(chunkData.error || `Erro no chunk ${i + 1}`);
          setUploading(false);
          return;
        }

        // Progresso do Drive (confirmado pelo servidor)
        const driveBytes = chunkData.done ? file.size : (chunkData.nextByte ?? end + 1);
        setDriveProgress(Math.round((driveBytes / file.size) * 100));

        if (chunkData.done) {
          setUploading(false);
          fetchMedia();
          return;
        }
      }
    } catch (err: any) {
      console.error('Erro no upload:', err);
      setError('Falha de conexão durante o upload');
      setUploading(false);
    }
  };

  const handleDelete = async (media: Media) => {
    if (!confirm('Deseja excluir esta mídia permanentemente?')) return;
    const identifier = media.id
      ? `id=${media.id}`
      : `file=${encodeURIComponent(media.name)}`;
    try {
      const res = await fetch(`/api/media?${identifier}`, { method: 'DELETE' });
      if (res.ok) setMediaList((prev) => prev.filter((m) => m.url !== media.url));
    } catch (e) {
      console.error('Erro ao excluir:', e);
      alert('Falha ao excluir o arquivo');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Vision <span>Admin</span>
        </h1>
        <a href="/" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Abrir Visualizador ↗
        </a>
      </div>

      <div className={styles.optionsBar}>
        <label className={styles.audioOption}>
          <input
            type="checkbox"
            checked={withAudio}
            onChange={(e) => setWithAudio(e.target.checked)}
          />
          <span>🔊 Reproduzir Vídeos com áudio</span>
        </label>
      </div>

      <div className={styles.uploadSection}>
        <Upload size={48} color="var(--accent)" style={{ margin: '0 auto' }} />
        <p>Arraste arquivos aqui ou clique para selecionar</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          Suporte a Imagens (JPG, PNG, AVIF, JFIF) e Vídeos (MP4, WEBM, MOV) — até 2GB
        </p>

        <input
          type="file"
          className={styles.uploadInput}
          accept="image/*,video/mp4,video/webm,video/quicktime"
          onChange={handleUpload}
          disabled={uploading}
        />

        {uploading && (
          <div style={{ width: '100%', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Barra 1: Browser → Servidor */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem', opacity: 0.7 }}>
                <span>📤 Enviando para o servidor</span>
                <span>{browserProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${browserProgress}%`,
                  background: 'linear-gradient(90deg, #6b4cff, #a78bfa)',
                  borderRadius: '99px',
                  transition: 'width 0.2s ease',
                }} />
              </div>
            </div>

            {/* Barra 2: Servidor → Google Drive */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem', opacity: 0.7 }}>
                <span>☁️ Salvando no Google Drive</span>
                <span>{driveProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${driveProgress}%`,
                  background: 'linear-gradient(90deg, #059669, #34d399)',
                  borderRadius: '99px',
                  transition: 'width 0.2s ease',
                }} />
              </div>
            </div>

          </div>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <h2 className={styles.galleryTitle}>Mídias Ativas em Loop ({mediaList.length})</h2>

      <div className={styles.grid}>
        {mediaList.map((media) => (
          <div key={media.url} className={styles.card}>
            {media.type === 'video' ? (
              <video
                src={media.id ? `/api/stream?id=${media.id}` : media.url}
                className={styles.mediaThumbnail}
                muted
                loop
                onMouseOver={(e) => e.currentTarget.play()}
                onMouseOut={(e) => e.currentTarget.pause()}
              />
            ) : (
              <img
                src={media.id ? `/api/stream?id=${media.id}` : media.url}
                alt={media.name}
                className={styles.mediaThumbnail}
              />
            )}
            <div className={styles.overlay}>
              <button className={styles.deleteBtn} onClick={() => handleDelete(media)}>
                <Trash2 size={18} /> Excluir
              </button>
            </div>
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '5px 8px', borderRadius: '4px', display: 'flex', gap: '5px', fontSize: '0.8rem' }}>
              {media.type === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}
              {media.type === 'video' ? 'Vídeo' : 'Imagem'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
