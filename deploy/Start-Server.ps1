[CmdletBinding()]
param([string]$ServerRoot = 'E:\reservet-server', [string]$RunnerRoot = 'E:\actions-runner-reservet')
$ErrorActionPreference = 'Stop'
$logs = Join-Path $ServerRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$serverTemp = Join-Path $ServerRoot 'tmp'
New-Item -ItemType Directory -Force -Path $serverTemp | Out-Null
$env:TEMP = $serverTemp
$env:TMP = $serverTemp
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
$env:PATH = "$dockerBin;$env:PATH"
# Docker CLI discovers plugins through the user's Docker config after Desktop starts.
$desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $desktop -WindowStyle Hidden
}

# A runner must not accept deployments while Docker is still booting after login.
$deadline = [DateTime]::UtcNow.AddMinutes(2)
$ready = $false
while ([DateTime]::UtcNow -lt $deadline) {
  try {
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    $ready = $LASTEXITCODE -eq 0
  } catch { $ready = $false }
  if ($ready) { break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'Docker is not ready. Runner not started; check Desktop/WSL and run this script again.' }

if (-not (Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $env:ComSpec -ArgumentList ('/c ""' + (Join-Path $RunnerRoot 'run.cmd') + '""') -WorkingDirectory $RunnerRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'runner.out.log') -RedirectStandardError (Join-Path $logs 'runner.err.log')
}
$config = Join-Path $ServerRoot 'config\cloudflared.yml'
if (Test-Path -LiteralPath $config) {
  $existing = Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" | Where-Object { $_.CommandLine -like "*$config*" }
  if (-not $existing) {
    Start-Process -FilePath 'C:\Program Files (x86)\cloudflared\cloudflared.exe' -ArgumentList @('tunnel', '--config', ('"' + $config + '"'), 'run') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'cloudflare.out.log') -RedirectStandardError (Join-Path $logs 'cloudflare.err.log')
  }
} else {
  Write-Host 'Cloudflare configuration not yet authorized; tunnel not started.'
}
Write-Host "Background processes started. Logs: $logs"
