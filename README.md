# WyreFi Cam

<img src="wificam-local/public/icons/icon-192.png" alt="WyreFi Cam" width="96">

**Transforma o iPhone numa webcam Wi-Fi para OBS, através do Safari.**

Aplicação gratuita, self-hosted e de código aberto: um servidor Node no computador, uma página no iPhone e uma Fonte de navegador no OBS. Vídeo/áudio via WebRTC entre os browsers, sem transcodificação ou gravação no servidor.

- Câmera frontal/traseira e microfone opcional.
- Horizontal **16:9** ou vertical **9:16**, com instruções para o OBS.
- Presets de 720p a 4K experimental; resolução real e estatísticas quando disponíveis.
- QR code local, tokens separados, reconexão e um único recetor ativo.
- Favicon e atalho iPhone com identidade **WyreFi Cam**.
- Sem conta da aplicação, base de dados, serviços pagos, analytics ou STUN/TURN públicos.

**Estado:** MVP. Testes de código e integração não garantem compatibilidade com todas as versões do Safari/OBS. A câmera pode interromper ao bloquear o iPhone ou colocar o Safari em segundo plano.

## Começar: clonar → configurar → usar

### 1. Requisitos

- **Node.js 24** e npm no sistema em que o servidor vai correr. Pode usar `nvm install 24` / `nvm use 24` se já tem [nvm](https://github.com/nvm-sh/nvm).
- [mkcert](https://github.com/FiloSottile/mkcert) para HTTPS de confiança nos seus dispositivos.
- iPhone com Safari e computador com OBS ou Chrome/Chromium, inicialmente na mesma rede local.
- No Ubuntu/WSL, `node -p "process.platform"` deve devolver **linux**. Não use o npm do Windows dentro do terminal Ubuntu.

Ubuntu/Debian: instale mkcert e o suporte de certificados conforme a distribuição:

```bash
sudo apt update
sudo apt install mkcert libnss3-tools
mkcert -install
```

`mkcert -install` é uma decisão manual: instala a CA local na confiança do computador. O projeto nunca o executa automaticamente. No Windows/macOS, siga a instalação oficial do mkcert. Não é necessário instalar uma aplicação de câmera no iPhone.

### 2. Clonar e instalar

Substitua `URL_DO_REPOSITORIO` pelo endereço do seu clone/fork no GitHub:

```bash
git clone URL_DO_REPOSITORIO wyrefi-cam
cd wyrefi-cam/wificam-local
npm ci
```

Todo o código da aplicação está em `wificam-local/`. Não há dependências globais do projeto.

### 3. Configurar e criar o certificado

```bash
npm run setup
```

O assistente lista os endereços das interfaces e pede o **IP que o iPhone consegue alcançar**. Escolha o IP LAN do computador onde o servidor corre, não o IP de uma VPN ou interface virtual por engano. Depois:

```bash
npm run setup -- --cert
```

Alternativa num único comando, substituindo o IP do exemplo pelo seu:

```bash
npm run setup -- --host 192.168.1.50 --cert
```

O setup gera `.env`, dois tokens aleatórios e certificados em `certs/`. Não altera firewall, router ou configurações globais. Preserva uma configuração existente. Nenhum segredo vem no repositório; cada clone cria os seus próprios.

### 4. Confiar na CA no iPhone — uma vez por CA

```bash
mkcert -CAROOT
```

Do diretório indicado, transfira **apenas `rootCA.pem` público** para o seu iPhone, por um método de confiança. Se necessário, renomeie a cópia para `rootCA.crt`.

1. Abra o certificado no iPhone e instale o perfil em **Definições → Geral → VPN e gestão de dispositivos**.
2. Em **Geral → Informações → Definições de confiança de certificados**, ative confiança total para a CA.
3. Confirme que o Safari abre o HTTPS sem aviso de certificado.

Os nomes dos menus variam com o iOS. **Nunca transfira nem publique `rootCA-key.pem`**. Essa é a chave privada da CA, não o certificado público. Não existe endpoint web para descarregar certificados neste projeto.

### 5. Arrancar e ligar ao OBS

```bash
npm run build
npm run start
```

Mantenha esse terminal aberto. Abra **[http://127.0.0.1:8765](http://127.0.0.1:8765)** no computador do OBS:

1. Escolha horizontal/vertical e leia o QR com o iPhone; abra no Safari.
2. Posicione o iPhone no formato escolhido e toque em **Iniciar transmissão**.
3. No OBS adicione **Fonte de navegador** e cole a URL completa mostrada no dashboard.
4. Nas propriedades da fonte, defina as dimensões:

| Formato | Largura OBS | Altura OBS |
|---|---:|---:|
| Horizontal 16:9 | 1920 | 1080 |
| Vertical 9:16 | 1080 | 1920 |

O formato da URL não muda as propriedades do OBS automaticamente. Reponha transformações/recortes antigos e ajuste a fonte à cena. Para preencher toda a cena sem barras, a cena também deve ter a proporção desejada. `Conter` preserva a imagem inteira; `Preencher` recorta. Ampliar um recorte não recupera detalhe.

O dashboard pode ser fechado depois. Ao voltar a usar: `npm run start`, sem reinstalar nem regenerar certificados.

## Comandos úteis

Execute dentro de `wificam-local/`:

| Comando | Função |
|---|---|
| `npm ci` | Instala as versões do lockfile; não partilhe node_modules entre Windows e Linux |
| `npm run setup` | Assistente de primeira configuração |
| `npm run setup -- --help` | Todas as opções do setup |
| `npm run build` | Typecheck e compilação de cliente/servidor |
| `npm run start` | Produção, frontend e signaling num processo |
| `npm run dev` | Desenvolvimento com Vite integrado; exige configuração/certificados |
| `npm run diagnose` | Diagnóstico resumido, sem listar IPs/tokens |
| `npm run diagnose -- --details` | Diagnóstico privado com dados de rede: sanitizar antes de partilhar |
| `npm run verify` | Lint, testes, build e verificação de privacidade |
| `npm run test:smoke` | Integração HTTP/HTTPS/WS/WSS; requer OpenSSL e portas 8443/8765 livres |

Alterar o endereço sem perder tokens:

```bash
npm run setup -- --host 192.168.1.60 --update-host --cert
```

Revogar URLs antigas:

```bash
npm run setup -- --rotate-tokens
```

Após alterações: reinicie o servidor e copie o QR/URLs novos. O atalho antigo do iPhone pode precisar de ser recriado.

## WSL2, Tailscale e rede

Para um primeiro teste simples, use Linux nativo com OBS no mesmo computador, ou Node no Windows com OBS no Windows. WSL2 acrescenta uma fronteira de rede; não assuma que alcançar o dashboard prova acesso do iPhone.

- **WSL2:** confirme `wslinfo --networking-mode`. Em versões compatíveis de Windows/WSL, mirrored networking pode permitir o acesso LAN. NAT/UDP, localhost forwarding, Windows/Hyper-V firewall e VPN precisam de validação. Não se configura automaticamente.
- **Tailscale, opcional:** ligue ambos os dispositivos à sua tailnet e configure o **IP Tailscale do sistema que executa Node** com `--host ... --update-host --cert`. Não confunda o IP do Windows com o do Ubuntu. A CA continua a precisar de confiança no iPhone.
- Tailscale usa infraestrutura externa própria e pode encaminhar tráfego por relays. Não é necessário para uso LAN, não é instalado pela aplicação e não representa garantia de vídeo exclusivamente local. Não use Funnel para publicar a câmera.
- WebRTC usa ICE host-only, sem STUN/TURN de reserva. HTTPS online não garante mídia. TCP portproxy não resolve, por si só, ICE/UDP.

Procedimentos completos: **[Rede, WSL e Tailscale](docs/NETWORK.md)**.

## Problemas frequentes

| Sintoma | Verificação |
|---|---|
| Dashboard não abre | `npm run start` precisa de estar ativo; confira erros no terminal e porta 8765 |
| Safari não abre HTTPS | IP/origem, mesma rede/tailnet, certificado SAN correto, CA confiável e firewall |
| Permissão de câmera indisponível | HTTPS sem avisos, permissões do Safari e câmera livre |
| Signaling liga mas não há vídeo | ICE/UDP, isolamento Wi-Fi, VPN/mDNS e compatibilidade CEF |
| Imagem com barras ou sem detalhe | Orientação física, dimensões da fonte OBS, resolução **Enviado**, rede e bitrate |
| Papel ocupado (4009) | Feche outro viewer/publisher; só há um de cada. Aguarde limpeza e recarregue |
| OBS sem reprodução | Teste o viewer sozinho no Chromium; use Captura de janela como alternativa |
| `mkcert` não encontrado | Instale-o no mesmo sistema/PATH em que executa o setup |
| Node errado no Ubuntu | `node -v`, `command -v npm` e `node -p "process.platform"`; use Node 24 Linux |

## Qualidade, áudio e iPhone

O padrão é 1080p30. Há 720p30/60, 1080p30/60 e 4K30 experimental. São **preferências sujeitas ao dispositivo**, não garantias. Existe fallback progressivo para modos suportados. A página mostra dimensões efetivas e, quando expostos, FPS, bitrate, perda, RTT e limitação de qualidade. RTT não mede latência ponta a ponta.

H.264 é preferido quando disponível, com outros codecs mantidos na negociação. Bitrate/preservação de resolução são tentativas compatíveis com fallback. Não há transcodificação, ampliação artificial de pixels ou promessa de 4K/60 FPS.

Microfone é opcional. No OBS, configure áudio da fonte quando disponível; autoplay com áudio pode exigir **Interagir** e tocar no botão de reprodução. Espelhamento na câmera altera só a pré-visualização; espelhe a fonte no OBS se desejar a saída invertida. Zoom/foco/lanterna só aparecem quando suportados.

Para guardar o ícone: no Safari, abra a câmera pelo QR → **Partilhar → Adicionar ao ecrã principal**. O nome é WyreFi Cam. O atalho continua a precisar do servidor, da rede e das permissões. Não há modo offline.

## Arquitetura e resumo do que está implementado

```text
iPhone /camera ── HTTPS/WSS :8443 ──> Node: autenticação + SDP/ICE
OBS /viewer ── HTTP/WS 127.0.0.1:8765 ──> Node
iPhone <══════════ WebRTC vídeo/áudio direto ══════════> OBS/Chromium
Dashboard /: apenas loopback
```

TypeScript strict, Vite, ws, WebRTC nativo, HTML/CSS e Vitest. Um publisher e um viewer; cada negociação tem sessão própria, trickle ICE e limpeza após desconexão. Há recuperação de viewer tardio, refresh do OBS e falhas transitórias. A captura não depende de manter o dashboard aberto.

Veja **[Resumo técnico](docs/ARCHITECTURE.md)** e **[Validação](wificam-local/VALIDATION.md)**. Não há testes automatizados reais de iPhone/CEF nesta entrega; valide esses dispositivos antes de uso importante.

## Publicar este repositório com segurança

O código é público; **a sua instalação e os seus dados de rede não são**. `.env`, certificados/chaves, logs, capturas e dependências são ignorados no Git. Não publique screenshots com QR/URLs completos.

Antes do primeiro push, na raiz do clone:

```bash
npm --prefix wificam-local run privacy
git status --short
git add .
npm --prefix wificam-local run privacy
git diff --cached --stat
# Reveja também o conteúdo de git diff --cached antes de confirmar o commit.
git commit -m "Initial release: WyreFi Cam"
```

Crie o repositório no GitHub, associe o remote e faça push quando a revisão estiver concluída. O projeto não publica nada automaticamente. **Não force adição de ficheiros ignorados com `git add -f`.** O scanner ajuda, mas não audita todo o histórico nem dados pessoais em imagens. Se já publicou uma credencial, revogue-a; só removê-la do próximo commit não basta.

Inclui workflow GitHub Actions para lint, testes, build, privacidade e smoke test. O workflow só será validado pelo GitHub depois do push.

[Preparação da publicação](docs/RELEASE.md) · [Política de segurança](SECURITY.md) · [Como contribuir](CONTRIBUTING.md) · [Licença MIT](LICENSE)
