# ZCode Miku theme - zero-effort autostart setup
# 1) Adds the CDP flags to ZCode shortcuts (Start Menu / taskbar pin / desktop)
# 2) Creates a logon task that runs the injector supervisor
# 3) Starts the supervisor now
# Re-running is idempotent. Teardown: teardown-autostart.ps1
$ErrorActionPreference = 'Continue'
$Dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = 'D:\Program Files\nodejs\node.exe'
$Port = 39517
$Flags = "--remote-debugging-port=$Port --remote-allow-origins=*"

$ws = New-Object -ComObject WScript.Shell
$dirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\StartMenu",
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('CommonDesktopDirectory')
)
$patched = 0
foreach ($d in $dirs) {
  if (-not $d -or -not (Test-Path $d)) { continue }
  Get-ChildItem -Path $d -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $s = $ws.CreateShortcut($_.FullName)
      if ($s.TargetPath -and ($s.TargetPath -match 'ZCode\.exe$')) {
        if ($s.Arguments -notmatch 'remote-debugging-port') {
          $s.Arguments = if ($s.Arguments) { ($s.Arguments + ' ' + $Flags).Trim() } else { $Flags }
          $s.Save()
          Write-Host ("patched: " + $_.FullName)
          $script:patched++
        }
      }
    } catch { Write-Host ("skip: " + $_.FullName + " ($($_.Exception.Message))") }
  }
}
Write-Host "shortcuts patched: $patched"

$taskName = 'none'
# Autostart via the per-user Startup folder (no admin required)
$startup = [Environment]::GetFolderPath('Startup')
$vbs = Join-Path $startup 'zcode-miku-watch.vbs'
$vbsContent = 'CreateObject("WScript.Shell").Run """' + $Node + '"" ""' + $Dir + '\scripts\miku-inject.mjs"" --port ' + $Port + ' --forever", 0, False'
Set-Content -Path $vbs -Value $vbsContent -Encoding ASCII
Write-Host ('autostart written: ' + $vbs)

# stop any supervisor attached to this console tree, then ensure one is running detached
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'miku-inject\.mjs --port ' + $Port + ' --forever' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Remove-Item (Join-Path $Dir 'scripts\injector.lock') -Force -ErrorAction SilentlyContinue
Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"') -WindowStyle Hidden
Start-Sleep -Seconds 2
$sup = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'miku-inject\.mjs --port ' + $Port + ' --forever' }
if ($sup) { Write-Host ('supervisor running detached pid=' + $sup.ProcessId) } else { Write-Host 'supervisor NOT running (check startup vbs)' }
exit 0
