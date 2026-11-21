<#
.SYNOPSIS
  AIRIS-CLI installer for Windows.
.DESCRIPTION
  Installs, updates, repairs and uninstalls AIRIS-CLI from GitHub Releases.
  No administrator privileges are required: the binary goes to
  %LOCALAPPDATA%\Programs\airis and the launcher directory is added to the
  *user* PATH.
.EXAMPLE
  irm https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.ps1 | iex
.EXAMPLE
  .\install.ps1 -Version 0.79.9
#>
[CmdletBinding()]
param(
  [ValidateSet('install','update','upgrade','uninstall','repair','doctor','version','list')]
  [string]$Command = 'install',
  [string]$Version,
  [ValidateSet('stable','nightly')]
  [string]$Channel = 'stable',
  [string]$Prefix = (Join-Path $env:LOCALAPPDATA 'Programs\airis'),
  [string]$BinDir = (Join-Path $env:LOCALAPPDATA 'Programs\airis\bin'),
  [switch]$AllowUnverified,
  [switch]$NoModifyPath,
  [switch]$Purge,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Repo = 'sufiyan-sabeel/AIRIS-CLI'
$ReleaseBase = if ($env:AIRIS_RELEASE_BASE_URL) { $env:AIRIS_RELEASE_BASE_URL } else { "https://github.com/$Repo/releases/download" }
if ($ReleaseBase -notlike 'https://*' -and $env:AIRIS_ALLOW_INSECURE_BASE -ne '1') {
  throw "Refusing non-HTTPS release base: $ReleaseBase"
}

function Write-Ok($m)   { Write-Host $m -ForegroundColor Green }
function Write-Info($m) { Write-Host $m }
function Fail($m)       { Write-Host "error: $m" -ForegroundColor Red; exit 1 }

function Get-Platform {
  $arch = if ($env:AIRIS_FORCE_ARCH) { $env:AIRIS_FORCE_ARCH } elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  if ($arch -notin @('x64','arm64')) { Fail "unsupported architecture: $arch (published: x64, arm64)" }
  return $arch
}

function Resolve-Version {
  if ($Version) { return ($Version -replace '^v','') }
  $api = if ($Channel -eq 'nightly') { "https://api.github.com/repos/$Repo/releases?per_page=10" }
         else { "https://api.github.com/repos/$Repo/releases/latest" }
  try {
    $rel = Invoke-RestMethod -Uri $api -Headers @{ 'Accept' = 'application/vnd.github+json' } -UseBasicParsing
    $tag = if ($rel -is [array]) { $rel[0].tag_name } else { $rel.tag_name }
    if (-not $tag) { Fail 'could not resolve a release; pass -Version' }
    return ($tag -replace '^v','')
  } catch {
    Fail "could not reach the GitHub API: $($_.Exception.Message). Pass -Version <v> to skip resolution."
  }
}

function Get-CurrentVersion {
  $f = Join-Path $Prefix 'current'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() }
  return $null
}

