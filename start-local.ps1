$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 4173
$Python = "C:\Users\Administrator\AppData\Local\Programs\Python\Python313\python.exe"

if (-not (Test-Path $Python)) {
  $Python = "python"
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -FilePath $Python -ArgumentList @("-m", "http.server", "$Port", "-d", $Root) -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

Write-Host "Local site: http://localhost:$Port/index.html"
