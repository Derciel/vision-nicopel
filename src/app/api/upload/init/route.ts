import { NextResponse } from 'next/server';
import { getDriveClient, getAccessToken, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';
import { uploadSessions, cleanOldSessions } from '@/lib/upload-sessions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('[upload/init] Iniciando...');
    const { fileName, mimeType, fileSize, withAudio } = await req.json();
    console.log('[upload/init] Dados recebidos:', { fileName, mimeType, fileSize, withAudio });

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'fileName, mimeType e fileSize são obrigatórios.' },
        { status: 400 }
      );
    }

    console.log('[upload/init] Obtendo token...');
    getDriveClient();
    const accessToken = await getAccessToken();
    console.log('[upload/init] Token obtido:', accessToken ? 'OK' : 'FALHOU');

    const timestamp = Date.now();
    const cleanName = (fileName as string).replace(/[^a-zA-Z0-9.\-_]/g, '');
    const isVideo = ['.mp4', '.webm', '.mov'].includes(
      path.extname(cleanName).toLowerCase()
    );
    const finalName =
      isVideo && withAudio
        ? `${timestamp}__audio_on__${cleanName}`
        : `${timestamp}_${cleanName}`;

    console.log('[upload/init] Criando sessão no Drive...');
    // Criar sessão de upload resumable no Drive
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
      console.error('[upload/init] Falha ao iniciar sessão resumable:', err);
      return NextResponse.json(
        { error: 'Falha ao iniciar upload no Drive.' },
        { status: 500 }
      );
    }

    const uploadUrl = initRes.headers.get('Location');
    console.log('[upload/init] Upload URL recebida:', uploadUrl ? 'OK' : 'FALHOU');
    if (!uploadUrl) {
      return NextResponse.json(
        { error: 'URL de upload não retornada pelo Drive.' },
        { status: 500 }
      );
    }

    // Guardar a URL no servidor — o browser só recebe um ID curto
    const sessionId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Limpar sessões antigas antes de criar nova
    cleanOldSessions();
    
    uploadSessions.set(sessionId, {
      uploadUrl,
      mimeType,
      createdAt: timestamp,
    });

    console.log('[upload/init] Sessão criada:', sessionId);
    return NextResponse.json({ sessionId, finalName });
  } catch (e: any) {
    console.error('[upload/init] ERRO:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
