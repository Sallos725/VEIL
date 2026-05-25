@echo off
setlocal

cd /d "%~dp0..\..\.."
cd full\sidecar

if not exist data mkdir data
set VEIL_PORT=6010
set VEIL_HOST=127.0.0.1
set VEIL_DATA_DIR=%CD%\data

echo VEIL sidecar (Node) http://127.0.0.1:6010
node src\server.js
