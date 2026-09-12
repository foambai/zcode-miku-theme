# ZCode Miku theme - mount script
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File mount.ps1                # mount now (restarts ZCode)
#   powershell ... -File mount.ps1 -DelaySeconds 60                              # delayed mount
#   powershell ... -File mount.ps1 -InjectOnly                                   # inject only (app already has mount port)
# Log: mount.log   State: state.json   Screenshot: verification.png
param(
  [int]$DelaySeconds = 0,
  [switch]$InjectOnly
)

$Dir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log   = Join-Path $Dir 'mount.log'
$State = Join-Path $Dir 'state.json'
$Node  = 'D:\Program Files\nodejs\node.exe'
$ZcodeCandidates = @('D:\Program Files\ZCode\ZCode.exe', "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe", "$env:ProgramFiles\ZCode\ZCode.exe")

function Log($m) { Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }
Log "==== miku mount start (delay=$DelaySeconds injectOnly=$InjectOnly) ===="

$exe = $ZcodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { Log "ERROR: ZCode.exe not found"; exit 1 }

function Test-CdpPort([int]$p) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$p/json/version" -TimeoutSec 2
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

# Live mount port already available: inject without restart
if (Test-Path $State) {
  try { $st = Get-Content $State -Raw | ConvertFrom-Json } catch { $st = $null }
  if ($st -and $st.port -and (Test-CdpPort ([int]$st.port))) {
    Log "live mount port $($st.port) found; inject-only"
    $injAlive = $false
    if ($st.injectorPid) { $injAlive = [bool](Get-Process -Id $st.injectorPid -ErrorAction SilentlyContinue) }
    if (-not $injAlive) {
      $inj = Start-Process -FilePath $Node -ArgumentList "`"$Dir\scripts\miku-inject.mjs`"", "--port", "$($st.port)" -WindowStyle Hidden -PassThru
      Log "injector (re)started pid=$($inj.Id)"
      $st.injectorPid = $inj.Id
      $st | ConvertTo-Json | Set-Content $State
    }
    Log "inject-only done"; exit 0
  }
}

if ($InjectOnly) { Log "no live mount port; -InjectOnly set, nothing to do"; exit 1 }

# Restart ZCode to enable the debug port
$procs = @(Get-Process ZCode -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
  Log "closing ZCode (procs=$($procs.Count))..."
  $procs | ForEach-Object { try { $null = $_.CloseMainWindow() } catch {} }
  Start-Sleep -Seconds 4
  if (Get-Process ZCode -ErrorAction SilentlyContinue) {
    Log "graceful close failed (closeToTray?); force kill"
    & taskkill /F /IM ZCode.exe /T 2>$null | Out-Null
    Start-Sleep -Seconds 2
  }
  if (Get-Process ZCode -ErrorAction SilentlyContinue) { Log "ERROR: ZCode still running after kill"; exit 1 }
}

$port = 39517   # fixed mount port (app is single-instance, so the port is unique per app run)
Log "launching ZCode with CDP port $port"
Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$port", "--remote-allow-origins=*"

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1
  if (Test-CdpPort $port) { $ready = $true; break }
}
if (-not $ready) {
  Log "ERROR: CDP port $port did not open within 45s. ZCode relaunched plain; run mount.cmd again to retry"
  Start-Process -FilePath $exe   # safety: make sure the app is running
  exit 1
}
Log "CDP ready"

$inj = Start-Process -FilePath $Node -ArgumentList "`"$Dir\scripts\miku-inject.mjs`"", "--port", "$port" -WindowStyle Hidden -PassThru
Log "injector resident started pid=$($inj.Id)"
@{ port = $port; injectorPid = $inj.Id; started = (Get-Date -Format 'o') } | ConvertTo-Json | Set-Content $State

Start-Sleep -Seconds 4
& $Node "$Dir\scripts\miku-inject.mjs" --port $port --screenshot "$Dir\verification.png" 2>>$Log | Out-Null
Log "mount complete"
exit 0
