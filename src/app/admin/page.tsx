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

export default function AdminPage() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = '';

    setUploading(true);
    setUploadProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('withAudio', withAudio.toString());

    const xhr = new XMLHttpRequest();

    // Progresso real do envio (browser → servidor)
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(pct);
      }
    });

    xhr.addEventListener('load', () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            setUploadProgress(100);
            fetchMedia();
          } else {
            setError(data.error || 'Erro no upload');
          }
        } catch {
          setError('Resposta inválida do servidor');
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || `Erro ${xhr.status}`);
        } catch {
          setError(`Erro ${xhr.status} no upload`);
        }
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setError('Falha de conexão durante o upload');
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  const handleDelete = async (media: Media) => {
    if (!confirm('Deseja excluir esta mídia permanentemente?')) return;

    const identifier = media.id
      ? `id=${media.id}`
      : `file=${encodeURIComponent(media.name)}`;

    try {
      const res = await fetch(`/api/media?${identifier}`, { method: 'DELETE' });
      if (res.ok) {
        setMediaList((prev) => prev.filter((m) => m.url !== media.url));
      }
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
          <div style={{ width: '100%', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.8 }}>
              <span>Enviando para o servidor...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
                  borderRadius: '99px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            {uploadProgress === 100 && (
              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '6px', textAlign: 'center' }}>
                Processando no Google Drive...
              </p>
            )}
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
