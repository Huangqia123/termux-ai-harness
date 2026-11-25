#requires -version 5.1
<#
Termux AI - offline chat client backed by a local llama.cpp server.

Works on Windows PowerShell 5.1 and PowerShell 7+.
Requires a llama.cpp server listening on the configured endpoint.

License: MIT
#>

$ErrorActionPreference = 'Stop'

$Endpoint = if ($env:TERMUX_AI_URL) { $env:TERMUX_AI_URL } else { 'http://127.0.0.1:8080/v1/chat/completions' }
$Model = if ($env:TERMUX_AI_MODEL) { $env:TERMUX_AI_MODEL } else { '' }
$SystemPrompt = if ($env:TERMUX_AI_SYSTEM) { $env:TERMUX_AI_SYSTEM } else { 'You are Termux AI, a concise assistant running fully offline on a local llama.cpp server. Answer briefly and accurately.' }
$Temperature = if ($env:TERMUX_AI_TEMPERATURE) { [double]$env:TERMUX_AI_TEMPERATURE } else { 0.2 }
$MaxTokens = if ($env:TERMUX_AI_MAX_TOKENS) { [int]$env:TERMUX_AI_MAX_TOKENS } else { 512 }
$Timeout = if ($env:TERMUX_AI_TIMEOUT) { [int]$env:TERMUX_AI_TIMEOUT } else { 120 }

$Conversation = New-Object System.Collections.ArrayList

function Write-Color([string]$Text, [string]$Color) {
    Write-Host $Text -ForegroundColor $Color
}

function Invoke-Chat([string]$UserText) {
    $messages = @()
    $messages += @{ role = 'system'; content = $SystemPrompt }
    foreach ($m in $Conversation) { $messages += $m }
    $messages += @{ role = 'user'; content = $UserText }

    $payload = @{
        messages    = $messages
        temperature = $Temperature
        max_tokens  = $MaxTokens
        stream      = $false
    }
    if ($Model) { $payload.model = $Model }

    $json = $payload | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    try {
        $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $bytes `
            -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec $Timeout
    }
    catch {
        Write-Color "request failed: $($_.Exception.Message)" 'Red'
        Write-Color "is llama-server running at $Endpoint ?" 'DarkGray'
        return $null
    }

    if ($resp.error) {
        $msg = $resp.error
        if ($msg -is [System.Management.Automation.PSCustomObject]) { $msg = $msg.message }
        Write-Color "server error: $msg" 'Red'
        return $null
    }

    $answer = $resp.choices[0].message.content
    if (-not $answer) {
        Write-Color 'unexpected response format' 'Red'
        return $null
    }

    Write-Host ''
    Write-Host 'AI> ' -ForegroundColor Green -NoNewline
    Write-Host $answer

    [void]$Conversation.Add(@{ role = 'user'; content = $UserText })
    [void]$Conversation.Add(@{ role = 'assistant'; content = $answer })
    return $answer
}

Write-Host 'Termux AI' -ForegroundColor Cyan
Write-Host "endpoint: $Endpoint"
Write-Host 'commands: /clear  reset history   /exit  quit'
Write-Host ''

while ($true) {
    Write-Host 'You> ' -ForegroundColor Cyan -NoNewline
    $line = [Console]::ReadLine()
    if ($null -eq $line) { break }

    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    switch ($line) {
        '/exit' { Write-Host ''; Write-Host 'bye.'; return }
        'exit'  { Write-Host ''; Write-Host 'bye.'; return }
        '/quit' { Write-Host ''; Write-Host 'bye.'; return }
        'quit'  { Write-Host ''; Write-Host 'bye.'; return }
        '/clear' {
            $Conversation.Clear()
            Write-Host 'history cleared'
            continue
        }
        '/help' {
            Write-Host 'commands: /clear  /exit'
            continue
        }
        default {
            [void](Invoke-Chat $line)
        }
    }
}
