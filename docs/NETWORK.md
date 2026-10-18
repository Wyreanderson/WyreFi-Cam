# Rede, WSL2 e Tailscale

## As três ligações a verificar

1. Dashboard local: `http://127.0.0.1:8765`, só no computador recetor.
2. Câmera/signaling: HTTPS/WSS na origem configurada, normalmente porta 8443.
3. Mídia: WebRTC direto entre Safari e browser recetor, com ICE host candidates e UDP dinâmico. Node não recebe os frames.

O êxito de uma etapa não comprova a seguinte. Não há STUN/TURN público, relay de mídia na aplicação nem port forwarding automático.

## Linux nativo / Windows nativo

Execute Node no mesmo computador do OBS. Configure o IP LAN alcançável pelo iPhone, por exemplo:

```bash
npm run setup -- --host 192.168.1.50 --cert
```

As portas 8443 e 8765 devem estar livres. `LAN_BIND=0.0.0.0` permite receber nas interfaces IPv4; pode restringir ao IP da interface desejada. Não abra portas na Internet. Wi-Fi de convidados, isolamento entre clientes e VPNs podem bloquear ligações diretas.

No Windows, instale Node 24 e mkcert para Windows; use PowerShell. No Ubuntu, use Node e mkcert Linux. `npm ci` recria as dependências adequadas ao sistema atual; não alterne o mesmo node_modules entre Windows e Linux.

## WSL2

No PowerShell:

```powershell
wsl --version
wsl --list --verbose
Get-Content "$env:USERPROFILE\.wslconfig" -ErrorAction SilentlyContinue
```

No Ubuntu:

```bash
node -v
command -v npm
node -p "process.platform"
wslinfo --networking-mode
ip -brief address
ip route
```

Node deve ser 24, plataforma `linux`, e npm deve ser Linux, não um executável em `/mnt/c/Program Files/`. Se usa nvm: `nvm install 24`, `nvm use 24`. Instalar simplesmente `apt install nodejs` pode trazer uma versão antiga para este projeto.

Em WSL2 NAT, um IP virtual pode não estar acessível no iPhone. Encaminhar TCP não demonstra ICE/UDP funcional. As versões compatíveis de Windows 11/WSL suportam [mirrored networking](https://learn.microsoft.com/windows/wsl/networking#mirrored-mode-networking).

**Alteração manual e opcional:** abra `.wslconfig` do utilizador no Windows e acrescente/preserve a secção:

```ini
[wsl2]
networkingMode=mirrored
```

Não substitua outras configurações existentes. Guarde trabalho em todas as distribuições: `wsl --shutdown` encerra os seus processos. Reinicie o Ubuntu e confirme `wslinfo --networking-mode`. A aplicação não executa nenhum destes passos automaticamente.

Valide depois dashboard no Windows, HTTPS no iPhone e mídia real. Windows/Hyper-V firewall e VPNs podem exigir análise adicional. Não desative firewall globalmente; use regras restritas adequadas à sua instalação, decididas manualmente. O HTTP do OBS permanece limitado ao loopback.

## Tailscale (opcional)

1. Instale/configure Tailscale por sua conta; ambos os dispositivos devem estar na mesma tailnet e autorizados pelas políticas.
2. No sistema **que executa Node**, veja `tailscale ip -4` e `tailscale status`.
3. Confirme que o iPhone está online na aplicação Tailscale.
4. Use o IP Tailscale do servidor, não o de outro nó, no setup:

```bash
npm run setup -- --host IP_TAILSCALE_DO_SERVIDOR --update-host --cert
```

5. Reinicie servidor, atualize dashboard e use o novo QR. A confiança da CA no iPhone continua necessária.
6. Verifique os peers de mídia: OBS/Chrome no Windows e Node no Ubuntu são processos em sistemas diferentes. HTTPS entre iPhone/Ubuntu não comprova ICE entre iPhone/Windows.

Tailscale usa a sua própria infraestrutura de coordenação e pode transportar tráfego cifrado por relay DERP quando não há caminho direto. Isso pode aumentar latência e já não é uma solução exclusivamente LAN. Veja [conectividade Tailscale](https://tailscale.com/docs/reference/device-connectivity). Não use Funnel, links públicos ou port forwarding para esta aplicação.

## Diagnóstico

```bash
npm run diagnose
# Dados privados; reveja antes de copiar para issues:
npm run diagnose -- --details
```

- **Ligação recusada:** confirme servidor ativo e endereço/porta.
- **Timeout:** confirme rota, tailnet online, políticas, firewall e isolamento do Wi-Fi.
- **Aviso TLS:** certificado deve incluir o endereço exato de LAN_ORIGIN; CA pública confiável no dispositivo. Não ignore o aviso para capturar câmera.
- **Signaling sem vídeo:** investigue ICE, mDNS, codecs e autoplay em `chrome://webrtc-internals` no Chromium. Para OBS, testar uma versão recente e a alternativa Captura de janela.
- **Baixa qualidade:** confira a resolução `Enviado`, perda e limitações de rede/CPU. Reduza FPS/bitrate/resolução e teste no mesmo AP. RTT não é a latência total; compare um cronómetro filmado com o vídeo recebido.

Não publique IPs da sua tailnet, nomes de dispositivos, caminhos pessoais, QR codes ou URLs autenticadas. O diagnóstico é executado localmente e não envia relatórios automaticamente.

## Execução persistente

O terminal de `npm run start` precisa de permanecer ativo. No Linux pode usar tmux:

```bash
tmux new -s wyrefi
cd /caminho/do/clone/wificam-local
npm run start
# Ctrl+B, D para desanexar; tmux attach -t wyrefi para voltar
```

Opcionalmente crie um serviço systemd **de utilizador**, ajustando os caminhos reais de Node (inclusive nvm) e da aplicação:

```ini
[Unit]
Description=WyreFi Cam
After=network.target
[Service]
WorkingDirectory=/caminho/do/clone/wificam-local
ExecStart=/caminho/absoluto/node /caminho/do/clone/wificam-local/build/server/index.js
Restart=on-failure
RestartSec=3
UMask=0077
[Install]
WantedBy=default.target
```

Coloque em `~/.config/systemd/user/wyrefi.service`; execute manualmente `systemctl --user daemon-reload` e `systemctl --user enable --now wyrefi`. Logs: `journalctl --user -u wyrefi -f`. Persistência depois de logout depende do sistema; não há alteração automática de linger.
