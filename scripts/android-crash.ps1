#Requires -Version 5.1

$Package = "app.lovable.fa6584b5282341a1b19d2e91ce68bac4"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$ReportFile = Join-Path $ProjectRoot "crash-report.txt"

Write-Host "[Visionario Android Crash Collector]"

Write-Host "Limpando logcat..."
adb logcat -c

Write-Host "Forcando parada do app..."
adb shell am force-stop $Package

Write-Host "Iniciando captura do AndroidRuntime..."
Write-Host "Aguardando crash... Abra o app no celular."
Write-Host "Pressione Ctrl+C para encerrar a captura."
adb logcat -v threadtime AndroidRuntime:E *:S | Out-File -FilePath $ReportFile -Encoding utf8

Write-Host ""
Write-Host "Captura finalizada. Relatorio salvo em: crash-report.txt"
