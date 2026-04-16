import { NextResponse } from 'next/server';
import { getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import { Readable } from 'stream';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as globalThis.File;
    const withAudio = formData.get('withAudio') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const drive = getDriveClient();
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

    // Converter Web ReadableStream → Node Readable sem buffer completo
    const nodeStream = Readable.fromWeb(file.stream() as any);

    const response = await drive.files.create(
      {
        requestBody: {
          name: finalName,
          parents: [DRIVE_FOLDER_ID],
        },
        media: {
          mimeType,
          body: nodeStream,
        },
        fields: 'id',
      },
      {
        // Usar upload resumable para arquivos grandes (googleapis faz isso automaticamente
        // quando o body é um stream — sem carregar tudo na RAM)
        onUploadProgress: (evt: any) => {
          console.log(`[upload] ${evt.bytesRead} bytes enviados ao Drive`);
        },
      }
    );

    const fileId = response.data.id;

    // Definir permissão pública
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
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
    console.error('[upload] ERRO:', e?.message, e?.response?.data);
    return NextResponse.json(
      { error: e.message || 'Erro interno no upload' },
      { status: 500 }
    );
  }
}
