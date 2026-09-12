# ZCode Miku theme - patch admin-owned ZCode shortcuts (requires elevation)
# Adds the CDP flags to the All Users Start Menu and Public Desktop shortcuts.
$ErrorActionPreference = 'Continue'
$Port = 39517
$Flags = "--remote-debugging-port=$Port --remote-allow-origins=*"
$ws = New-Object -ComObject WScript.Shell
$targets = @(
  'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\ZCode.lnk',
  'C:\Users\Public\Desktop\ZCode.lnk'
)
foreach ($t in $targets) {
  if (-not (Test-Path $t)) { Write-Host ("missing: " + $t); continue }
  try {
    $s = $ws.CreateShortcut($t)
    if ($s.Arguments -notmatch 'remote-debugging-port') {
      $s.Arguments = if ($s.Arguments) { ($s.Arguments + ' ' + $Flags).Trim() } else { $Flags }
      $s.Save()
      Write-Host ("patched: " + $t)
    } else {
      Write-Host ("already patched: " + $t)
    }
  } catch {
    Write-Host ("FAILED: " + $t + " -> " + $_.Exception.Message)
  }
}
Start-Sleep -Seconds 2
exit 0
