# No Docker, network, real databases or server secrets are used in these tests.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("reservet-deploy-test-" + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path (Join-Path $testRoot 'config') -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $testRoot 'config\dev.env'), "APP_ENV=dev`n", $utf8)
[System.IO.File]::WriteAllText((Join-Path $testRoot 'config\pro.env'), "APP_ENV=pro`n", $utf8)
$global:deployTestCommands = New-Object System.Collections.Generic.List[string]
$global:deployTestFailMigration = $false
function global:docker {
  $command = $args -join ' '
  $global:deployTestCommands.Add($command)
  $global:LASTEXITCODE = if ($global:deployTestFailMigration -and $command -match 'run --rm --no-deps app node') { 1 } else { 0 }
}
$script = Join-Path $PSScriptRoot '..\deploy\Deploy.ps1'
$revision = 'a' * 40
try {
  & $script -Environment dev -Revision $revision -ServerRoot $testRoot
  if (-not (Test-Path -LiteralPath (Join-Path $testRoot 'releases\dev\current.txt'))) { throw 'Successful dev revision not recorded.' }
  if ($global:deployTestCommands -match 'pg_dump') { throw 'Dev unexpectedly backed up pro.' }

  $global:deployTestCommands.Clear()
  & $script -Environment pro -Revision $revision -ServerRoot $testRoot
  $commands = $global:deployTestCommands -join "`n"
  if ($commands.IndexOf('pg_dump') -lt 0 -or $commands.IndexOf('pg_dump') -gt $commands.IndexOf('run --rm')) { throw 'Backup must precede migration.' }
  if ($commands.IndexOf('run --rm') -gt $commands.IndexOf('up -d --no-deps')) { throw 'Migration must precede app replacement.' }

  $global:deployTestCommands.Clear()
  $global:deployTestFailMigration = $true
  $failed = $false
  try { & $script -Environment dev -Revision ('b' * 40) -ServerRoot $testRoot } catch { $failed = $true }
  if (-not $failed) { throw 'Migration failure was ignored.' }
  if ($global:deployTestCommands -match 'up -d --no-deps') { throw 'App was replaced after failed migration.' }
  $savedRevision = [System.IO.File]::ReadAllText((Join-Path $testRoot 'releases\dev\current.txt'))
  if ($savedRevision -ne $revision) { throw 'Failed revision was recorded as successful.' }
  Write-Host 'Deployment tests passed: environment isolation, backup order and failure stops.'
  # The simulated failing native command intentionally set LASTEXITCODE=1.
  # Restore success after assertions so GitHub's pwsh wrapper does not mistake
  # that expected failure for a failed test process.
  $global:LASTEXITCODE = 0
} finally {
  Remove-Item Function:\docker
  Remove-Variable deployTestCommands, deployTestFailMigration -Scope Global
  # Generated files contain no credentials. Leave the small temp directory for inspection.
}
