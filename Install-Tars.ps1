# Install-Tars.ps1 — install or update the chief-of-staff skill on Windows without Node or npm.
# Works on any Windows 10/11 machine with PowerShell 5+ (built in).
#
# Usage (paste into PowerShell — right-click Start > Terminal, or search "PowerShell"):
#   irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 | iex
#
# Re-running is safe: if a newer version is published it updates in place and
# keeps your local onboarding-seed.md. The file list is read from the published
# MANIFEST, so the installer never drifts out of sync with the skill.
#
# Options:
#   $env:DEST = "C:\path"   — custom location
#   $env:FORCE = "1"        — reinstall even if already up to date

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  T A R S"
Write-Host "  Make your AI actually know your work."
Write-Host "  by Christian Tonny - github.com/irachrist1/tars"
Write-Host ""

$dest = if ($env:DEST) { $env:DEST } else { Join-Path $HOME ".claude\skills\chief-of-staff" }
$base = "https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff"

# --- fetch the manifest FIRST: it carries both the version line and the file
# list, so the version we stamp and the files we install always agree (no
# separate VERSION fetch that could drift out of sync with the manifest). ------
try {
    $manifest = (Invoke-WebRequest -Uri "$base/MANIFEST" -UseBasicParsing).Content
} catch {
    Write-Error "  could not fetch the manifest from $base/MANIFEST - check your connection and try again."
    exit 1
}

$manifestLines = $manifest -split "`n" | ForEach-Object { $_.Trim() }
$remoteVersion = ($manifestLines | Where-Object { $_ -like "version *" } | Select-Object -First 1) -replace "^version\s+", ""
if (-not $remoteVersion) { $remoteVersion = "unknown" }
$files = $manifestLines | Where-Object { $_ -and -not $_.StartsWith("#") -and -not $_.StartsWith("version ") }

$localVersion = ""
$localVersionPath = Join-Path $dest "VERSION"
if (Test-Path $localVersionPath) { $localVersion = (Get-Content $localVersionPath -Raw).Trim() }

if (Test-Path (Join-Path $dest "SKILL.md")) {
    if (($localVersion -eq $remoteVersion) -and -not $env:FORCE) {
        Write-Host "  # already up to date (v$localVersion) at $dest"
        Write-Host "    re-run with `$env:FORCE=1 to reinstall."
        Write-Host ""
        exit 0
    }
    if ($localVersion) {
        Write-Host "  Updating v$localVersion -> v$remoteVersion..."
    } else {
        Write-Host "  Updating to v$remoteVersion (keeping your onboarding-seed.md)..."
    }
} else {
    Write-Host "  Installing v$remoteVersion..."
}

# --- download every file the manifest lists ----------------------------------
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($rel in $files) {
    $localPath = Join-Path $dest ($rel -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $localPath) | Out-Null
    try {
        Invoke-WebRequest -Uri "$base/$rel" -OutFile $localPath -UseBasicParsing
    } catch {
        Write-Error "  failed to download $rel - install aborted (nothing claimed)."
        exit 1
    }
    Write-Host "    . $rel"
}

# --- prune files removed in newer releases (keep VERSION + onboarding-seed.md)-
$keep = New-Object System.Collections.Generic.HashSet[string]
foreach ($rel in $files) { [void]$keep.Add(($rel -replace "/", "\")) }
[void]$keep.Add("VERSION"); [void]$keep.Add("onboarding-seed.md")
Get-ChildItem -Path $dest -Recurse -File | ForEach-Object {
    $relLocal = $_.FullName.Substring($dest.Length).TrimStart("\")
    if (-not $keep.Contains($relLocal)) {
        Remove-Item -Force $_.FullName
        Write-Host "    - removed $relLocal (no longer in release)"
    }
}

# stamp the installed version so the next run can compare
Set-Content -Path $localVersionPath -Value $remoteVersion -NoNewline

Write-Host ""
Write-Host "  # chief-of-staff v$remoteVersion -> $dest"
Write-Host ""
Write-Host "  Open Claude and say:  set up my chief of staff"
Write-Host ""
Write-Host "  Use it in Cowork or claude.ai too?  Upload the skill once via"
Write-Host "  Customize > Skills > + > Upload a skill (see PUBLISHING.md)."
Write-Host ""
Write-Host "  If your work lives in Microsoft 365, enable the Microsoft 365 connector"
Write-Host "  in your Claude client (Settings > Connectors) so it can read your files,"
Write-Host "  mail, and calendar."
Write-Host ""
Write-Host "  Built by Christian Tonny - github.com/irachrist1"
Write-Host ""
