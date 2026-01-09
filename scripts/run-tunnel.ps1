<#
Run-tunnel.ps1

Este script faz o seguinte:
- Verifica se o proxy local (porta 3001) está respondendo; se não, instala `http-proxy` e inicia `scripts/proxy-server.js` em background.
- Inicia `cloudflared` em modo quick-tunnel apontando para `http://localhost:3001`, grava logs em `cloudflared.log`.
- Exibe (tail -f) os logs para que você veja quando a URL pública for gerada.

Uso: execute na raiz do projeto com PowerShell:
  .\scripts\run-tunnel.ps1

OBS: requer `node` e `cloudflared` no PATH.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "Iniciando run-tunnel.ps1" -ForegroundColor Cyan

function Test-ProxyReady {
    try {
        $r = Invoke-WebRequest -Uri http://localhost:3001 -Method Head -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# 1) Garantir que o proxy esteja rodando
if (Test-ProxyReady) {
    Write-Host "Proxy já está respondendo em http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "Proxy não encontrado. Instalando dependências e iniciando proxy..." -ForegroundColor Yellow
    Push-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)
    Push-Location ..
    try {
        npm install http-proxy --no-audit --no-fund | Out-Null
    } catch {
        Write-Warning "Falha ao rodar npm install http-proxy (continue se já estiver instalado)."
    }
    Pop-Location

    # iniciar proxy em background como Job PowerShell; redireciona saída para proxy.log
    $existingProxyJob = Get-Job -Name ProxyJob -ErrorAction SilentlyContinue
    if ($existingProxyJob) {
        Write-Host "Job ProxyJob já existe, removendo..." -ForegroundColor Yellow
        $existingProxyJob | Remove-Job -Force -ErrorAction SilentlyContinue
    }

    Start-Job -Name ProxyJob -ScriptBlock {
        Set-Location (Join-Path $PSScriptRoot '..')
        # roda proxy e grava logs
        node .\scripts\proxy-server.js *>&1 | Out-File -FilePath .\proxy.log -Encoding utf8 -Append
    } | Out-Null

    Write-Host "Aguardando proxy inicializar..." -NoNewline
    $tries = 0
    while (-not (Test-ProxyReady) -and $tries -lt 30) {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        $tries++
    }
    Write-Host ""
    if (-not (Test-ProxyReady)) {
        Write-Warning "Proxy não respondeu após espera. Verifique .\proxy.log e processos node." 
    } else {
        Write-Host "Proxy pronto." -ForegroundColor Green
    }
}

# 2) Parar eventuais cloudflared antigos
Get-Process cloudflared -ErrorAction SilentlyContinue | ForEach-Object { 
    try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {} 
}

# 3) Iniciar cloudflared como Job para gravar logs
if (Test-Path .\cloudflared.log) { Remove-Item .\cloudflared.log -Force -ErrorAction SilentlyContinue }
if (Get-Job -Name CloudflaredJob -ErrorAction SilentlyContinue) { Get-Job -Name CloudflaredJob | Remove-Job -Force -ErrorAction SilentlyContinue }

Start-Job -Name CloudflaredJob -ScriptBlock {
    Set-Location (Join-Path $PSScriptRoot '..')
    # redireciona stdout/stderr para cloudflared.log
    cloudflared tunnel --url http://localhost:3001 --loglevel debug *>&1 | Out-File -FilePath .\cloudflared.log -Encoding utf8 -Append
} | Out-Null

Write-Host "cloudflared iniciado em background; aguardando URL pública nos logs..." -ForegroundColor Cyan

# 4) Exibir logs em tempo real
if (-not (Test-Path .\cloudflared.log)) { New-Item .\cloudflared.log -ItemType File | Out-Null }
Write-Host "Mostrando últimas 200 linhas do log. (Ctrl+C para sair)" -ForegroundColor Gray
Get-Content .\cloudflared.log -Tail 200 -Wait
