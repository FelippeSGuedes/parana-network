# Deploy Windows -> Ubuntu (um comando)

Este projeto já possui [Dockerfile](Dockerfile) que:
- Compila o frontend (CRA)
- Empacota o backend em binário via `pkg` (não envia o fonte do backend dentro da imagem)

> Observação: como é web, o frontend (JS) sempre é entregue ao navegador.

## 1) Pré-requisitos no Ubuntu (uma vez)

### 1.1 Instalar Docker + Compose
Instale Docker Engine + Docker Compose v2 (via docs oficiais). Após instalar:
- `docker --version`
- `docker compose version`

### 1.2 Criar pasta do app
Sugestão:
- `/opt/parana-network`

Coloque ali:
- [docker-compose.yml](docker-compose.yml)
- `.env` (segredos e configurações)

Exemplo de `.env` (ajuste para seu ambiente):
- `PORT=4000`
- `DB_HOST=...`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `DB_NAME=glpi`
- `ZABBIX_URL=...`
- `ZABBIX_USER=...`
- `ZABBIX_PASSWORD=...`

> Dica: mantenha o `.env` só no servidor (não versionar).

### 1.3 (Opcional) Reverse proxy HTTPS
Em produção, recomendo Nginx/Caddy expondo 443 e proxy para `localhost:4000`.

## 2) Pré-requisitos no Windows (uma vez)

- Docker Desktop com Linux containers (WSL2)
- Acesso SSH ao Ubuntu (chave SSH recomendada)
- Se usar GHCR: `docker login ghcr.io`

## 3) Deploy com 1 comando (dia a dia)

Na raiz do projeto, execute (PowerShell):

- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Server usuario@SEU_IP -AppDir /opt/parana-network -Image ghcr.io/FelippeSGuedes/parana-network:latest`

O script faz:
1) `docker buildx build --platform linux/amd64 ... --push` (gera e publica a imagem)
2) via SSH no Ubuntu: `docker compose pull` e `docker compose up -d`

### Sem registry (sem GHCR)
Se você não quer/ não pode usar registry:

- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy.ps1 -Server usuario@SEU_IP -AppDir /opt/parana-network -Image parana-network:latest -NoRegistry`

Isso faz `docker save` + `scp` + `docker load` no servidor.

## 4) Migrar banco (Docker)

### 4.1 Dump (recomendado)
No servidor antigo (ou onde roda o MySQL):
- `docker exec <container_db> mysqldump -u <user> -p<senha> --databases <db> --single-transaction --routines --triggers > dump.sql`

Copie `dump.sql` para o Ubuntu novo e restaure:
- `docker exec -i <container_db_novo> mysql -u <user> -p<senha> < dump.sql`

### 4.2 Volume (clonagem)
Só use se versões forem compatíveis e você conseguir parar o MySQL antes.

## 5) Operação

- Logs: `ssh usuario@SEU_IP "cd /opt/parana-network; docker compose logs -f --tail=200"`
- Restart: `ssh usuario@SEU_IP "cd /opt/parana-network; docker compose restart"`
- Status: `ssh usuario@SEU_IP "cd /opt/parana-network; docker compose ps"`
