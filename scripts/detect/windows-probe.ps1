<#
  windows-probe.ps1 — Windows detection (Phase 0 primary platform).
  Read-only. Enumerates installed software, packages, Start Menu shortcuts,
  default browser/mail handlers, and Microsoft 365 / OneDrive presence.
  Emits a raw detection JSON on the SAME contract mac-probe.mjs uses, so
  normalize.mjs can map either to the capability model.

  Usage:
    pwsh -File windows-probe.ps1 -Json
    powershell -ExecutionPolicy Bypass -File windows-probe.ps1 -Json

  No file contents are read. No registry writes. Output goes to stdout only.
#>
param([switch]$Json)

$ErrorActionPreference = 'SilentlyContinue'

# --- 1. Installed software (DisplayName) from the three uninstall hives -----
$uninstallPaths = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$uninstall = foreach ($p in $uninstallPaths) {
  Get-ItemProperty $p | Where-Object { $_.DisplayName } | Select-Object -ExpandProperty DisplayName
}
$uninstall = $uninstall | Sort-Object -Unique

# --- 2. winget packages -----------------------------------------------------
$packages = @()
if (Get-Command winget -ErrorAction SilentlyContinue) {
  $raw = winget list --disable-interactivity 2>$null | Out-String
  $packages = ($raw -split "`r?`n") |
    Where-Object { $_ -and $_ -notmatch '^(Name|---|\s*$)' } |
    ForEach-Object { ($_ -split '\s{2,}')[0].Trim() } |
    Where-Object { $_ } | Sort-Object -Unique
}

# --- 3. Start Menu shortcuts (.lnk basenames) -------------------------------
$startMenuDirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)
$startMenu = foreach ($d in $startMenuDirs) {
  Get-ChildItem -Path $d -Recurse -Filter *.lnk |
    Select-Object -ExpandProperty BaseName
}
$startMenu = $startMenu | Sort-Object -Unique

# --- 4. Default browser + mail handler (UserChoice ProgId) ------------------
$browserProg = (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Shell\Associations\UrlAssociations\https\UserChoice').ProgId
$mailProg    = (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Shell\Associations\UrlAssociations\mailto\UserChoice').ProgId

# --- 5. Microsoft 365 / OneDrive presence + tenant hints --------------------
$tenantHints = @()
if ($env:OneDriveCommercial) { $tenantHints += 'onedrive-commercial' }  # work/school tenant
if ($env:OneDriveConsumer)   { $tenantHints += 'onedrive-consumer' }    # personal MS account
$officeIdentity = (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\Identity\Identities\*' -ErrorAction SilentlyContinue)
foreach ($id in $officeIdentity) {
  if ($id.EmailAddress) {
    $domain = ($id.EmailAddress -split '@')[-1]
    if ($domain) { $tenantHints += "domain:$domain" }
  }
}
$tenantHints = $tenantHints | Sort-Object -Unique

$result = [ordered]@{
  os             = 'win32'
  generatedAt    = (Get-Date).ToUniversalTime().ToString('o')
  uninstall      = @($uninstall)
  packages       = @($packages)
  startMenu      = @($startMenu)
  defaultBrowser = "$browserProg"
  defaultMail    = "$mailProg"
  tenantHints    = @($tenantHints)
  note           = 'Names, package ids, shortcut names, and handler ProgIds only. No file contents read.'
}

$result | ConvertTo-Json -Depth 4 -Compress
