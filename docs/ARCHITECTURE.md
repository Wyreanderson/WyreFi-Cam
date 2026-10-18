# Resumo técnico e funcionalidades

## O que foi construído

WyreFi Cam começou como WiFiCam Local: uma câmera iPhone/Safari que alimenta o OBS sem aplicação nativa de câmera. A identidade visual junta Wyre, Wi-Fi e câmera num símbolo W, com favicon, ícone Apple e nome para o atalho.

### Captura

- getUserMedia nativo, pré-visualização playsInline/autoplay/muted.
- Câmera frontal/traseira ou dispositivo enumerado; microfone opcional.
- Presets 720p30/60, 1080p30/60 e 4K30 experimental, com fallback progressivo.
- Vertical/horizontal com width, height e aspectRatio preferidos. Aviso quando o formato real difere. O telefone deve estar fisicamente na orientação pretendida.
- Resolução real via getSettings e vídeo; frames codificados e qualidade adaptativa via getStats quando disponíveis.
- Zoom, foco e lanterna condicionados a getCapabilities; falha opcional não termina a captura.

### Transporte

- RTCPeerConnection com ICE host-only (`iceServers: []`). Vídeo não passa pelo Node.
- Publisher cria offer; viewer answer; trickle ICE com identificador de sessão.
- Um publisher e um viewer. Duplicados são recusados. Viewer não controla a captura.
- Novos viewers, refresh, ligação WebSocket restabelecida e retry criam negociação nova. Sessões antigas não encaminham SDP/ICE.
- H.264 preferido com fallback, maxBitrate e maintain-resolution tentados sem depender de suporte universal do Safari.
- Heartbeat WebSocket, limite de payload/taxa, limpeza de peers/tracks/listeners/timers.

### Servidor e interface

- Node 24, TypeScript strict, Vite, ws, Vitest e QRCode local.
- HTTPS/WSS LAN em 8443; HTTP/WS apenas em 127.0.0.1:8765 para dashboard/OBS.
- Validação de Host, Origin, credenciais, papéis e mensagens. Tokens separados de 32 bytes gerados por instalação.
- Frontend compilado servido no mesmo processo; modo dev com Vite middleware.
- Dashboard com QR, URLs, estado dos papéis e diagnóstico local. Não precisa de permanecer aberto.
- Viewer preto sem navegação, contain/cover, áudio opcional/autoplay e reconexão.
- Escolha de orientação no dashboard segue no QR e indica as dimensões da fonte OBS. Não altera configurações do OBS remotamente.

### Preparação pública

- Setup interativo ou por argumentos, validação de IP/DNS, preservação de .env, atualização explícita de host, emissão de certificados com CA existente e rotação de tokens.
- Sem alterações administrativas automáticas; não instala CA nem abre firewall.
- .gitignore em toda a árvore, scanner de ficheiros publicáveis, diagnóstico resumido e documentação sem dados da instalação do autor.
- Licença MIT, CONTRIBUTING, SECURITY e CI para Node 24/Linux.

## Estrutura

```text
README.md                  Guia de primeira utilização
LICENSE / SECURITY.md      Licença e modelo de segurança
docs/                      Rede e descrição técnica
.github/workflows/         Verificação em CI
wificam-local/
  src/                     Captura, WebRTC, páginas e estilo
  server/                  HTTP(S), autenticação e sessões
  scripts/                 Setup, diagnóstico, privacidade e smoke
  tests/                   Casos automatizados
  public/                  Ícones originais e exportações
  .env.example             Referência sem credenciais
  .env / certs/            Privados, gerados localmente, ignorados
```

## Limites conhecidos

Não há gravação, múltiplos viewers, transcodificação, STUN/TURN público, telemetria externa, autenticação multiutilizador ou promessa de latência/resolução fixa. Fallbacks e adaptações de rede podem reduzir qualidade. Safari em segundo plano/bloqueio pode interromper as tracks e exigir iniciar novamente. WSL/VPN/CEF precisam de testes no ambiente real.

Próximas melhorias possíveis: ensaios entre browsers com mídia sintética, matriz de testes físicos Safari/OBS, diagnóstico ICE mais detalhado e escolha visual de interface. Estas melhorias não estão implementadas.
