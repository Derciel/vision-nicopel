import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google-drive';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return NextResponse.json({ error: 'ID do arquivo não fornecido' }, { status: 400 });
  }

  try {
    const drive = getDriveClient();
    
    // Buscar metadados do arquivo para pegar o MimeType correto
    const metadata = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType, size, name'
    });

    // Solicitar o arquivo como um stream de mídia (mais rápido)
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Repassar os headers do Google para o navegador
    const headers = new Headers();
    headers.set('Content-Type', metadata.data.mimeType || 'video/mp4');
    if (metadata.data.size) {
        headers.set('Content-Length', metadata.data.size);
    }
    // Permite que o navegador faça streaming em partes (essencial para vídeos longos)
    headers.set('Accept-Ranges', 'bytes'); 

    // Retornar o stream direto do Google para o cliente
    return new Response(response.data, {
      headers: headers,
    });
  } catch (error: any) {
    console.error('Erro no Stream do Drive:', error);
    return NextResponse.json({ error: 'Falha ao transmitir vídeo' }, { status: 500 });
  }
}
