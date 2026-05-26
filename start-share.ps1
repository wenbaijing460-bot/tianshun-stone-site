$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 4173
$Cloudflared = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"

if (-not (Test-Path $Cloudflared)) {
  $Cloudflared = "cloudflared"
}

& "$Root\start-local.ps1"

$LogDir = Join-Path $Root ".deploy"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$OutLog = Join-Path $LogDir "cloudflared.out.log"
$ErrLog = Join-Path $LogDir "cloudflared.err.log"
Remove-Item -LiteralPath $OutLog -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $ErrLog -Force -ErrorAction SilentlyContinue

Start-Process -FilePath $Cloudflared `
  -ArgumentList @("tunnel", "--url", "http://localhost:$Port") `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden

Write-Host "Starting public tunnel..."
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $logs = @($OutLog, $ErrLog) | Where-Object { Test-Path $_ }
  if ($logs.Count -gt 0) {
    $match = Select-String -Path $logs -Pattern "https://[-a-zA-Z0-9.]+\.trycloudflare\.com" | Select-Object -Last 1
    if ($match) {
      $url = $match.Matches[0].Value
      Write-Host "Public URL: $url"
      Write-Host "Share this: $url/index.html"
      exit 0
    }
  }
}

Write-Host "Tunnel is still starting. Check logs: $OutLog and $ErrLog"
