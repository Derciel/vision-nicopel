const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');

async function testConnection() {
    console.log('🔍 Testando conexão com Google Drive API...');
    
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ ERRO: Arquivo google-service-account.json não encontrado na raiz!');
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });
        
        // Simplesmente tenta listar os primeiros 5 arquivos acessíveis pela conta
        const res = await drive.files.list({
            pageSize: 5,
            fields: 'nextPageToken, files(id, name)',
        });

        const files = res.data.files;
        if (files.length === 0) {
            console.log('✅ Conexão estabelecida! (A conta não tem arquivos próprios ainda ou não compartilha nada com ela).');
            console.log('E-mail do Service Account detectado:');
            const keyContent = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
            console.log('👉', keyContent.client_email);
        } else {
            console.log('✅ Sucesso! Conexão ativa. Arquivos visíveis:');
            files.map((file) => {
                console.log(`- ${file.name} (${file.id})`);
            });
        }
    } catch (err) {
        console.error('❌ ERRO crítico ao conectar com Google API:', err.message);
    }
}

testConnection();
