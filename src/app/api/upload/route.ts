import { NextResponse } from 'next/server';
import { getAccessToken, getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/upload
 * 
 * Recebe o arquivo como stream puro no body (sem multipart/formData).
 * Metadados vêm nos headers para evitar que o Next.js bufferize o body.
 * 
 * Headers obrigatórios:
 *   x-file-name    — nome original do arquivo
 *   x-file-size    — tamanho em bytes
 *   x-with-audio   — "true" ou "false"
 *   content-type   — mimeType do arquivo
 */
export async function POST(req: Request) {
  try {
    const fileName = decodeURIComponent(req.headers.get('x-file-name') || 'arquivo');
    const fileSize = Number(req.headers.get('x-file-size') || '0');
    const withAudio = req.headers.get('x-with-audio') === 'true';
    const mimeType = req.headers.get('content-type') || 'application/octet-stream';

    if (!fileSize) {
      return NextResponse.json({ error: 'x-file-size é obrigatório.' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const timestamp = Date.now();
    const cleanName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const isVideo = ['.mp4', '.webm', '.mov'].includes(
      path.extname(cleanName).toLowerCase()
    );
    const finalName =
      isVideo && withAudio
        ? `${timestamp}__audio_on__${cleanName}`
        : `${timestamp}_${cleanName}`;

    // 1. Criar sessão de upload resumable no Drive
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify({
          name: finalName,
          parents: [DRIVE_FOLDER_ID],
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      console.error('[upload] Falha ao criar sessão:', err);
      return NextResponse.json({ error: 'Falha ao iniciar upload no Drive.' }, { status: 500 });
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      return NextResponse.json({ error: 'URL de upload não retornada.' }, { status: 500 });
    }

    // 2. Fazer pipe do body diretamente para o Drive
    //    req.body é um ReadableStream — nunca fica todo na RAM
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileSize),
      },
      // @ts-ignore — necessário para streaming no Node 18+
      duplex: 'half',
      body: req.body,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('[upload] Falha ao enviar ao Drive:', err);
      return NextResponse.json({ error: 'Falha ao enviar arquivo ao Drive.' }, { status: 500 });
    }

    const driveFile = await uploadRes.json();
    const fileId = driveFile.id;

    // 3. Definir permissão pública
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (e) {
      console.error('[upload] Erro ao definir permissão:', e);
    }

    return NextResponse.json({
      success: true,
      fileId,
      url: `https://drive.google.com/uc?id=${fileId}&export=download`,
    });
  } catch (e: any) {
    console.error('[upload] ERRO:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
