# Script para instalar dependências e rodar o proxy local (PowerShell)
# Execute da raiz do projeto

Write-Host "Instalando dependência http-proxy (se necessário)..." -ForegroundColor Cyan
npm install http-proxy --no-audit --no-fund | Out-Null

Write-Host "Iniciando proxy em http://localhost:3001 ( /Login -> :5000 )" -ForegroundColor Green
node .\scripts\proxy-server.js
