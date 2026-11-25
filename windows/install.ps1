#requires -version 5.1
<#
Installer for Termux AI / Termux AI Harness on Windows.

Installs the PowerShell scripts into %LOCALAPPDATA%\TermuxAI\bin, adds that
folder to the user PATH, and creates .cmd launchers so the commands can be run
from cmd.exe or PowerShell directly.

Usage: powershell -ExecutionPolicy Bypass -File install.ps1

License: MIT
#>

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Text) { Write-Host "[*] $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host "[x] $Text" -ForegroundColor Red }

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetDir = Join-Path $env:LOCALAPPDATA 'TermuxAI\bin'

Write-Info "installing into $TargetDir"
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

foreach ($name in @('termuxai', 'termuxai-harness')) {
    $ps1 = Join-Path $SourceDir "$name.ps1"
    if (-not (Test-Path $ps1)) {
        Write-Fail "missing source file: $ps1"
        exit 1
    }

    Copy-Item $ps1 (Join-Path $TargetDir "$name.ps1") -Force

    $cmd = @"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0$name.ps1" %*
"@
    Set-Content -Path (Join-Path $TargetDir "$name.cmd") -Value $cmd -Encoding ASCII
    Write-Info "installed $name"
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ([string]::IsNullOrEmpty($userPath)) { $userPath = '' }

if ($userPath -notlike "*$TargetDir*") {
    $newPath = if ($userPath.TrimEnd(';')) { $userPath.TrimEnd(';') + ';' + $TargetDir } else { $TargetDir }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Info 'added to user PATH (restart your terminal to pick it up)'
}
else {
    Write-Info 'already on user PATH'
}

Write-Info 'done'
Write-Host ''
Write-Host 'Start the model server first:'
Write-Host '  llama-server.exe -m model.gguf -c 1024 --port 8080'
Write-Host ''
Write-Host 'Then run:'
Write-Host '  termuxai            # offline chat'
Write-Host '  termuxai-harness    # shell agent'
