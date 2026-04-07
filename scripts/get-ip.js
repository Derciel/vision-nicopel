const os = require('os');
const interfaces = os.networkInterfaces();
const addresses = [];

for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
            addresses.push(address.address);
        }
    }
}

console.log('\n🚀 Sistema pronto para acesso na rede local!');
console.log('Use um dos endereços abaixo no seu navegador (TV ou Celular):');
addresses.forEach(ip => {
    console.log(`👉 http://${ip}:3000`);
});
console.log('\nNota: Se não carregar, verifique o Firewall do Windows.\n');
