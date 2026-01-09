# Configurar ngrok (Windows)

Este arquivo descreve como instalar o ngrok no Windows, adicionar o authtoken e iniciar um túnel para compartilhar o projeto localmente.

ATENÇÃO: o authtoken é uma credencial privada da sua conta ngrok. Não comite esse token em repositórios públicos.

1) Baixar ngrok
- Vá para https://ngrok.com/download e baixe a versão para Windows.
- Descompacte o executável (`ngrok.exe`) em um diretório, por exemplo `C:\tools\ngrok`.
- (Opcional) Adicione esse diretório ao PATH do Windows para usar `ngrok` de qualquer lugar.

2) Verificar instalação
Abra o PowerShell e rode:

```powershell
ngrok version
```

Você deve ver a versão instalada. Se der erro, verifique se `ngrok.exe` está no PATH ou execute-o pelo caminho completo.

3) Adicionar o authtoken (faça uma única vez)

Substitua `<SEU_TOKEN_AQUI>` pelo token que você tem. Exemplo (rodar no PowerShell):

```powershell
# Para ngrok v3 (comando recomendado atualmente):
ngrok config add-authtoken 34pinxVlZgC3f1ZtLF6d4yo3rb4_5pzSrqxW5BzaHbe3223Qb

# Em versões antigas (v2) o comando pode ser:
# ngrok authtoken 34pinxVlZgC3f1ZtLF6d4yo3rb4_5pzSrqxW5BzaHbe3223Qb
```

4) Iniciar túnel para o projeto (porta 3000 — ajuste se necessário)

No diretório do projeto (onde `npm start` roda), abra um PowerShell e se o seu app estiver em execução em `http://localhost:3000` rode:

```powershell
ngrok http 3000
```

Isso irá mostrar na saída do terminal o(s) URL(s) públicos (HTTP e HTTPS) que você pode compartilhar. Mantenha esse terminal aberto enquanto quiser que o túnel permaneça ativo.

5) Segurança e boas práticas
- Não publique seu authtoken em repositórios públicos.
- Se precisar, revogue o token via dashboard do ngrok e gere outro.
- Use regras de firewall / autenticação no app para limitar acesso quando exposto publicamente.

---
Se quiser, posso criar um script PowerShell com os comandos (incluindo o authtoken) pronto para você executar localmente — diga se quer que eu gere esse script. Eu não vou executar o `ngrok config add-authtoken` aqui sem sua confirmação final para executar o comando no seu ambiente (porque pode expor o token no histórico do terminal).