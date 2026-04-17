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
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
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
    setProgress(0);
    setError('');
    setStatusMsg('Preparando...');

    // Etapa 1: pedir URL de sessão ao servidor (< 1 segundo, sem timeout)
    fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
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

        setStatusMsg('Enviando ao Google Drive...');

        // Etapa 2: browser envia arquivo direto ao Drive via XHR
        // Servidor não toca nos bytes — zero timeout no Render
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setProgress(pct);
            setStatusMsg(pct < 100 ? `Enviando ao Drive... ${pct}%` : 'Finalizando...');
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const text = xhr.responseText.trim();
              // Drive pode retornar body vazio em alguns casos — buscar fileId de outra forma
              let fileId: string | null = null;

              if (text) {
                const driveRes = JSON.parse(text);
                fileId = driveRes.id || driveRes.fileId || null;
              }

              if (!fileId) {
                // Se não veio no body, tentar extrair do header Location
                const location = xhr.getResponseHeader('Location') || '';
                const match = location.match(/\/files\/([^?/]+)/);
                fileId = match?.[1] || null;
              }

              if (!fileId) {
                setUploading(false);
                setError('Upload concluído mas fileId não retornado. Tente recarregar a página.');
                fetchMedia(); // arquivo pode ter sido salvo mesmo assim
                return;
              }

              setStatusMsg('Configurando acesso...');

              // Etapa 3: servidor define permissão pública (só fileId, < 1s)
              fetch('/api/upload/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId }),
              }).finally(() => {
                setProgress(100);
                setStatusMsg('');
                setUploading(false);
                fetchMedia();
              });
            } catch {
              setUploading(false);
              setError('Erro ao processar resposta do Drive');
            }
          } else {
            setUploading(false);
            setError(`Drive retornou erro ${xhr.status}: ${xhr.responseText.slice(0, 100)}`);
          }
        });

        xhr.addEventListener('error', () => {
          setUploading(false);
          setError('Falha de conexão com o Google Drive');
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      })
      .catch(() => {
        setUploading(false);
        setError('Falha ao conectar com o servidor');
      });
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
          <div style={{ width: '100%', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.82rem', opacity: 0.75 }}>
              <span>{statusMsg}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: progress < 100
                  ? 'linear-gradient(90deg, #6b4cff, #a78bfa)'
                  : 'linear-gradient(90deg, #059669, #34d399)',
                borderRadius: '99px',
                transition: 'width 0.2s ease, background 0.5s ease',
              }} />
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
