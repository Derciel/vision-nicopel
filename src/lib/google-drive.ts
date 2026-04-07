import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// ID da pasta no Google Drive (prioriza variável de ambiente)
export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1Bc22xR6zZkAGmdoxlMkKUieO8a_G8Ap-'; 

// Singleton da API do Drive
let drive: any = null;

export function getDriveClient() {
  if (drive) return drive;

  const authOptions: any = {
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  };

  // Tenta carregar credenciais das variáveis de ambiente primeiro (recomendado para Render)
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      authOptions.credentials = credentials;
    } catch (e) {
      console.error('Erro ao processar GOOGLE_CREDENTIALS:', e);
    }
  } else {
    // Fallback para arquivo local (para desenvolvimento local)
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      authOptions.keyFile = SERVICE_ACCOUNT_PATH;
    } else {
      console.warn('Google Credentials não encontradas (nem via env, nem via arquivo)!');
    }
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  drive = google.drive({ version: 'v3', auth });
  return drive;
}
