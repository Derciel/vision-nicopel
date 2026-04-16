import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1Bc22xR6zZkAGmdoxlMkKUieO8a_G8Ap-';

let drive: any = null;
let authClient: any = null;

export function getDriveClient() {
  if (drive) return drive;

  const scopes = ['https://www.googleapis.com/auth/drive'];

  if (process.env.GOOGLE_CREDENTIALS) {
    // Produção (Render): credenciais via variável de ambiente
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      // GoogleAuth com credentials de service account precisa do campo 'key' ou usar JWT diretamente
      authClient = new google.auth.GoogleAuth({
        credentials,
        scopes,
      });
    } catch (e) {
      console.error('[google-drive] Erro ao processar GOOGLE_CREDENTIALS:', e);
      throw new Error('Credenciais do Google inválidas. Verifique a variável GOOGLE_CREDENTIALS.');
    }
  } else {
    // Desenvolvimento local: arquivo JSON
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      authClient = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes,
      });
    } else {
      throw new Error(
        'Credenciais não encontradas. Configure GOOGLE_CREDENTIALS no Render ou adicione google-service-account.json localmente.'
      );
    }
  }

  drive = google.drive({ version: 'v3', auth: authClient });
  return drive;
}

/** Retorna um access token OAuth2 válido */
export async function getAccessToken(): Promise<string> {
  if (!authClient) getDriveClient();
  const token = await authClient.getAccessToken();
  if (!token?.token) {
    throw new Error('Falha ao obter access token do Google. Verifique as credenciais.');
  }
  return token.token as string;
}
