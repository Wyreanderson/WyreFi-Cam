# Segurança e privacidade

WyreFi Cam destina-se a uso pessoal numa rede local ou tailnet privada. Não publique o servidor na Internet, não use Tailscale Funnel e não abra portas no router. Não existe serviço de autenticação multiutilizador, isolamento contra utilizadores locais, auditoria externa ou garantia para ambientes hostis.

## Credenciais e certificados

- Cada instalação gera tokens diferentes para publisher e viewer. As URLs/QR são credenciais.
- `.env`, `certs/` e extensões de certificados/chaves são ignorados pelo Git em toda a árvore.
- A câmera mantém o token no fragmento para funcionar como atalho iOS; o viewer guarda-o em sessionStorage após abrir. O fragmento não é enviado no pedido HTTP da página, mas o token é necessário no handshake WebSocket. Evite logs de proxies/handshakes.
- Os tokens têm a duração da configuração: `npm run setup -- --rotate-tokens`, reiniciar servidor e copiar URLs novas revoga as URLs antigas.
- Não distribua a chave da CA (`rootCA-key.pem`) nem a chave TLS do servidor. Só a CA **pública** deve ser transferida para os seus próprios dispositivos de confiança.
- O dashboard só escuta em `127.0.0.1:8765`; contém tokens e dados das interfaces. Outros processos/utilizadores locais podem aceder-lhe.

## Fluxo de dados

O servidor Node encaminha SDP e ICE autenticados, não frames de vídeo. A aplicação não implementa gravação, analytics, telemetria enviada para terceiros, base de dados ou chamadas a STUN/TURN públicos. Os recursos de interface são locais. Os browsers podem ajustar codecs, resolução e bitrate para manter a ligação.

Tailscale é opcional e usa a infraestrutura da própria Tailscale; ligações podem usar relay DERP. Logo, usar Tailscale não equivale a garantir transporte exclusivamente LAN. O projeto não instala nem configura esse serviço. Acesso HTTPS não comprova que ICE/UDP e mídia funcionem entre peers.

## Antes de publicar

Execute `npm run privacy` dentro de `wificam-local/`, reveja `git status --short`, `git diff --cached` e o histórico. O scanner é uma defesa adicional, não uma prova de ausência de dados pessoais. Verifica ficheiros que o Git publicaria, incluindo ficheiros privados já rastreados; não percorre todos os commits antigos nem identifica todo o tipo de dados pessoais em imagens.

Se um segredo já tiver sido publicado, removê-lo do próximo commit não o apaga do histórico. Revogue-o primeiro e trate a limpeza do histórico antes de republicar. Um `.gitignore` não remove ficheiros já rastreados.

## Reportar problemas

Para problemas sem informação sensível, abra uma issue com versões e passos mínimos. Para vulnerabilidades, use o canal privado de segurança do GitHub se estiver habilitado. Não publique tokens, certificados privados ou dados de rede numa issue pública; peça primeiro um canal privado ao mantenedor.
