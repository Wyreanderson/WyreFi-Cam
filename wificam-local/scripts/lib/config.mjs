import { isIP } from 'node:net';
import { randomBytes } from 'node:crypto';

export function validateHost(input) {
  const host = input.trim();
  if (isIP(host)) return host;
  if (!host || host.length > 253 || /^[\d.]+$/.test(host) ||
      !host.split('.').every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) {
    throw Error('Indique um IP válido ou nome DNS, sem https://, porta ou caminho.');
  }
  return host;
}

export function makeOrigin(host) {
  return `https://${isIP(host) === 6 ? `[${host}]` : host}:8443`;
}

export function updateConfig(source, changes) {
  let result = source;
  for (const [key, value] of Object.entries(changes)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    result = line.test(result) ? result.replace(line, `${key}=${value}`) : `${result.replace(/\s*$/, '')}\n${key}=${value}\n`;
  }
  return result;
}

export function newConfig(host) {
  return `LAN_ORIGIN=${makeOrigin(host)}\nLAN_BIND=0.0.0.0\nTLS_CERT=certs/local.pem\nTLS_KEY=certs/local-key.pem\nPUBLISH_TOKEN=${randomBytes(32).toString('hex')}\nVIEW_TOKEN=${randomBytes(32).toString('hex')}\n`;
}

export function parseArgs(args) {
  const flags = { cert: false, updateHost: false, rotate: false, help: false, host: undefined };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--cert') flags.cert = true;
    else if (arg === '--update-host') flags.updateHost = true;
    else if (arg === '--rotate-tokens') flags.rotate = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--host') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('--host exige um endereço.');
      flags.host = validateHost(args[++i]);
    } else if (!arg.startsWith('-') && !flags.host) flags.host = validateHost(arg);
    else throw Error(`Argumento desconhecido: ${arg}`);
  }
  return flags;
}
