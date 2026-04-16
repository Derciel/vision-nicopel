import { NextResponse } from 'next/server';
import { getAccessToken, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/upload  (multipart/form-data)
 *
 * Estratégia: lê os metadados do arquivo, abre uma sessão de upload
 * resumable no Google Drive e faz pipe do stream do arquivo diretamente
 * para o Drive — sem carregar o arquivo inteiro na RAM.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as globalThis.File;
    const withAudio = formData.get('withAudio') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const isVideo = ['.mp4', '.webm', '.mov'].includes(
      path.extname(cleanName).toLowerCase()
    );
    const finalName =
      isVideo && withAudio
        ? `${timestamp}__audio_on__${cleanName}`
        : `${timestamp}_${cleanName}`;

    const mimeType = file.type || 'application/octet-stream';

    // 1. Iniciar sessão de upload resumable no Google Drive
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(file.size),
        },
        body: JSON.stringify({
          name: finalName,
          parents: [DRIVE_FOLDER_ID],
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      console.error('Falha ao iniciar sessão resumable:', err);
      return NextResponse.json({ error: 'Falha ao iniciar upload no Drive.' }, { status: 500 });
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      return NextResponse.json({ error: 'URL de upload não retornada.' }, { status: 500 });
    }

    // 2. Fazer stream do arquivo direto para o Drive usando a URL resumable
    //    file.stream() retorna um ReadableStream sem carregar tudo na RAM
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(file.size),
      },
      // @ts-ignore — duplex é necessário para streaming no Node 18+
      duplex: 'half',
      body: file.stream(),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('Falha no upload para o Drive:', err);
      return NextResponse.json({ error: 'Falha ao enviar arquivo ao Drive.' }, { status: 500 });
    }

    const driveFile = await uploadRes.json();
    const fileId = driveFile.id;

    // 3. Definir permissão pública
    try {
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        }
      );
      if (!permRes.ok) {
        console.error('Falha ao definir permissão:', await permRes.text());
      }
    } catch (e) {
      console.error('Erro ao definir permissão pública:', e);
    }

    return NextResponse.json({
      success: true,
      fileId,
      url: `https://drive.google.com/uc?id=${fileId}&export=download`,
    });
  } catch (e: any) {
    console.error('Erro no upload:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
