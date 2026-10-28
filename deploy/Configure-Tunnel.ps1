[CmdletBinding()]
param([string]$ServerRoot = 'E:\reservet-server')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$certificate = Join-Path $ServerRoot 'config\cloudflare-cert.pem'
$loginCertificate = Join-Path $env:USERPROFILE '.cloudflared\cert.pem'
if (-not (Test-Path -LiteralPath $certificate) -and (Test-Path -LiteralPath $loginCertificate)) {
  Move-Item -LiteralPath $loginCertificate -Destination $certificate -ErrorAction Stop
}
if (-not (Test-Path -LiteralPath $certificate)) {
  throw 'Run cloudflared tunnel login and authorize log14.com in your browser first.'
}
$env:TUNNEL_ORIGIN_CERT = $certificate
$tunnels = cloudflared tunnel list --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot list Cloudflare tunnels.' }
$tunnel = $tunnels | Where-Object name -eq 'reservet-pc' | Select-Object -First 1
if (-not $tunnel) {
  $credentialPath = Join-Path $ServerRoot 'config\cloudflare-tunnel.json'
  $tunnel = cloudflared tunnel create --output json --credentials-file $credentialPath reservet-pc | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create Reservet tunnel.' }
}
$tunnelId = $tunnel.id
if ($tunnelId -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid tunnel ID.' }
$credential = Join-Path $ServerRoot 'config\cloudflare-tunnel.json'
$oldCredential = Join-Path $env:USERPROFILE ".cloudflared\$tunnelId.json"
if (-not (Test-Path -LiteralPath $credential) -and (Test-Path -LiteralPath $oldCredential)) {
  Move-Item -LiteralPath $oldCredential -Destination $credential -ErrorAction Stop
}
if (-not (Test-Path -LiteralPath $credential)) { throw 'Tunnel exists but its credential is missing on this PC. Recover it before proceeding.' }
$configuration = Join-Path $ServerRoot 'config\cloudflared.yml'
if (Test-Path -LiteralPath $configuration) { throw 'Tunnel config already exists; inspect it rather than overwrite it.' }
$content = @"
tunnel: $tunnelId
credentials-file: '$credential'
ingress:
  - hostname: reservet-dev.log14.com
    service: http://127.0.0.1:3100
  - hostname: reservet.log14.com
    service: http://127.0.0.1:3200
  - service: http_status:404
"@
[System.IO.File]::WriteAllText($configuration, $content, (New-Object System.Text.UTF8Encoding($false)))
cloudflared tunnel --config $configuration ingress validate
if ($LASTEXITCODE -ne 0) { throw 'Tunnel configuration is invalid.' }
foreach ($hostname in @('reservet-dev.log14.com', 'reservet.log14.com')) {
  # Deliberately omit --overwrite-dns: preserve any pre-existing DNS records.
  cloudflared tunnel route dns $tunnelId $hostname
  if ($LASTEXITCODE -ne 0) { throw "Could not route $hostname. Existing DNS was not overwritten." }
}
Write-Host 'Cloudflare routes configured. Start with deploy/Start-Server.ps1.'
