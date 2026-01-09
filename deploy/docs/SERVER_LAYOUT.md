# Estrutura no servidor (somente runtime)

Base: `/opt/parana-network`

```
/opt/parana-network/
  frontend/
    releases/
      <versao>/           # arquivos estáticos (build/), somente artefato final
    current -> releases/<versao>

  backend/
    releases/
      <versao>/
        parana-network    # binário Linux (artefato final)
    current -> releases/<versao>

  shared/
    # espaço para dados runtime se necessário (logs, cache etc.)
```

Regras atendidas:
- Sem `git`, sem repositório
- Sem `node_modules`
- Sem build no servidor
- Apenas `build/` (frontend) e binário (backend)

## Onde ficam os segredos

- `/etc/parana-network/backend.env` (referenciado pelo systemd)
- Permissões: `root:root`, `chmod 600`

## Usuário de execução

Crie um usuário sem shell para o backend:
- `sudo useradd --system --no-create-home --shell /usr/sbin/nologin parana`

