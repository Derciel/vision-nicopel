import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/confirm
 * Body JSON: { fileId }
 * Chamado pelo browser após o upload direto ao Drive ser concluído.
 */
export async function POST(req: Request) {
  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: 'fileId é obrigatório.' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return NextResponse.json({ success: true, fileId });
  } catch (e: any) {
    console.error('[confirm] ERRO:', e);
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
}
