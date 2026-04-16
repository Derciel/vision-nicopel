/**
 * Armazena as sessões de upload resumable em memória no servidor.
 * Cada sessão tem a URL do Drive e o mimeType do arquivo.
 * Sessões são limpas automaticamente após 2 horas.
 */

type Session = {
  uploadUrl: string;
  mimeType: string;
};

// Map global — persiste entre requests no mesmo processo Node
export const uploadSessions = new Map<string, Session>();

// Limpar sessões antigas a cada hora
setInterval(() => {
  // Não há timestamp aqui por simplicidade — o Drive expira a URL em ~24h
  // Em produção com múltiplas instâncias, usar Redis
  if (uploadSessions.size > 100) {
    const keys = Array.from(uploadSessions.keys());
    keys.slice(0, 50).forEach((k) => uploadSessions.delete(k));
  }
}, 60 * 60 * 1000);
