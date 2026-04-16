/**
 * Armazena as sessões de upload resumable em memória no servidor.
 * Cada sessão tem a URL do Drive e o mimeType do arquivo.
 */

type Session = {
  uploadUrl: string;
  mimeType: string;
  createdAt: number;
};

// Map global — persiste entre requests no mesmo processo Node
export const uploadSessions = new Map<string, Session>();

/**
 * Limpa sessões antigas (mais de 2 horas).
 * Chamado manualmente antes de criar novas sessões.
 */
export function cleanOldSessions() {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  
  for (const [key, session] of uploadSessions.entries()) {
    if (now - session.createdAt > TWO_HOURS) {
      uploadSessions.delete(key);
    }
  }
}
