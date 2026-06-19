# Windows verification — TARS v1.3.0

Verified behaviors for Windows + Microsoft 365 rollout.

## Install paths

| Method | Command | Notes |
|---|---|---|
| PowerShell | `irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 \| iex` | No Node required |
| npm global | `npm i -g tars-chief-of-staff` then `tars` | Requires Node 18+ |
| npx | `npx tars-chief-of-staff` | One-shot |

## OneDrive detection

`Install-Tars.ps1` and `bin/install.mjs` recurse 1–2 levels under `%USERPROFILE%\OneDrive*` for nested org sync folders (`OneDrive - <Org>`). Prefer the org folder over personal OneDrive root.

## CLI smoke tests (Windows)

```powershell
tars help
tars doctor
tars index build --root "$env:USERPROFILE\OneDrive - Contoso"
tars status
tars publish
tars export --chatgpt
tars --no-launch
```

## Expected

- `tars doctor` reports work folder, skill version, index doc count, connector map (when Claude Code + MCP available)
- `scripts/detect/windows-probe.ps1` runs without error on Windows runners (CI)
- Index store: `<work folder>\.tars-index\`
- Workspace: `<work folder>\Chief of Staff\`

## CI

GitHub Actions runs `Install-Tars.ps1` syntax check and CLI tests on `windows-latest` alongside ubuntu/macos.

## Known limits

- Clipboard copy uses `clip.exe`
- `mdfind` unavailable — local index (`indexer.mjs`) is the primary file search path
- Connector detection requires Claude Code (`claude mcp list`) or `--tools` JSON in other surfaces
