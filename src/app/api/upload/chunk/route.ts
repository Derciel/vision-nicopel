import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/google-drive';
import { uploadSessions } from '@/lib/upload-sessions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const sessionId = req.headers.get('x-session-id');
    const chunkStart = Number(req.headers.get('x-chunk-start'));
    const chunkEnd = Number(req.headers.get('x-chunk-end'));
    const totalSize = Number(req.headers.get('x-total-size'));

    if (!sessionId || isNaN(chunkStart) || isNaN(chunkEnd) || isNaN(totalSize)) {
      return NextResponse.json({ error: 'Headers obrigatórios ausentes.' }, { status: 400 });
    }

    const session = uploadSessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Sessão de upload não encontrada ou expirada.' },
        { status: 404 }
      );
    }

    const { uploadUrl, mimeType } = session;

    // Ler apenas este chunk na RAM (~5MB)
    const chunkBuffer = await req.arrayBuffer();

    // Enviar chunk ao Drive com Content-Range
    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalSize}`,
        'Content-Length': String(chunkBuffer.byteLength),
      },
      body: chunkBuffer,
    });

    // 308 Resume Incomplete — chunk aceito, continuar
    if (driveRes.status === 308) {
      const rangeHeader = driveRes.headers.get('Range');
      const nextByte = rangeHeader
        ? parseInt(rangeHeader.split('-')[1]) + 1
        : chunkEnd + 1;
      return NextResponse.json({ done: false, nextByte });
    }

    // 200 / 201 — upload completo
    if (driveRes.status === 200 || driveRes.status === 201) {
      const driveFile = await driveRes.json();
      const fileId = driveFile.id;

      // Limpar sessão
      uploadSessions.delete(sessionId);

      // Definir permissão pública
      try {
        const accessToken = await getAccessToken();
        await fetch(
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
      } catch (e) {
        console.error('Erro ao definir permissão:', e);
      }

      return NextResponse.json({ done: true, fileId });
    }

    // Erro do Drive
    const errText = await driveRes.text();
    console.error(`Drive retornou ${driveRes.status}:`, errText);
    return NextResponse.json(
      { error: `Erro no Drive: ${driveRes.status} — ${errText.slice(0, 200)}` },
      { status: 500 }
    );
  } catch (e: any) {
    console.error('Erro em /upload/chunk:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
