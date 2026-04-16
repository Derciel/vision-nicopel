import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/confirm
 * Body JSON: { fileId }
 *
 * Chamado pelo browser após o upload direto ao Drive ser concluído.
 * Define a permissão pública no arquivo.
 */
export async function POST(req: Request) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'fileId é obrigatório.' }, { status: 400 });
    }

    const drive = getDriveClient();

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return NextResponse.json({ success: true, fileId });
  } catch (e: any) {
    console.error('Erro ao confirmar upload:', e);
    return NextResponse.json({ error: e.message || 'Erro ao definir permissão' }, { status: 500 });
  }
}
