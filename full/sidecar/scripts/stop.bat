@echo off
setlocal

cd /d "%~dp0..\..\.."
cd full

docker compose down
echo VEIL sidecar stopped.
endlocal
