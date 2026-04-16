import { NextResponse } from 'next/server';
import { getDriveClient, getAccessToken, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Body JSON: { fileName, mimeType, withAudio }
 *
 * Retorna uma URL de upload resumable do Google Drive.
 * O browser envia o arquivo DIRETAMENTE ao Drive — zero RAM no servidor.
 */
export async function POST(req: Request) {
  try {
    const { fileName, mimeType, withAudio } = await req.json();

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: 'fileName e mimeType são obrigatórios.' },
        { status: 400 }
      );
    }

    getDriveClient(); // garante inicialização do authClient
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

    // Iniciar sessão de upload resumable na API do Drive
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
        },
        body: JSON.stringify({
          name: finalName,
          parents: [DRIVE_FOLDER_ID],
        }),
      }
    );

    if (!initResponse.ok) {
      const errText = await initResponse.text();
      console.error('Erro ao iniciar upload resumable:', errText);
      return NextResponse.json(
        { error: 'Falha ao iniciar upload no Drive.' },
        { status: 500 }
      );
    }

    // A URL de upload resumable vem no header Location
    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      return NextResponse.json(
        { error: 'URL de upload não retornada pelo Drive.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ uploadUrl, finalName });
  } catch (e: any) {
    console.error('Erro ao criar sessão de upload:', e);
    return NextResponse.json(
      { error: e.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
