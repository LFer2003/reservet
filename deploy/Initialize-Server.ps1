[CmdletBinding()]
param([string]$ServerRoot = 'E:\reservet-server')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ServerRoot = [System.IO.Path]::GetFullPath($ServerRoot)
if ($ServerRoot.TrimEnd('\') -eq [System.IO.Path]::GetPathRoot($ServerRoot).TrimEnd('\')) {
  throw 'ServerRoot must be a dedicated directory, not a drive root.'
}
$null = New-Item -ItemType Directory -Force -Path $ServerRoot
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $ServerRoot /inheritance:r /grant:r "${account}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict server folder permissions.' }
# Files stay outside checkouts so Actions checkout cannot delete server secrets.
$configPath = Join-Path $ServerRoot 'config'
$null = New-Item -ItemType Directory -Force -Path $configPath
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($environment in @('dev', 'pro')) {
  $envFile = Join-Path $configPath "$environment.env"
  if (Test-Path -LiteralPath $envFile) {
    Write-Host "$environment configuration already exists; preserved."
    continue
  }
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  # Hex is URL-safe and avoids Compose interpolation/connection URL escaping.
  $password = ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
  $port = if ($environment -eq 'dev') { 3100 } else { 3200 }
  $content = "APP_ENV=$environment`nAPP_PORT=$port`nDB_USER=reservet_$environment`nDB_NAME=reservet_$environment`nDB_PASSWORD=$password`n"
  [System.IO.File]::WriteAllText($envFile, $content, $utf8)
  Write-Host "Created $environment configuration (password not printed)."
}
Write-Host "Configuration: $configPath. Restrict its Windows permissions to the runner account and administrators."
