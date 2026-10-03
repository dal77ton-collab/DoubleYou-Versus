@echo off
cd /d "%~dp0"
echo Starting DoubleYou Versus on this computer...
echo Do not close this window while you play.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-game.ps1"
pause
