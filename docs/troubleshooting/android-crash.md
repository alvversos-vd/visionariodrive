# Coleta de Crash Android (Android Crash Collector)

Este guia explica como capturar o stacktrace completo do crash de inicializacao do Visionario Drive em dispositivos Android.

## Pre-requisitos

1. **Celular com Depuracao USB habilitada**
   - Android: Configuracoes > Sistema > Opcoes do Desenvolvedor > Depuracao USB.
2. **ADB instalado na maquina**
   - Incluido no Android SDK (pasta `platform-tools`).
   - Ou via `winget install Google.AndroidStudio` / `brew install android-platform-tools`.
3. **Cabo USB conectado** ao computador.

## Verificar conexao

```bash
adb devices
```

Voce deve ver algo como:

```text
List of devices attached
ABC123456789    device
```

## Coletar o crash

Escolha um dos scripts abaixo e execute na raiz do projeto.

### Windows (CMD)

```cmd
scripts\android-crash.bat
```

### Windows (PowerShell)

```powershell
.\scripts\android-crash.ps1
```

> Se o PowerShell bloquear por politica de execucao, rode primeiro: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

### macOS / Linux / Git Bash

```bash
chmod +x scripts/android-crash.sh
./scripts/android-crash.sh
```

## Passo a passo

1. Execute o script.
2. O script limpara o logcat e forcara a parada do app.
3. Quando solicitado, **abra o aplicativo no celular**.
4. Aguarde o crash acontecer (tela preta, fechamento, etc.).
5. Volte ao terminal e pressione `Ctrl+C` para encerrar a captura.
6. O arquivo `crash-report.txt` sera salvo na raiz do projeto.

## Enviar para analise

Anexe o arquivo `crash-report.txt` na conversa ou no ticket de suporte.

O que procuramos no arquivo:

- `AndroidRuntime` — indica que o app finalizou inesperadamente.
- `FATAL EXCEPTION` — thread onde ocorreu o crash.
- `Caused by:` — causa raiz da excecao.
- Classe, metodo, arquivo e linha onde foi lancada.

## Coleta manual (fallback)

Se o script nao funcionar, execute manualmente:

```bash
adb logcat -c
adb shell am force-stop app.lovable.fa6584b5282341a1b19d2e91ce68bac4
adb logcat -v threadtime AndroidRuntime:E '*:S' > crash-report.txt
```

Depois abra o app ate o crash e pressione `Ctrl+C`.
