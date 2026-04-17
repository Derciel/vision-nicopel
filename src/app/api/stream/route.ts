import { NextResponse } from 'next/server';
import { getAccessToken, getDriveClient } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return NextResponse.json({ error: 'ID do arquivo não fornecido' }, { status: 400 });
  }

  try {
    const drive = getDriveClient();

    // Buscar metadados
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType,size,name',
    });

    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const totalSize = Number(meta.data.size || 0);

    // Verificar se o cliente pediu um range (player de vídeo sempre pede)
    const rangeHeader = request.headers.get('range');

    // Calcular range
    let start = 0;
    let end = totalSize - 1;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1]);
        end = match[2] ? parseInt(match[2]) : Math.min(start + 5 * 1024 * 1024 - 1, totalSize - 1);
      }
    }

    const chunkSize = end - start + 1;

    // Buscar o trecho do arquivo diretamente da API do Drive usando Range header
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
      return NextResponse.json({ error: 'Falha ao buscar arquivo' }, { status: 500 });
    }

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Length', String(chunkSize));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    // Se foi range request, responder com 206 Partial Content
    if (rangeHeader && totalSize > 0) {
      headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      return new Response(driveRes.body, {
        status: 206,
        headers,
      });
    }

    // Resposta completa (imagens ou primeira carga)
    return new Response(driveRes.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[stream] Erro:', error);
    return NextResponse.json({ error: 'Falha ao transmitir arquivo' }, { status: 500 });
  }
}
