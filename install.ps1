# Kibble agent on FLOP compute - Windows installer.
# Open PowerShell and run:
#   irm https://raw.githubusercontent.com/KattyFury/floplabs_guide/master/install.ps1 | iex
# Read it first if you like: every step prints what it does. Keys are created and kept on THIS computer only.
# Install folder: %USERPROFILE%\flop-kibble-agent (set $env:KIBBLE_AGENT_DIR to change it).

function Install-KibbleAgent {
  $ErrorActionPreference = "Stop"
  $Zip = "https://github.com/KattyFury/floplabs_guide/archive/refs/heads/master.zip"
  $Dir = if ($env:KIBBLE_AGENT_DIR) { $env:KIBBLE_AGENT_DIR } else { Join-Path $env:USERPROFILE "flop-kibble-agent" }
  $Cli = "@flop-labs/cli@0.10.3"
  function Step($n, $t) { Write-Host "`n[$n/6] $t" -ForegroundColor Cyan }
  function Ok($t) { Write-Host "  OK  $t" -ForegroundColor Green }
  function Warn($t) { Write-Host "  !!  $t" -ForegroundColor Yellow }

  Step 1 "Check Node.js (22 or newer)"
  $v = ""
  try { $v = (& node -v) 2>$null } catch {}
  if (-not $v -or [int]($v.TrimStart("v").Split(".")[0]) -lt 22) {
    Warn "Node.js 22+ not found (have: '$v')."
    Write-Host "  Install it, then open a NEW PowerShell window and run this installer again:"
    Write-Host "    winget install OpenJS.NodeJS.LTS      (or download the LTS from https://nodejs.org)"
    return
  }
  Ok "Node $v"

  Step 2 "Get the agent code into $Dir"
  if (Test-Path (Join-Path $Dir "agent\bot.js")) {
    Ok "Already installed, keeping your files."
  } else {
    $tmp = Join-Path $env:TEMP ("kibble-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force $tmp | Out-Null
    Invoke-WebRequest $Zip -OutFile "$tmp\repo.zip" -UseBasicParsing
    Expand-Archive "$tmp\repo.zip" -DestinationPath $tmp -Force
    Move-Item "$tmp\floplabs_guide-master" $Dir
    Remove-Item $tmp -Recurse -Force
    Ok "Downloaded to $Dir"
  }
  Set-Location $Dir
  $Net = (Get-Content "agent\config.json" -Raw | ConvertFrom-Json).brain.network

  Step 3 "Agent identity (DID)"
  New-Item -ItemType Directory -Force "data" | Out-Null
  $existing = Get-ChildItem "data\*.json" -ErrorAction SilentlyContinue | Where-Object { Test-Path "secrets\$($_.BaseName).pkcs8.der.base64" } | Select-Object -First 1
  if ($existing) {
    $label = $existing.BaseName
    Ok "Using your existing DID '$label' (one DID per person)."
  } else {
    do { $label = (Read-Host "  Pick a short name for your agent (letters/numbers, e.g. alice)").Trim().ToLower() } until ($label -match '^[a-z0-9_-]{2,24}$')
    & node scripts\generate-did.js $label | Out-Null
    Ok "Created DID '$label'. Private key: $Dir\secrets\ (never share it)"
  }

  Step 4 "FLOP wallet + gateway key (official Flop CLI, network: $Net)"
  Write-Host "  Runs: npx $Cli flop --network $Net agent credential"
  Write-Host "  It creates a $Net wallet in $env:USERPROFILE\.flop, gets faucet FLOP, and signs for a gateway key (~24 h, the agent renews it)."
  $out = (& cmd /c "npx --yes --package $Cli flop --network $Net agent credential --json 2>&1") -join "`n"
  $keyFile = Join-Path $env:USERPROFILE ".flop\$Net-wallet-agent-key.json"
  if (Test-Path $keyFile) { Ok "Gateway key saved: $keyFile" }
  else {
    $msg = ($out -split "`n" | Where-Object { $_ -and $_ -notmatch "npm warn" } | Select-Object -Last 2) -join " "
    Warn "No gateway key yet: $msg"
    Write-Host "  Common causes: 'wallet_enrollment_cap_reached' (daily cap full, try again tomorrow)"
    Write-Host "  or 'allowance expired' (ask Flop to renew it). The agent retries by itself every hour; continue the install."
  }

  Step 5 "Telegram bot (your remote control)"
  $envFile = "agent\.env"
  if ((Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^TELEGRAM_BOT_TOKEN=\S+' -Quiet)) {
    Ok "agent\.env already has a Telegram token."
  } else {
    Write-Host "  In Telegram: open @BotFather -> /newbot -> pick a name -> pick a username ending in 'bot' -> copy the token."
    do { $tok = (Read-Host "  Paste the bot token").Trim() } until ($tok -match '^\d+:[A-Za-z0-9_-]{30,}$')
    "TELEGRAM_BOT_TOKEN=$tok`nDID_LABEL=$label`n" | Set-Content -Path $envFile -Encoding ascii
    Ok "Saved to agent\.env (stays on this PC)."
  }

  Step 6 "Test the FLOP brain (posts nothing to Kibble)"
  & node agent\thu-1-phien.js --check
  if ($LASTEXITCODE -ne 0) {
    Warn "The brain is not ready yet (see the line above). That is OK: the agent waits, posts nothing, and checks again by itself."
  }

  Write-Host ""
  Write-Host "BACK UP NOW to a USB drive (lose them = lose your identity and wallet):" -ForegroundColor Yellow
  Write-Host "  $Dir\secrets\   $Dir\data\$label.json   $env:USERPROFILE\.flop\"
  $go = Read-Host "`nStart the agent now and on every PC start? (Y/n)"
  if ($go -notmatch '^[nN]') {
    & cmd /c "agent\CAI-TU-CHAY.bat"
    Write-Host "Done. Open your bot in Telegram and send /start, then /status." -ForegroundColor Green
  } else {
    Write-Host "Start it later by double-clicking $Dir\agent\CAI-TU-CHAY.bat"
  }
}
Install-KibbleAgent
