@echo off
setlocal enabledelayedexpansion

echo [Visionario Android Crash Collector]
echo Limpando logcat...
adb logcat -c

echo Forcando parada do app...
adb shell am force-stop app.lovable.fa6584b5282341a1b19d2e91ce68bac4

echo Iniciando captura do AndroidRuntime...
echo Aguardando crash... Abra o app no celular.
adb logcat -v threadtime AndroidRuntime:E *:S > "..\..\crash-report.txt"

echo.
echo Captura finalizada. Relatorio salvo em: crash-report.txt
pause
