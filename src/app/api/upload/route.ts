import { NextResponse } from 'next/server';
import { getAccessToken, getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Body JSON: { fileName, mimeType, fileSize, withAudio }
 *
 * O servidor só gera a URL de sessão resumable (< 1 segundo).
 * O browser envia o arquivo diretamente ao Google Drive — zero timeout no servidor.
 */
export async function POST(req: Request) {
  try {
    const { fileName, mimeType, fileSize, withAudio } = await req.json();

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'fileName, mimeType e fileSize são obrigatórios.' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const timestamp = Date.now();
    const cleanName = (fileName as string).replace(/[^a-zA-Z0-9.\-_]/g, '');
    const isVideo = ['.mp4', '.webm', '.mov'].includes(
      path.extname(cleanName).toLowerCase()
    );
    const finalName =
      isVideo && withAudio
        ? `${timestamp}__audio_on__${cleanName}`
        : `${timestamp}_${cleanName}`;

    // Criar sessão de upload resumable — servidor só faz isso, leva < 1s
    const initRes = await fetch(
      // fields=id garante que o Drive retorna o fileId no body ao completar o upload
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
      return NextResponse.json({ error: 'URL de upload não retornada pelo Drive.' }, { status: 500 });
    }

    // Retorna a URL para o browser fazer o upload diretamente
    return NextResponse.json({ uploadUrl, finalName });
  } catch (e: any) {
    console.error('[upload] ERRO:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
