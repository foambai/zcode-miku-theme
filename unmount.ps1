# ZCode Miku theme - unmount script (restore original look)
param([int]$DelaySeconds = 0)

$Dir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log   = Join-Path $Dir 'mount.log'
$State = Join-Path $Dir 'state.json'
$ZcodeCandidates = @('D:\Program Files\ZCode\ZCode.exe', "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe", "$env:ProgramFiles\ZCode\ZCode.exe")

function Log($m) { Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }
Log "==== miku unmount start ===="

# 1) Stop the resident injector
if (Test-Path $State) {
  try {
    $st = Get-Content $State -Raw | ConvertFrom-Json
    if ($st.injectorPid) {
      if (Get-Process -Id $st.injectorPid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $st.injectorPid -Force -ErrorAction SilentlyContinue
        Log "injector pid=$($st.injectorPid) stopped"
      }
    }
  } catch { Log "state read fail: $_" }
  Remove-Item $State -Force -ErrorAction SilentlyContinue
}
# backup sweep: stop any injector by command line (state.json may be stale)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'miku-inject\.mjs' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Log "injector swept pid=$($_.ProcessId)"
}

# 2) Restart ZCode WITHOUT the debug port (original look)
if (Get-Process ZCode -ErrorAction SilentlyContinue) {
  & taskkill /F /IM ZCode.exe /T 2>$null | Out-Null
  Start-Sleep -Seconds 2
}
$exe = $ZcodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { Log "ERROR: ZCode.exe not found"; exit 1 }
Start-Process -FilePath $exe
Log "ZCode relaunched plain (original look)"
exit 0
