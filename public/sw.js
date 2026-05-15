// Service Worker para interceptar requisições e pular o aviso do ngrok
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Verifica se a requisição é para o seu domínio do ngrok
  if (url.hostname.includes('ngrok-free.app')) {
    const newRequest = new Request(event.request, {
      mode: 'cors',
      credentials: 'omit',
      headers: new Headers(event.request.headers)
    });
    
    // Injeta o cabeçalho que pula a página de aviso
    newRequest.headers.set('ngrok-skip-browser-warning', 'true');

    event.respondWith(fetch(newRequest));
  }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
