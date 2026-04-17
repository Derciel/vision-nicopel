import { getAccessToken, getDriveClient } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

// Cache simples de metadados para evitar chamada dupla ao Drive por request
const metaCache = new Map<string, { mimeType: string; size: number; cachedAt: number }>();
const META_TTL = 10 * 60 * 1000; // 10 minutos

const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB por chunk — melhor para alta taxa de bits do 4K

async function getFileMeta(fileId: string) {
  const cached = metaCache.get(fileId);
  if (cached && Date.now() - cached.cachedAt < META_TTL) return cached;

  const drive = getDriveClient();
  const meta = await drive.files.get({ fileId, fields: 'mimeType,size' });
  const entry = {
    mimeType: meta.data.mimeType || 'application/octet-stream',
    size: Number(meta.data.size || 0),
    cachedAt: Date.now(),
  };
  metaCache.set(fileId, entry);

  // Limpar cache antigo
  if (metaCache.size > 200) {
    const oldest = Array.from(metaCache.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
      .slice(0, 50);
    oldest.forEach(([k]) => metaCache.delete(k));
  }

  return entry;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return new Response('ID não fornecido', { status: 400 });
  }

  try {
    const { mimeType, size: totalSize } = await getFileMeta(fileId);

    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = totalSize > 0 ? Math.min(CHUNK_SIZE - 1, totalSize - 1) : 0;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1]);
        const reqEnd = match[2] ? parseInt(match[2]) : 0;
        // Limitar chunk a CHUNK_SIZE para não travar vídeos grandes
        end = reqEnd > 0
          ? Math.min(reqEnd, start + CHUNK_SIZE - 1, totalSize - 1)
          : Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
      }
    }

    const chunkSize = end - start + 1;
    const accessToken = await getAccessToken();

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Range: `bytes=${start}-${end}`,
        },
      }
    );

    if (!driveRes.ok && driveRes.status !== 206) {
      console.error('[stream] Drive retornou:', driveRes.status);
      return new Response('Falha ao buscar arquivo', { status: 502 });
    }

    const isPartial = rangeHeader && totalSize > 0;
    const headers = new Headers({
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });

    if (totalSize > 0) {
      headers.set('Content-Length', String(chunkSize));
    }

    if (isPartial) {
      headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      return new Response(driveRes.body, { status: 206, headers });
    }

    return new Response(driveRes.body, { status: 200, headers });
  } catch (error: any) {
    console.error('[stream] Erro:', error?.message);
    return new Response('Erro no stream', { status: 500 });
  }
}
