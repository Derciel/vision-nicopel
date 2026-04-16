import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1Bc22xR6zZkAGmdoxlMkKUieO8a_G8Ap-';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

let drive: any = null;
let authClient: any = null;

export function getDriveClient() {
  if (drive) return drive;

  if (process.env.GOOGLE_CREDENTIALS) {
    // Produção: usa JWT com as credenciais da service account via env
    try {
      const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

      // JWT é o método correto para service account sem arquivo físico
      authClient = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: SCOPES,
      });
    } catch (e) {
      console.error('[google-drive] Erro ao processar GOOGLE_CREDENTIALS:', e);
      throw new Error('GOOGLE_CREDENTIALS inválido. Verifique se é um JSON válido em uma linha.');
    }
  } else {
    // Desenvolvimento local: arquivo JSON
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      const creds = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
      authClient = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: SCOPES,
      });
    } else {
      throw new Error(
        'Credenciais não encontradas. Adicione GOOGLE_CREDENTIALS no Render ou google-service-account.json localmente.'
      );
    }
  }

  drive = google.drive({ version: 'v3', auth: authClient });
  return drive;
}

/** Retorna um access token OAuth2 válido para uso direto em fetch() */
export async function getAccessToken(): Promise<string> {
  if (!authClient) getDriveClient();

  // JWT.getAccessToken() retorna { token, res }
  const result = await authClient.getAccessToken();
  const token = result?.token ?? result?.res?.data?.access_token;

  if (!token) {
    throw new Error('Falha ao obter access token. Verifique as credenciais no Render.');
  }
  return token as string;
}
