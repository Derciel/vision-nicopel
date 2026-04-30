import { NextResponse } from 'next/server';
import { getDriveClient, DRIVE_FOLDER_ID } from '@/lib/google-drive';

const CONFIG_FILE_NAME = 'config.json';

async function getConfigFileId(drive: any) {
  const res = await drive.files.list({
    q: `name = '${CONFIG_FILE_NAME}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id)',
  });
  return res.data.files[0]?.id;
}

export async function GET() {
  try {
    const drive = getDriveClient();
    const fileId = await getConfigFileId(drive);

    if (!fileId) {
      return NextResponse.json({ isMuted: false });
    }

    const file = await drive.files.get({ fileId, alt: 'media' });
    return NextResponse.json(file.data);
  } catch (error) {
    return NextResponse.json({ isMuted: false });
  }
}

export async function POST(request: Request) {
  try {
    const drive = getDriveClient();
    const body = await request.json();
    const fileId = await getConfigFileId(drive);

    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(body),
    };

    if (fileId) {
      await drive.files.update({
        fileId,
        media,
      });
    } else {
      await drive.files.create({
        requestBody: {
          name: CONFIG_FILE_NAME,
          parents: [DRIVE_FOLDER_ID],
        },
        media,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
