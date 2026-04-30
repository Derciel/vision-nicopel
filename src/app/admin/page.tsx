'use client';

import { useState, useEffect } from 'react';
import { Upload, Trash2, Video, Image as ImageIcon, Volume2, VolumeX, Settings } from 'lucide-react';
import styles from './page.module.css';

type Media = {
  id?: string;
  name: string;
  url: string;
  type: string;
  createdAt: number;
  quality?: string;
};

export default function AdminPage() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [withAudio, setWithAudio] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [globalMute, setGlobalMute] = useState(false);

  useEffect(() => {
    fetchMedia();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.isMuted !== undefined) setGlobalMute(data.isMuted);
      }
    } catch (e) { console.error(e); }
  };

  const toggleGlobalMute = async () => {
    const newState = !globalMute;
    setGlobalMute(newState);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted: newState }),
      });
    } catch (e) { console.error(e); }
  };

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
    setProgress(0);
    setError('');
    setStatusMsg('Preparando...');

    const isVideo = file.type.startsWith('video/');
    const nameWithMeta = file.name
      .replace(/\.[^/.]+$/, "") 
      + (isVideo ? `__q_${quality}__` : "")
      + (withAudio ? '__audio_on__' : '__audio_off__')
      + (file.name.match(/\.[^/.]+$/)?.[0] || "");

    fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: nameWithMeta,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        withAudio,
      }),
    })
      .then((r) => r.json())
      .then(({ uploadUrl, error: err }) => {
        if (err || !uploadUrl) {
          setError(err || 'Falha ao iniciar upload');
          setUploading(false);
          return;
        }

        setStatusMsg('Enviando ao Drive...');
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setProgress(pct);
            setStatusMsg(pct < 100 ? `Enviando... ${pct}%` : 'Finalizando...');
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            let fileId: string | null = null;
            const text = xhr.responseText.trim();
            if (text) {
              try {
                const driveRes = JSON.parse(text);
                fileId = driveRes.id || driveRes.fileId || null;
              } catch (e) {}
            }
            if (!fileId) {
              const location = xhr.getResponseHeader('Location') || '';
              const match = location.match(/\/files\/([^?/]+)/);
              fileId = match?.[1] || null;
            }

            if (!fileId) {
              setError('Upload ok, mas ID não retornado');
              setUploading(false);
              return;
            }

            fetch('/api/upload/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId }),
            }).finally(() => {
              setUploading(false);
              fetchMedia();
            });
          } else {
            setError(`Erro ${xhr.status}`);
            setUploading(false);
          }
        });

        xhr.open('PUT', uploadUrl);
        xhr.send(file);
      })
      .catch(() => {
        setUploading(false);
        setError('Erro de conexão');
      });
  };

  const handleDelete = async (media: Media) => {
    if (!confirm('Excluir permanentemente?')) return;
    try {
      const res = await fetch(`/api/media?id=${media.id}`, { method: 'DELETE' });
      if (res.ok) fetchMedia();
    } catch (e) { console.error(e); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Vision <span>Admin</span></h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button 
            onClick={toggleGlobalMute}
            className={globalMute ? styles.muteBtnActive : styles.muteBtn}
            title={globalMute ? "Som Desativado Globalmente" : "Som Ativado"}
          >
            {globalMute ? <VolumeX size={20} /> : <Volume2 size={20} />}
            <span>{globalMute ? 'MUDO ATIVO' : 'SOM ATIVO'}</span>
          </button>
          <a href="/" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Visualizador ↗</a>
        </div>
      </div>

      <div className={styles.optionsBar}>
        <div className={styles.configGroup}>
          <label className={styles.optionLabel}>
            <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
            <span>🔊 Áudio no Upload</span>
          </label>
          <div className={styles.qualitySelector}>
             <Settings size={16} />
             <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="720p">720p (Leve)</option>
                <option value="1080p">1080p (Padrão)</option>
                <option value="4k">4K (Premium)</option>
             </select>
          </div>
        </div>
      </div>

      <div className={styles.uploadSection}>
        <Upload size={48} color="var(--accent)" />
        <p>Arraste ou clique para upload</p>
        <input type="file" className={styles.uploadInput} onChange={handleUpload} disabled={uploading} />
        {uploading && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      <div className={styles.grid}>
        {mediaList.map((media) => (
          <div key={media.id} className={styles.card}>
            {media.type === 'video' ? (
              <video src={`/api/stream?id=${media.id}`} className={styles.mediaThumbnail} muted loop />
            ) : (
              <img src={`/api/stream?id=${media.id}`} className={styles.mediaThumbnail} alt="" />
            )}
            <div className={styles.overlay}>
              <button className={styles.deleteBtn} onClick={() => handleDelete(media)}><Trash2 size={18} /></button>
            </div>
            <div className={styles.badge}>
               {media.name.includes('__q_4k__') ? '4K' : media.name.includes('__q_720__') ? '720p' : '1080p'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
