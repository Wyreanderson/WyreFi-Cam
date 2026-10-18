import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve, dirname, isAbsolute } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { validateHost, makeOrigin, newConfig, updateConfig, parseArgs } from './lib/config.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`WyreFi Cam · setup (Node 24)\n\nnpm run setup                       Assistente de escolha do endereço\nnpm run setup -- --host IP --cert    Configurar e emitir certificado com a CA existente\nnpm run setup -- --host IP --update-host --cert\n                                    Alterar endereço preservando tokens\nnpm run setup -- --cert              Emitir certificado para o endereço já configurado\nnpm run setup -- --rotate-tokens     Revogar URLs anteriores e gerar tokens novos\n\nNão instala CA, não altera firewall e não substitui configuração existente sem uma opção explícita.`);
    return;
  }
  const existing = existsSync('.env');
  let source = existing ? readFileSync('.env', 'utf8') : '';
  let config = parseEnv(source);
  let host = options.host;
  if (existing && !options.updateHost && host && makeOrigin(host) !== config.LAN_ORIGIN) {
    throw Error('O .env existente foi preservado. Para alterar o endereço: --host ENDEREÇO --update-host --cert.');
  }
  if (!existing || options.updateHost) {
    if (!host) {
      const addresses = Object.entries(networkInterfaces()).flatMap(([name, rows]) =>
        (rows ?? []).filter(n => n.family === 'IPv4' && !n.internal).map(n => `${name}: ${n.address}`));
      console.log(`Endereços disponíveis (VPN/WSL podem não ser a LAN):\n${addresses.join('\n')}`);
      if (!process.stdin.isTTY) throw Error('Indique o endereço alcançável pelo iPhone: npm run setup -- --host ENDEREÇO --cert');
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try { host = validateHost(await prompt.question('IP LAN ou IP Tailscale do servidor: ')); }
      finally { prompt.close(); }
    }
    source = existing ? updateConfig(source, { LAN_ORIGIN: makeOrigin(host) }) : newConfig(host);
  }
  if (options.rotate) {
    source = updateConfig(source, {
      PUBLISH_TOKEN: randomBytes(32).toString('hex'),
      VIEW_TOKEN: randomBytes(32).toString('hex'),
    });
  }
  if (source !== (existing ? readFileSync('.env', 'utf8') : '')) {
    writeFileSync('.env', source, { mode: 0o600, flag: existing ? 'w' : 'wx' });
  }
  config = parseEnv(source);
  const origin = new URL(config.LAN_ORIGIN);
  host = validateHost(origin.hostname.replace(/^\[|\]$/g, ''));
  if (options.cert) {
    const caResult = spawnSync('mkcert', ['-CAROOT'], { encoding: 'utf8', timeout: 10000 });
    if (caResult.error || caResult.status !== 0) throw Error('Instale mkcert e execute mkcert -install manualmente. Depois repita npm run setup -- --cert.');
    const caRoot = caResult.stdout.trim();
    if (!existsSync(resolve(caRoot, 'rootCA.pem')) || !existsSync(resolve(caRoot, 'rootCA-key.pem'))) {
      throw Error('CA mkcert ausente. Execute mkcert -install manualmente; depois npm run setup -- --cert.');
    }
    const cert = config.TLS_CERT || 'certs/local.pem';
    const key = config.TLS_KEY || 'certs/local-key.pem';
    for (const file of [cert, key]) {
      if (isAbsolute(file) || !resolve(file).startsWith(resolve('certs') + (process.platform === 'win32' ? '\\' : '/'))) {
        throw Error('O setup só escreve certificados dentro de certs/. Ajuste TLS_CERT/TLS_KEY ou gere-os manualmente.');
      }
      mkdirSync(dirname(resolve(file)), { recursive: true });
    }
    const result = spawnSync('mkcert', ['-cert-file', cert, '-key-file', key, ...new Set([host, 'localhost', '127.0.0.1'])], { stdio: 'inherit', timeout: 30000 });
    if (result.error || result.status !== 0) throw Error('Não foi possível emitir o certificado. A configuração .env foi preservada.');
  }
  console.log(`\nConfiguração ${existing ? 'preservada/atualizada' : 'criada'}: ${origin.origin}\nTokens privados não são mostrados. Não publique .env nem certs/.\n${existsSync(config.TLS_CERT || 'certs/local.pem') ? 'Próximo: npm run build && npm run start' : 'Falta certificado: instale mkcert, execute mkcert -install e npm run setup -- --cert'}\nDashboard: http://127.0.0.1:8765\nNo iPhone: instale APENAS a CA pública e abra o QR do dashboard. Consulte README.`);
}

main().catch(error => { console.error(`Setup: ${error.message}`); process.exitCode = 1; });
