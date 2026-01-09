# Setup de Produção (Ubuntu) — sem código-fonte

Este setup segue:
- build 100% no GitHub Actions
- deploy só de artefatos finais (`build/` e binário Linux)
- servidor não contém git/repo/node_modules
- MySQL em Docker não é reiniciado pelo deploy

## 1) Preparar servidor

### 1.1 Pacotes
- Nginx
- systemd (padrão)

### 1.2 Usuário do backend
- `sudo useradd --system --no-create-home --shell /usr/sbin/nologin parana`

### 1.3 Diretórios runtime
- `sudo mkdir -p /opt/parana-network/{frontend/releases,backend/releases,shared}`
- `sudo chown -R <SEU_USUARIO_SSH>:<SEU_USUARIO_SSH> /opt/parana-network`

### 1.4 Variáveis de ambiente (segredos)
- `sudo mkdir -p /etc/parana-network`
- `sudo cp deploy/systemd/backend.env.example /etc/parana-network/backend.env`
- `sudo chmod 600 /etc/parana-network/backend.env`
- `sudo chown root:root /etc/parana-network/backend.env`

### 1.5 systemd
- `sudo cp deploy/systemd/parana-network-backend.service /etc/systemd/system/parana-network-backend.service`
- `sudo systemctl daemon-reload`
- `sudo systemctl enable parana-network-backend`

### 1.6 Nginx (frontend)
- `sudo cp deploy/nginx/parana-network.conf /etc/nginx/sites-available/parana-network`
- `sudo ln -s /etc/nginx/sites-available/parana-network /etc/nginx/sites-enabled/parana-network`
- `sudo nginx -t && sudo systemctl reload nginx`

## 2) Acesso do GitHub Actions (SSH)

Crie uma chave exclusiva para deploy e adicione a pública em:
- `~/.ssh/authorized_keys` do usuário SSH no servidor

No GitHub (Settings → Secrets and variables → Actions), crie:
- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY` (chave privada)
- `PROD_SSH_PORT` (opcional)
- `PROD_BASE_DIR` (opcional; default `/opt/parana-network`)

## 3) sudo sem senha (necessário para restart/reload)

O workflow precisa rodar alguns comandos com sudo.
Sugestão (ajuste paths/usuário):

Arquivo: `/etc/sudoers.d/parana-network-deploy`

```
<SEU_USUARIO_SSH> ALL=NOPASSWD: /bin/systemctl restart parana-network-backend
<SEU_USUARIO_SSH> ALL=NOPASSWD: /bin/systemctl daemon-reload
<SEU_USUARIO_SSH> ALL=NOPASSWD: /usr/sbin/nginx -t
<SEU_USUARIO_SSH> ALL=NOPASSWD: /bin/systemctl reload nginx
<SEU_USUARIO_SSH> ALL=NOPASSWD: /bin/mkdir -p /opt/parana-network
<SEU_USUARIO_SSH> ALL=NOPASSWD: /bin/chown -R <SEU_USUARIO_SSH>:<SEU_USUARIO_SSH> /opt/parana-network
```

## 4) MySQL em Docker

O deploy não toca em Docker/MySQL.
Garanta que o MySQL já está rodando com volume persistente e rede estável.
