import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

it('verifica ficheiros publicáveis e bloqueia tokens locais e certificados forçados ao índice', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wyrefi-privacy-test-'));
  const script = fileURLToPath(new URL('../scripts/privacy-check.mjs', import.meta.url));
  const git = args => spawnSync('git', args, { cwd, encoding: 'utf8' });
  const scan = () => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 10000 });
  try {
    expect(git(['init', '--quiet']).status).toBe(0);
    mkdirSync(join(cwd, 'wificam-local/certs'), { recursive: true });
    writeFileSync(join(cwd, '.gitignore'), '.env\ncerts/\n');
    const token = randomBytes(32).toString('hex');
    writeFileSync(join(cwd, 'wificam-local/.env'), `PUBLISH_TOKEN=${token}\nLAN_ORIGIN=https://fixture.local:8443\n`);
    writeFileSync(join(cwd, 'README.md'), '# Public documentation\n');
    expect(scan().status).toBe(0);
    writeFileSync(join(cwd, 'README.md'), `Leaked credential: ${token}`);
    const rejected = scan();
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).not.toContain(token);
    writeFileSync(join(cwd, 'README.md'), '# Public documentation\n');
    writeFileSync(join(cwd, 'wificam-local/certs/test.pem'), 'fixture certificate');
    expect(git(['add', '-f', 'wificam-local/certs/test.pem']).status).toBe(0);
    expect(scan().status).toBe(1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
