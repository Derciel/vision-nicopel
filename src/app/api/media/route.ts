import { NextResponse } from 'next/server';
import { getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';
import path from 'path';

export async function GET() {
  try {
    const drive = getDriveClient();
    
    // Lista os arquivos da pasta especificada
    const response = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
    });

    const files: any[] = response.data.files || [];
    const mediaFiles = files.filter((file: any) => {
      const ext = path.extname(file.name).toLowerCase();
      // Filtrar arquivos com base nas extensões suportadas
      return ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.webp', '.avif', '.jfif', '.heic', '.bmp', '.mov'].includes(ext);
    }).map((file: any) => {
      const isVideo = ['.mp4', '.webm', '.mov'].includes(path.extname(file.name).toLowerCase());
      const withAudio = file.name.includes('__audio_on__'); 
      
      return {
        id: file.id,
        name: file.name,
        // URL direta para o Google Drive UC (Universal Content) que permite carregar no tag de Vídeo/Imagem
        url: `https://drive.google.com/uc?id=${file.id}&export=download`,
        type: isVideo ? 'video' : 'image',
        withAudio,
        createdAt: new Date(file.createdTime).getTime()
      };
    });

    return NextResponse.json({ files: mediaFiles });
  } catch (error: any) {
    console.error('Drive API GET error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao ler arquivos do Drive' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id'); // Alterei para receber o ID do drive
    const filename = searchParams.get('file'); // Para compatibilidade se for o nome antigo

    if (!fileId && !filename) {
      return NextResponse.json({ error: 'Identificador do arquivo não fornecido' }, { status: 400 });
    }

    const drive = getDriveClient();
    
    // Se receber o ID direto, deletamos o arquivo no Drive
    if (fileId) {
      await drive.files.delete({ fileId });
    } else {
        // Se receber o nome, precisamos buscar o ID primeiro
        const findRes = await drive.files.list({
            q: `name = '${filename}' and trashed = false`,
            fields: 'files(id)',
          });
        const target = findRes.data.files[0];
        if (target) await drive.files.delete({ fileId: target.id });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Drive API DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir o arquivo no Drive' }, { status: 500 });
  }
}
