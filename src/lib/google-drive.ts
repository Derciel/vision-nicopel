import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1Bc22xR6zZkAGmdoxlMkKUieO8a_G8Ap-';

let drive: any = null;
let authClient: any = null;

export function getDriveClient() {
  if (drive) return drive;

  const authOptions: any = {
    scopes: ['https://www.googleapis.com/auth/drive'],
  };

  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      authOptions.credentials = credentials;
    } catch (e) {
      console.error('Erro ao processar GOOGLE_CREDENTIALS:', e);
    }
  } else {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      authOptions.keyFile = SERVICE_ACCOUNT_PATH;
    } else {
      console.warn('Google Credentials não encontradas!');
    }
  }

  authClient = new google.auth.GoogleAuth(authOptions);
  drive = google.drive({ version: 'v3', auth: authClient });
  return drive;
}

/** Retorna um access token válido para uso direto em fetch() */
export async function getAccessToken(): Promise<string> {
  if (!authClient) getDriveClient(); // garante inicialização
  const token = await authClient.getAccessToken();
  return token.token as string;
}
