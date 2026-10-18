import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { validateHost, makeOrigin, newConfig, updateConfig, parseArgs } from '../scripts/lib/config.mjs';

it('recusa IPs incompletos, URLs, portas e argumentos de shell', () => {
  for (const host of ['', '192.168.1.', '999.0.0.1', 'https://camera.local', 'camera.local:8443', '-bad.local', 'a;echo bad', 'x/y']) {
    expect(() => validateHost(host)).toThrow();
  }
  expect(validateHost('192.168.1.50')).toBe('192.168.1.50');
  expect(makeOrigin(validateHost('::1'))).toBe('https://[::1]:8443');
});

it('gera credenciais independentes para cada instalação', () => {
  const first = parseEnv(newConfig('camera.local'));
  const second = parseEnv(newConfig('camera.local'));
  expect(first.PUBLISH_TOKEN).toMatch(/^[a-f0-9]{64}$/);
  expect(first.VIEW_TOKEN).not.toBe(first.PUBLISH_TOKEN);
  expect(second.PUBLISH_TOKEN).not.toBe(first.PUBLISH_TOKEN);
});

it('altera apenas o host mantendo tokens e comentários', () => {
  const original = '# custom\n' + newConfig('camera.local');
  const changed = parseEnv(updateConfig(original, { LAN_ORIGIN: makeOrigin('192.168.1.50') }));
  expect(changed.PUBLISH_TOKEN).toBe(parseEnv(original).PUBLISH_TOKEN);
  expect(changed.LAN_ORIGIN).toBe('https://192.168.1.50:8443');
  expect(updateConfig(original, { LAN_ORIGIN: 'x' })).toContain('# custom');
});

it('exige flags explícitas para operações e rejeita argumentos desconhecidos', () => {
  expect(parseArgs(['--host', 'camera.local', '--cert', '--update-host'])).toMatchObject({ cert: true, updateHost: true, host: 'camera.local' });
  expect(() => parseArgs(['--host'])).toThrow();
  expect(() => parseArgs(['--force'])).toThrow();
});

it('CLI num diretório novo: configura, preserva, atualiza e revoga sem mostrar tokens', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wyrefi-setup-test-'));
  const script = fileURLToPath(new URL('../scripts/setup.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 10000 });
  try {
    expect(run(['--host', 'camera.local']).status).toBe(0);
    const original = readFileSync(join(cwd, '.env'), 'utf8');
    const token = parseEnv(original).PUBLISH_TOKEN;
    const preserved = run([]);
    expect(preserved.status).toBe(0);
    expect(preserved.stdout).not.toContain(token);
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe(original);
    expect(run(['--host', 'new.local']).status).toBe(1);
    expect(run(['--host', 'new.local', '--update-host']).status).toBe(0);
    expect(parseEnv(readFileSync(join(cwd, '.env'), 'utf8')).PUBLISH_TOKEN).toBe(token);
    expect(run(['--rotate-tokens']).status).toBe(0);
    expect(parseEnv(readFileSync(join(cwd, '.env'), 'utf8')).PUBLISH_TOKEN).not.toBe(token);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
