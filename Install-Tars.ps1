# Install-Tars.ps1 — install the chief-of-staff skill on Windows without Node or npm.
# Works on any Windows 10/11 machine with PowerShell 5+ (built in).
#
# Usage (paste into PowerShell — right-click Start > Terminal, or search "PowerShell"):
#   irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 | iex
#
# Options:
#   $env:DEST = "C:\path"   — custom location
#   $env:FORCE = "1"        — overwrite existing install

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  T A R S"
Write-Host "  Make your AI actually know your work."
Write-Host "  by Christian Tonny - github.com/irachrist1/tars"
Write-Host ""

$dest = if ($env:DEST) { $env:DEST } else { Join-Path $HOME ".claude\skills\chief-of-staff" }
$base = "https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff"

if ((Test-Path (Join-Path $dest "SKILL.md")) -and -not $env:FORCE) {
    Write-Host "  already installed at $dest"
    Write-Host "  re-run with `$env:FORCE=1 to overwrite"
    exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "references") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "scripts") | Out-Null

Write-Host "  Fetching chief-of-staff..."
$files = @{
    "SKILL.md"                               = "SKILL.md"
    "PUBLISHING.md"                          = "PUBLISHING.md"
    "references/onboarding.md"               = "references\onboarding.md"
    "references/workspace-shapes.md"         = "references\workspace-shapes.md"
    "references/investigation-discipline.md" = "references\investigation-discipline.md"
    "scripts/scan.mjs"                       = "scripts\scan.mjs"
    "scripts/connectors.mjs"                 = "scripts\connectors.mjs"
    "scripts/package.mjs"                    = "scripts\package.mjs"
}
foreach ($src in $files.Keys) {
    Invoke-WebRequest -Uri "$base/$src" -OutFile (Join-Path $dest $files[$src]) -UseBasicParsing
}

Write-Host ""
Write-Host "  # chief-of-staff installed -> $dest"
Write-Host ""
Write-Host "  Open Claude and say:  set up my chief of staff"
Write-Host ""
Write-Host "  If your work lives in Microsoft 365, enable the Microsoft 365 connector"
Write-Host "  in your Claude client (Settings > Connectors) so it can read your files,"
Write-Host "  mail, and calendar."
Write-Host ""
Write-Host "  Built by Christian Tonny - github.com/irachrist1"
Write-Host ""
