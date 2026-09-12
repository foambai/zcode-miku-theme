# ZCode Miku theme - remove zero-effort autostart
# Restores shortcuts (removes CDP flags), deletes the logon task, stops the supervisor.
$ErrorActionPreference = 'Continue'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$ws = New-Object -ComObject WScript.Shell
$dirs = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\StartMenu",
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('CommonDesktopDirectory')
)
foreach ($d in $dirs) {
  if (-not $d -or -not (Test-Path $d)) { continue }
  Get-ChildItem -Path $d -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $s = $ws.CreateShortcut($_.FullName)
      if ($s.TargetPath -and ($s.TargetPath -match 'ZCode\.exe$') -and ($s.Arguments -match 'remote-debugging-port')) {
        $s.Arguments = (($s.Arguments -replace '--remote-debugging-port=\d+', '') -replace '--remote-allow-origins=\*', '').Trim()
        $s.Save()
        Write-Host ("restored: " + $_.FullName)
      }
    } catch {}
  }
}

# remove the Startup-folder autostart
$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'zcode-miku-watch.vbs'
Remove-Item $vbs -Force -ErrorAction SilentlyContinue
Write-Host ('autostart removed: ' + $vbs)

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'miku-inject\.mjs' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Host ("supervisor stopped pid=" + $_.ProcessId)
}
exit 0
