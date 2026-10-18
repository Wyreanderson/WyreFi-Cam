# WyreFi Cam — aplicação

O guia principal está no **[README da raiz](../README.md)**, incluindo requisitos, mkcert, iPhone, OBS, privacidade e publicação.

Todos os comandos da aplicação são executados nesta pasta:

```bash
npm ci
npm run setup
npm run setup -- --cert
npm run build
npm run start
```

Requer Node 24 e mkcert/CA previamente configurados conforme o guia. O setup cria credenciais próprias e preserva `.env` existente. Nunca publique `.env`, `certs/`, QR codes ou logs privados.

- [Rede / WSL / Tailscale](../docs/NETWORK.md)
- [Arquitetura e funcionalidades](../docs/ARCHITECTURE.md)
- [Validação](VALIDATION.md)
- [Segurança](../SECURITY.md)
- [Identidade visual](public/icons/BRAND.md)
