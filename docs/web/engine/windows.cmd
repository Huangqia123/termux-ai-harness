@echo off
rem Windows: start the local llama-server that the web page connects to.
rem Prereq: llama-server.exe on PATH, GGUF model in %USERPROFILE%\.termux-ai\models.
setlocal
set MODEL_DIR=%USERPROFILE%\.termux-ai\models
if not exist "%MODEL_DIR%" mkdir "%MODEL_DIR%"

set MODEL=
if not "%~1"=="" (
  set MODEL=%~1
) else (
  for %%f in ("%MODEL_DIR%\*.gguf") do (
    echo %%~nf | findstr /i /v "mmproj" >nul && set MODEL=%%f
  )
)

if "%MODEL%"=="" (
  echo 未找到 GGUF 模型。把模型放进 %MODEL_DIR%，或把模型路径作为参数传给本脚本。
  exit /b 1
)

echo 模型: %MODEL%
echo 引擎将监听 127.0.0.1:8080，网页版打开后自动连接。
llama-server.exe -m "%MODEL%" -c 2048 -t 2 --host 127.0.0.1 --port 8080 --cors "*"
