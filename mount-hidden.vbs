' ZCode Miku theme - silent background mount (no window at all)
' Works from any directory: resolves the script folder at runtime.
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & strDir & "\mount.ps1"" -DelaySeconds 10", 0, False
