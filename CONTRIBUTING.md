# Contribuir

1. Faça fork/clone e entre em `wificam-local/`.
2. Use Node 24 (`nvm use` quando disponível), `npm ci` e `npm run verify`.
3. O smoke test `npm run test:smoke` exige OpenSSL e portas 8443/8765 livres; não precisa de iPhone, mkcert ou dados pessoais.
4. Para testar manualmente, siga o README e gere a sua própria configuração. Nunca use credenciais de outra pessoa.
5. Envie um pull request com o problema, alteração e validação realizada. Não afirme testes de Safari/OBS que não executou.

Não inclua `.env`, certificados, screenshots com QR/tokens, logs de interfaces, endereços da tailnet ou gravações de câmera. O comando `npm run privacy` verifica os ficheiros publicáveis no Git, incluindo ficheiros já adicionados ao índice. Diagnósticos devem ser sanitizados antes de entrar em issues.

O código, documentação e assets originais deste projeto usam a licença MIT. Dependências continuam sujeitas às respetivas licenças.
