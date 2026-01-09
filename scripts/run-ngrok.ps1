# Script para adicionar authtoken e iniciar túnel ngrok
# USAR SOMENTE se você já instalou o ngrok e confia neste token.
# ATENÇÃO: este arquivo contém um authtoken. Não comite em repositórios públicos.

$token = '34pinxVlZgC3f1ZtLF6d4yo3rb4_5pzSrqxW5BzaHbe3223Qb'

Write-Host "Adicionando authtoken ao ngrok (local)..."
ngrok config add-authtoken $token

Write-Host "Iniciando túnel ngrok para http://localhost:3000 ..."
Write-Host "Abra um novo terminal para rodar 'npm start' no seu projeto, ou rode-o agora em outro terminal."

# Inicia o túnel (este comando vai rodar até você cancelar com Ctrl+C)
ngrok http 3000
