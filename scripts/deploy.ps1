param(
  [Parameter(Mandatory = $true)]
  [string]$Server,

  [string]$AppDir = "/opt/parana-network",

  # Ex: ghcr.io/ORG/parana-network:latest
  [string]$Image = "ghcr.io/FelippeSGuedes/parana-network:latest",

  # Plataforma do build (Ubuntu normalmente = linux/amd64)
  [string]$Platform = "linux/amd64",

  # Se quiser apenas publicar no servidor sem rebuild
  [switch]$SkipBuild,

  # Se quiser fazer deploy sem registry (docker save/scp/docker load)
  [switch]$NoRegistry,

  # Caminho remoto para colocar o tar quando NoRegistry
  [string]$RemoteTmp = "/tmp/parana-network-image.tar"
)

$ErrorActionPreference = "Stop"

function Exec([string]$Cmd) {
  Write-Host "> $Cmd" -ForegroundColor Cyan
  Invoke-Expression $Cmd
}

function Ssh([string]$Cmd) {
  $escaped = $Cmd.Replace('"', '\"')
  Exec ("ssh $Server \"$escaped\"")
}

function EnsureDocker() {
  Exec "docker version" | Out-Null
}

function EnsureSsh() {
  Exec "ssh -V" | Out-Null
}

EnsureDocker
EnsureSsh

if (-not $SkipBuild) {
  if ($NoRegistry) {
    # Build local e exporta em tar
    $localTar = Join-Path $PSScriptRoot "..\dist\parana-network-image.tar"
    $localTar = [System.IO.Path]::GetFullPath($localTar)

    if (-not (Test-Path (Split-Path $localTar))) {
      New-Item -ItemType Directory -Path (Split-Path $localTar) | Out-Null
    }

    Exec "docker buildx build --platform $Platform -t $Image --load ."
    Exec "docker save -o `"$localTar`" $Image"

    # Envia tar e faz load no servidor
    Exec "scp `"$localTar`" ${Server}:$RemoteTmp"
    Ssh "docker load -i $RemoteTmp; rm -f $RemoteTmp"
  }
  else {
    # Build e push no registry
    Exec "docker buildx build --platform $Platform -t $Image --push ."
  }
}

# Garante diretório no servidor e faz pull/up
Ssh "sudo mkdir -p $AppDir"
Ssh "cd $AppDir; if command -v docker >/dev/null 2>&1; then true; fi"

# Usa docker compose (v2) se existir, senão docker-compose
$remoteDeploy = @'
set -e
cd "{APPDIR}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERRO: docker compose não encontrado (instale Docker Compose v2 ou docker-compose)." >&2
  exit 1
fi

$COMPOSE pull
$COMPOSE up -d

docker image prune -f >/dev/null 2>&1 || true
'@

$remoteDeploy = $remoteDeploy.Replace("{APPDIR}", $AppDir)
Ssh $remoteDeploy

Write-Host "Deploy concluído." -ForegroundColor Green
Write-Host "Dica: confira logs com: ssh $Server \"cd $AppDir; docker compose logs -f --tail=200\"" -ForegroundColor DarkGray
