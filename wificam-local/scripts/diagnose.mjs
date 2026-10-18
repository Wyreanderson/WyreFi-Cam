import { platform, release, networkInterfaces } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const details = process.argv.includes('--details');
console.log(`WyreFi Cam · diagnóstico\nOS: ${platform()} ${release()}\nNode: ${process.version}`);
if (Number(process.versions.node.split('.')[0]) !== 24) console.log('ATENÇÃO: use Node 24. No Ubuntu, Node/npm devem estar instalados dentro do Linux.');
const version = platform() === 'linux' && existsSync('/proc/version') ? readFileSync('/proc/version', 'utf8') : '';
const wsl = /microsoft/i.test(version + release());
if (wsl) {
  const mode = spawnSync('wslinfo', ['--networking-mode'], { encoding: 'utf8', timeout: 5000 });
  console.log(`WSL detetado. Rede: ${mode.status === 0 ? mode.stdout.trim() : 'não confirmada; use wslinfo --networking-mode'}`);
} else console.log(platform() === 'win32' ? 'Runtime Windows. Se o terminal for Ubuntu/WSL, selecione Node/npm Linux.' : 'Linux nativo ou outro ambiente sem indicação de WSL.');
const mkcert = spawnSync('mkcert', ['-version'], { encoding: 'utf8', timeout: 5000 });
console.log(`mkcert: ${mkcert.status === 0 ? mkcert.stdout.trim() : 'não encontrado no PATH'}`);
for (const [name, port] of [['dashboard', 8765], ['HTTPS', 8443]]) {
  const { createConnection } = await import('node:net');
  const reachable = await new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
  console.log(`${name} local :${port}: ${reachable ? 'TCP responde (não valida TLS/mídia)' : 'sem resposta em loopback'}`);
}
if (details) {
  console.log('\nDetalhes privados: reveja/remova dados pessoais antes de partilhar.');
  for (const [name, rows] of Object.entries(networkInterfaces())) console.log(`${name}: ${rows?.map(r => r.address).join(', ')}`);
  const commands = platform() === 'linux' ? [['ip', ['route']], ['ss', ['-lntup']]] : [['wsl.exe', ['--list', '--verbose']], ['ipconfig', []]];
  for (const [cmd, args] of commands) {
    const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 5000 });
    console.log(`\n$ ${cmd} ${args.join(' ')}\n${result.error?.message ?? result.stdout ?? ''}${result.stderr ?? ''}`);
  }
} else console.log('IPs, interfaces, caminhos de CA e tokens omitidos. Diagnóstico privado completo: npm run diagnose -- --details');
console.log('Nenhuma configuração foi alterada. Dashboard/HTTPS online não comprova ICE/UDP; TCP portproxy não é solução completa.');
