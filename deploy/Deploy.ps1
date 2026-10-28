[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('dev', 'pro')][string]$Environment,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$Revision,
  [string]$ServerRoot = 'E:\reservet-server'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = "reservet-$Environment"
$envFile = Join-Path $ServerRoot "config\$Environment.env"
if (-not (Test-Path -LiteralPath $envFile)) { throw "Missing $envFile. Run Initialize-Server.ps1 first." }
$null = Get-Command docker -ErrorAction Stop
$composeFile = Join-Path $PSScriptRoot 'compose.yaml'
$image = "reservet:$Revision"
$previousImage = $env:APP_IMAGE
$env:APP_IMAGE = $image
# Compose gives process variables precedence over --env-file. Do not let an old
# shell session redirect a pro deployment to dev credentials, ports or database.
$composeKeys = @('APP_ENV', 'APP_PORT', 'DB_USER', 'DB_NAME', 'DB_PASSWORD')
$previousVariables = @{}
foreach ($key in $composeKeys) {
  $previousVariables[$key] = [System.Environment]::GetEnvironmentVariable($key, 'Process')
  [System.Environment]::SetEnvironmentVariable($key, $null, 'Process')
}
$compose = @('compose', '--project-name', $project, '--env-file', $envFile, '-f', $composeFile)
function Invoke-Compose {
  # A simple function forwards native flags such as -e without PowerShell
  # interpreting them as common parameters (for example ErrorAction).
  & docker @compose @args
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed: $($args[0])" }
}

$mutex = New-Object System.Threading.Mutex($false, "Local\ReservetDeploy-$Environment")
$locked = $false
try {
  try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) { throw "A $Environment deployment is already running." }
  & docker image inspect $image --format '{{.Id}}' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Image $image is not loaded." }
  # Check without printing the rendered configuration (it contains passwords).
  Invoke-Compose config --quiet
  $actualEnv = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^APP_ENV=' }
  if ($actualEnv -ne "APP_ENV=$Environment") { throw 'Environment configuration mismatch.' }
  Invoke-Compose up -d --wait --wait-timeout 120 db

  if ($Environment -eq 'pro') {
    $backupDirectory = Join-Path $ServerRoot 'backups\pro'
    $null = New-Item -ItemType Directory -Force -Path $backupDirectory
    $backupName = "$(Get-Date -Format 'yyyyMMdd-HHmmss')-$Revision.dump"
    # No binary PowerShell redirection: pg_dump writes inside the Linux container.
    Invoke-Compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/predeploy.dump'
    Invoke-Compose cp 'db:/tmp/predeploy.dump' (Join-Path $backupDirectory $backupName)
    Invoke-Compose exec -T db rm /tmp/predeploy.dump
    Write-Host "Pre-migration backup saved: $backupName"
  }

  # Old HTTP process may still run: migrations must be backward-compatible.
  Invoke-Compose run --rm --no-deps app node build/scripts/migrate.js
  Invoke-Compose up -d --no-deps --wait --wait-timeout 120 app
  # Check connectivity and the interface, not just container startup.
  Invoke-Compose exec -T app node -e "Promise.all(['/', '/health/db'].map(async p => { const r = await fetch('http://127.0.0.1:3000' + p); if (!r.ok) throw new Error(p); })).catch(() => process.exit(1))"
  $releaseDirectory = Join-Path $ServerRoot "releases\$Environment"
  $null = New-Item -ItemType Directory -Force -Path $releaseDirectory
  [System.IO.File]::WriteAllText((Join-Path $releaseDirectory 'current.txt'), $Revision, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Deployed $project revision $Revision."
} catch {
  # Never roll back the database automatically or remove persistent volumes.
  Write-Error "Deployment failed. Database volumes preserved. Inspect docker compose logs; do not assume migrations were reversed. $($_.Exception.Message)"
  throw
} finally {
  $env:APP_IMAGE = $previousImage
  foreach ($key in $composeKeys) {
    [System.Environment]::SetEnvironmentVariable($key, $previousVariables[$key], 'Process')
  }
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
