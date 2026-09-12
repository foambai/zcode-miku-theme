@echo off
title ZCode Miku Mounter
echo ============================================
echo   ZCode Hatsune Miku theme - MOUNT
echo   (ZCode will restart. Save your work first.)
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mount.ps1" %*
echo.
echo Done. Log: %~dp0mount.log  Screenshot: %~dp0verification.png
pause
