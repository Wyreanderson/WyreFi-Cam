# Preparação da primeira publicação

## Entrega

- README principal com clonar, configurar, confiar na CA no iPhone e usar OBS.
- Guia separado de LAN, WSL2, Tailscale, diagnóstico e execução persistente.
- Resumo técnico do MVP, limitações e próximos passos.
- Licença MIT escolhida pelo autor; políticas SECURITY e CONTRIBUTING.
- Setup guiado/por argumentos, tokens próprios por instalação, validação de host, atualização explícita e rotação de tokens.
- Proteção Git na raiz e scanner dos ficheiros publicáveis, incluindo privados já adicionados ao índice.
- Diagnóstico padrão sem lista de endereços, interfaces, caminhos da CA ou tokens.
- CI preparada para Linux/Node 24, lint, testes, build, privacidade e integração.

## Validação desta preparação

- Cópia isolada do pacote sem .env, certs, node_modules ou histórico Git original.
- Instalação por npm ci a partir do lockfile.
- **21 testes** passaram, incluindo setup num diretório novo e scanner que recusa tokens/copias forçadas de certificados.
- TypeScript strict e build passaram.
- Lint passou; dependências do linter atualizadas para ESLint 10.
- Auditoria da instalação: zero vulnerabilidades reportadas no momento da preparação; não é uma garantia futura.
- Setup real com --host localhost --cert passou usando CA existente, sem instalar confiança.
- Integração HTTP/HTTPS/WS/WSS passou no pacote isolado, sem transmitir mídia real.
- Ficheiros públicos passaram no scanner. As imagens PNG não continham metadados na inspeção.

A execução do workflow no GitHub ainda depende de publicar o repositório. Ensaios físicos de Safari/OBS e conectividade de cada instalação continuam a ser necessários.

## O que fica privado

A instalação de desenvolvimento conserva o seu .env, tokens e certificados localmente. Esses ficheiros, dependências, builds, diretório de validação e ZIP de entrega são ignorados pelo Git. O pacote público não os contém. O repositório não tinha commits/ficheiros rastreados no início desta preparação; não foi encontrado histórico anterior para limpar.

O scanner não substitui revisão humana, não garante descobrir todos os tipos de segredo e não lê todo o histórico Git. Não adicione capturas de ecrã com QR/URLs nem relatórios privados depois desta verificação. Cada utilizador deve gerar os seus próprios dados.

## Publicar

Use a árvore do projeto preparada ou extraia o ZIP de entrega numa pasta nova. Não copie .env ou certs da instalação antiga. O ZIP tem o README na raiz e a aplicação em wificam-local/.

Siga a secção de publicação do README: verificação de privacidade, revisão do índice, commit, criação do repositório no GitHub, remote e push. Nenhum repositório remoto foi criado ou enviado automaticamente nesta preparação.
