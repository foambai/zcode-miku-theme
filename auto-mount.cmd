@echo off
set DELAY=75
if not "%1"=="" set DELAY=%1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mount.ps1" -DelaySeconds %DELAY%
schtasks /delete /f /tn "ZCodeMikuAutoMount" >nul 2>&1
