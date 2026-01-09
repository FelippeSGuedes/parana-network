# Versionamento e rollback (simples)

## Versionamento
- O workflow gera `version` como:
  - tag `vX.Y.Z` quando o push é em tag, ou
  - `SHA` curto (12 chars) quando é push na `main`

Cada deploy cria:
- `/opt/parana-network/frontend/releases/<version>/`
- `/opt/parana-network/backend/releases/<version>/`

E aponta os symlinks:
- `/opt/parana-network/frontend/current`
- `/opt/parana-network/backend/current`

## Rollback manual (no servidor)

1) Liste releases:
- `ls -la /opt/parana-network/frontend/releases`
- `ls -la /opt/parana-network/backend/releases`

2) Aponte o `current` para a versão anterior (exemplo):
- `ln -sfn /opt/parana-network/frontend/releases/<versao_anterior> /opt/parana-network/frontend/current`
- `ln -sfn /opt/parana-network/backend/releases/<versao_anterior> /opt/parana-network/backend/current`

3) Reinicie só o backend e recarregue o nginx:
- `sudo systemctl restart parana-network-backend`
- `sudo nginx -t && sudo systemctl reload nginx`

## Retenção
- Recomendação: manter as últimas 10 releases e limpar o resto manualmente.