function Set-Launcher($ver) {
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $exe = Join-Path $Prefix "versions\$ver\airis.exe"
  if (-not (Test-Path $exe)) { Fail "installed binary missing: $exe" }
  # A .cmd shim is used because Windows cannot symlink without privileges.
  $shim = Join-Path $BinDir 'airis.cmd'
  "@echo off`r`n`"$exe`" %*" | Set-Content -Path $shim -Encoding ASCII
  Set-Content -Path (Join-Path $Prefix 'current') -Value $ver -NoNewline
}

function Add-UserPath {
  if ($NoModifyPath) { return }
  $userPath = [Environment]::GetEnvironmentVariable('Path','User')
  if ($userPath -split ';' -contains $BinDir) { return }
  $newPath = if ([string]::IsNullOrEmpty($userPath)) { $BinDir } else { "$userPath;$BinDir" }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Info "Added $BinDir to your user PATH (open a new terminal to use it)."
}

function Install-Airis {
  $arch = Get-Platform
  $ver = Resolve-Version
  $asset = "airis-windows-$arch.zip"
  Write-Info "AIRIS-CLI $ver ($arch)"
  Write-Info "  asset:  $asset"
  Write-Info "  target: $Prefix\versions\$ver"
  if ($DryRun) { Write-Ok 'dry run: no changes made'; return }

  $tmp = Join-Path $env:TEMP ("airis-install-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp $asset
    try { Invoke-WebRequest -Uri "$ReleaseBase/v$ver/$asset" -OutFile $zip -UseBasicParsing }
    catch { Fail "download failed: $($_.Exception.Message)" }

    $sums = Join-Path $tmp 'checksums.txt'
    $haveSums = $true
    try { Invoke-WebRequest -Uri "$ReleaseBase/v$ver/checksums.txt" -OutFile $sums -UseBasicParsing }
    catch { $haveSums = $false }

    if ($haveSums) {
      $line = Select-String -Path $sums -Pattern ([regex]::Escape($asset) + '\s*$') | Select-Object -First 1
      if (-not $line) { Fail "checksums.txt lists no entry for $asset" }
      $expected = ($line.Line -split '\s+')[0].ToLower()
      $actual = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
      if ($expected -ne $actual) { Fail "checksum mismatch for $asset`n  expected: $expected`n  actual:   $actual`nNothing was installed." }
      Write-Ok '  checksum verified (sha256)'
    } else {
      if (-not $AllowUnverified) {
        Fail "release $ver publishes no checksums.txt, so $asset cannot be verified. Re-run with -AllowUnverified to accept the risk."
      }
      Write-Host '  WARNING: installing unverified binary (-AllowUnverified)' -ForegroundColor Yellow
    }

    $stage = Join-Path $tmp 'stage'
    Expand-Archive -Path $zip -DestinationPath $stage -Force
    $src = Join-Path $stage 'airis'
    if (-not (Test-Path $src)) { $src = $stage }
    if (-not (Test-Path (Join-Path $src 'airis.exe'))) { Fail 'archive did not contain airis.exe' }

    $dest = Join-Path $Prefix "versions\$ver"
    $partial = "$dest.partial"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $partial
    New-Item -ItemType Directory -Force -Path $partial | Out-Null
    Copy-Item -Path (Join-Path $src '*') -Destination $partial -Recurse -Force
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Move-Item -Path $partial -Destination $dest

    Set-Launcher $ver
    Add-UserPath

    Write-Host ''
    Write-Ok 'AIRIS-CLI installed'
    Write-Info '  Created by Umaiz Sufiyan'
    Write-Info "  version:  $ver"
    Write-Info "  platform: windows/$arch"
    Write-Info "  install:  $dest"
    Write-Info "  launcher: $(Join-Path $BinDir 'airis.cmd')"
    Write-Info ''
    Write-Info 'Next steps:'
    Write-Info '  airis --version'
    Write-Info '  airis doctor'
    Write-Info '  airis'
  } finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
  }
}

function Uninstall-Airis {
  $ver = Get-CurrentVersion
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $BinDir 'airis.cmd')
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $Prefix 'versions')
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $Prefix 'current')
  if ($Purge) {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $env:APPDATA 'airis')
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $env:USERPROFILE '.airis')
    Write-Ok 'removed configuration as well (-Purge)'
  } else {
    Write-Info 'Configuration preserved (use -Purge to remove it).'
  }
  Write-Ok "uninstalled $(if ($ver) { $ver } else { 'AIRIS-CLI' })"
}

switch ($Command) {
  { $_ -in 'install','update','upgrade' } { Install-Airis }
  'uninstall' { Uninstall-Airis }
  'repair' {
    $ver = Get-CurrentVersion
    if (-not $ver) { Fail 'no installation found to repair' }
    Set-Launcher $ver
    Write-Ok "re-linked launcher to $ver"
  }
  'doctor' {
    $ver = Get-CurrentVersion
    Write-Info 'AIRIS-CLI doctor'
    Write-Info "  installed version: $(if ($ver) { $ver } else { 'none' })"
    Write-Info "  install root:      $Prefix"
    Write-Info "  launcher:          $(Join-Path $BinDir 'airis.cmd')"
    $userPath = [Environment]::GetEnvironmentVariable('Path','User')
    Write-Info "  PATH contains bin: $(($userPath -split ';') -contains $BinDir)"
  }
  'version' {
    $ver = Get-CurrentVersion
    if (-not $ver) { Fail 'AIRIS-CLI is not installed' }
    Write-Output $ver
  }
  'list' {
    $cur = Get-CurrentVersion
    Get-ChildItem -Directory (Join-Path $Prefix 'versions') -ErrorAction SilentlyContinue |
      ForEach-Object { if ($_.Name -eq $cur) { "* $($_.Name)" } else { "  $($_.Name)" } }
  }
}
