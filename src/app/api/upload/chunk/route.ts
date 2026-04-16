import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/upload/chunk
 * Headers obrigatórios:
 *   x-upload-url    — URL resumable do Drive
 *   x-chunk-start   — byte inicial do chunk (ex: 0)
 *   x-chunk-end     — byte final do chunk (ex: 5242879)
 *   x-total-size    — tamanho total do arquivo
 *   content-type    — mimeType do arquivo
 *
 * Body: bytes brutos do chunk (sem multipart)
 *
 * Retorna:
 *   { done: false, nextByte: number }  — chunk aceito, continuar
 *   { done: true, fileId: string }     — upload completo
 */
export async function POST(req: Request) {
  try {
    const uploadUrl = req.headers.get('x-upload-url');
    const chunkStart = Number(req.headers.get('x-chunk-start'));
    const chunkEnd = Number(req.headers.get('x-chunk-end'));
    const totalSize = Number(req.headers.get('x-total-size'));
    const mimeType = req.headers.get('content-type') || 'application/octet-stream';

    if (!uploadUrl || isNaN(chunkStart) || isNaN(chunkEnd) || isNaN(totalSize)) {
      return NextResponse.json({ error: 'Headers obrigatórios ausentes.' }, { status: 400 });
    }

    // Ler o chunk do body — apenas este pedaço fica na RAM (~5MB)
    const chunkBuffer = await req.arrayBuffer();

    // Enviar chunk para o Drive via Content-Range
    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalSize}`,
        'Content-Length': String(chunkBuffer.byteLength),
      },
      body: chunkBuffer,
    });

    // 308 = chunk aceito, upload incompleto
    if (driveRes.status === 308) {
      const rangeHeader = driveRes.headers.get('Range');
      const nextByte = rangeHeader
        ? parseInt(rangeHeader.split('-')[1]) + 1
        : chunkEnd + 1;
      return NextResponse.json({ done: false, nextByte });
    }

    // 200 ou 201 = upload completo
    if (driveRes.status === 200 || driveRes.status === 201) {
      const driveFile = await driveRes.json();
      const fileId = driveFile.id;

      // Definir permissão pública
      try {
        const accessToken = await getAccessToken();
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        });
      } catch (e) {
        console.error('Erro ao definir permissão:', e);
      }

      return NextResponse.json({ done: true, fileId });
    }

    // Erro do Drive
    const errText = await driveRes.text();
    console.error(`Drive retornou ${driveRes.status}:`, errText);
    return NextResponse.json(
      { error: `Drive retornou status ${driveRes.status}` },
      { status: 500 }
    );
  } catch (e: any) {
    console.error('Erro em /upload/chunk:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
