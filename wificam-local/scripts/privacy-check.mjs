import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { parseEnv } from 'node:util';

const rootResult = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
if (rootResult.status !== 0) {
  console.error('Execute o privacy check dentro do clone Git.');
  process.exit(1);
}
const root = rootResult.stdout.trim();
const listed = spawnSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (listed.status !== 0) throw Error('Não foi possível listar os ficheiros publicáveis.');
const files = [...new Set(listed.stdout.split('\0').filter(Boolean))];
const failures = [];
const envPath = resolve(root, 'wificam-local/.env');
const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const secrets = [local.PUBLISH_TOKEN, local.VIEW_TOKEN].filter(value => value?.length >= 32);
let privateHost = '';
try { privateHost = new URL(local.LAN_ORIGIN).hostname; } catch { /* Fresh clone. */ }
for (const file of files) {
  const path = resolve(root, file);
  if (!existsSync(path) || !statSync(path).isFile()) continue;
  if (/(^|\/)(\.env(?:\..*)?|certs|node_modules|captures|recordings|logs)(\/|$)/.test(file) && !file.endsWith('.env.example')) failures.push([file, 'ficheiro privado/gerado']);
  if (/\.(pem|key|crt|cer|p12|pfx|log)$/i.test(file)) failures.push([file, 'certificado, chave ou log']);
  if (/\.(png|ico)$/i.test(file)) continue;
  if (statSync(path).size > 2 * 1024 * 1024) { failures.push([file, 'ficheiro grande exige revisão']); continue; }
  const text = readFileSync(path, 'utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(text)) failures.push([file, 'chave privada embutida']);
  if (/\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})\b/.test(text)) failures.push([file, 'possível credencial']);
  if (secrets.some(value => text.includes(value))) failures.push([file, 'token local presente']);
  if (privateHost && privateHost !== 'localhost' && text.includes(privateHost)) failures.push([file, 'endereço da configuração privada presente']);
  if (/(?:[A-Z]:[\\/]Users[\\/][^\s/\\]+|\/home\/[^\s/]+|\/mnt\/c\/Users\/[^\s/]+)/.test(text)) failures.push([file, 'caminho pessoal presente']);
}
if (failures.length) {
  console.error('REPROVADO — remova estes dados antes de publicar (valores não são mostrados):');
  failures.forEach(([file, reason]) => console.error(`- ${relative(root, resolve(root, file))}: ${reason}`));
  process.exitCode = 1;
} else console.log(`PASS: ${files.length} ficheiros publicáveis revistos; sem ficheiros privados, tokens locais, endereços locais configurados ou chaves detetados. Não substitui revisão humana de dados nem do histórico Git.`);
