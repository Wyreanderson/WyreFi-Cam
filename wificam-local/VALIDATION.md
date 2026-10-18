# Validação

## Automatizado

O projeto inclui testes de autenticação/papéis, parser de mensagens, sessões, encaminhamento SDP/ICE, viewer tardio, refresh, limpeza, fallback de câmera, orientação e setup CLI em diretórios temporários.

```bash
npm run verify
npm run test:smoke
```

O smoke inicia o processo de produção, cria certificado temporário com OpenSSL e verifica HTTP/HTTPS, Host/Origin, isolamento do dashboard, tokens, publisher WSS/viewer WS, SDP/ICE textual, duplicados e refresh. Não instala confiança no sistema. Requer as portas 8443/8765 livres; pare o servidor normal antes de o executar.

Foram executados lint, TypeScript strict, testes e build em Linux/WSL2 com Node 24. Testes HTTP/HTTPS/WS/WSS também foram executados no desenvolvimento. A CI do GitHub está preparada; a execução remota só pode ser confirmada depois do push.

O SDP e os candidatos do smoke são dados de teste: não estabelecem mídia WebRTC. Os testes de captura verificam constraints e tratamento de erros, não câmeras reais. Uma resposta HTTPS local com CA explícita não comprova a confiança da CA no iPhone.

## Validar na sua instalação

| Verificação | Resultado esperado |
|---|---|
| Runtime | Node 24; em Ubuntu/WSL a plataforma é linux |
| Arranque | Dashboard loopback e HTTPS na origem configurada |
| TLS no Safari | Sem aviso; certificado para o endereço exato e CA pública confiável |
| Captura | Autorizar, iniciar/parar e conferir resolução efetiva |
| Orientação | Telefone e fonte OBS com a proporção escolhida |
| Mídia real | Vídeo/áudio num Chromium ou OBS, codec e par ICE selecionados |
| Recuperação | Viewer tardio, refresh, interrupção/religação de rede |
| iOS | Primeiro plano, bloqueio e recuperação após track terminar |
| Qualidade | Dimensões enviadas, FPS, perdas, aquecimento e latência visual |
| CEF/OBS | Autoplay/áudio e alternativa Captura de janela se necessário |

Não há certificação de compatibilidade nem teste automático físico de Safari/OBS. Registe os testes que executar sem incluir tokens, endereços privados, QR codes ou dados pessoais em relatórios públicos.
