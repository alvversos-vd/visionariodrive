#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_FILE="$PROJECT_ROOT/crash-report.txt"

PACKAGE="app.lovable.fa6584b5282341a1b19d2e91ce68bac4"

echo "[Visionario Android Crash Collector]"
echo "Limpando logcat..."
adb logcat -c

echo "Forcando parada do app..."
adb shell am force-stop "$PACKAGE" || true

echo "Iniciando captura do AndroidRuntime..."
echo "Aguardando crash... Abra o app no celular."
echo "Pressione Ctrl+C para encerrar a captura."
adb logcat -v threadtime AndroidRuntime:E '*:S' > "$REPORT_FILE"

echo ""
echo "Captura finalizada. Relatorio salvo em: crash-report.txt"
