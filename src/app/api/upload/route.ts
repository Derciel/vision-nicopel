import { NextResponse } from 'next/server';
import { getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import { Readable } from 'stream';
import path from 'path';

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
    const isVideo = ['.mp4', '.webm', '.mov'].includes(path.extname(cleanName).toLowerCase());

    const finalName = isVideo && withAudio 
        ? `${timestamp}__audio_on__${cleanName}`
        : `${timestamp}_${cleanName}`;

    // Converter buffer do Next.js para Readable Stream do Node (exigido pelo Google Drive)
    const buffer = Buffer.from(await file.arrayBuffer());
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: finalName,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: file.type,
        body: bufferStream,
      },
      fields: 'id, webViewLink, webContentLink',
    });

    // IMPORTANTE: Para que o player da TV funcione direto, precisamos que o arquivo seja "público" ou acessível
    // Vou tentar dar permissão de leitura para qualquer um no arquivo enviado
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (e) {
      console.error('Falha ao definir permissão pública no Drive', e);
    }

    return NextResponse.json({ 
        success: true, 
        fileId: response.data.id,
        url: `https://drive.google.com/uc?id=${response.data.id}&export=download`
    });
  } catch (e: any) {
    console.error('Erro no upload para Drive', e);
    return NextResponse.json({ error: e.message || 'Falha no processamento do upload' }, { status: 500 });
  }
}
