@echo off
title ZCode Miku Unmount
echo ============================================
echo   ZCode Hatsune Miku theme - UNMOUNT (restore original)
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0unmount.ps1" %*
echo.
echo Done.
pause
