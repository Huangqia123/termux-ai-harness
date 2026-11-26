#requires -version 5.1
<#
Termux AI Harness - a minimal human-in-the-loop shell agent for Windows,
backed by a local llama.cpp server.

It turns natural language into PowerShell commands, screens them for dangerous
patterns, shows them, and runs them only after explicit confirmation. Chat
questions come back prefixed with TEXT: and are never executed.

Works on Windows PowerShell 5.1 and PowerShell 7+.
License: MIT
#>

$ErrorActionPreference = 'Stop'

$Endpoint = if ($env:TERMUX_AI_URL) { $env:TERMUX_AI_URL } else { 'http://127.0.0.1:8080/v1/chat/completions' }
$Model = if ($env:TERMUX_AI_MODEL) { $env:TERMUX_AI_MODEL } else { '' }
$Temperature = if ($env:TERMUX_AI_TEMPERATURE) { [double]$env:TERMUX_AI_TEMPERATURE } else { 0.1 }
$MaxTokens = if ($env:TERMUX_AI_MAX_TOKENS) { [int]$env:TERMUX_AI_MAX_TOKENS } else { 256 }
$Timeout = if ($env:TERMUX_AI_TIMEOUT) { [int]$env:TERMUX_AI_TIMEOUT } else { 120 }
$AutoRetry = if ($env:TERMUX_AI_AUTO_RETRY) { $env:TERMUX_AI_AUTO_RETRY } else { '0' }
$MaxRetry = if ($env:TERMUX_AI_MAX_RETRY) { [int]$env:TERMUX_AI_MAX_RETRY } else { 2 }

$SystemPrompt = if ($env:TERMUX_AI_HARNESS_SYSTEM) {
    $env:TERMUX_AI_HARNESS_SYSTEM
} else {
    @'
You are Termux AI Harness on Windows, a PowerShell command generator running on a local llama.cpp model.

Decide what the operator actually wants:
- If they ask a question, want an explanation, or are just chatting: reply with TEXT: followed by your answer. Never invent a command in this case.
- If they want something done on the machine: reply with CMD: followed by exactly one PowerShell command. No alternatives, no explanation, no markdown, no comments.

Your reply must begin with CMD: or TEXT: and nothing else. Answer in the language the operator used, but keep the command itself plain ASCII.
'@
}

$DangerPatterns = @(
    'Remove-Item\s+.*-Recurse',
    'Remove-Item\s+.*-Force.*-Recurse',
    'rm\s+-[rf]',
    'del\s+/[sS]',
    'rd\s+/[sS]',
    'format\s+[A-Za-z]:',
    'diskpart',
    'Clear-Disk',
    'Initialize-Disk',
    'Remove-Partition',
    'shutdown',
    'Restart-Computer',
    'Stop-Computer',
    'cipher\s+/w',
    'takeown\s+/[fF]',
    'reg\s+delete',
    'Remove-ItemProperty.*HKLM',
    'Set-ExecutionPolicy\s+Unrestricted',
    'Set-MpPreference.*Disable'
)

function Write-Color([string]$Text, [string]$Color) {
    Write-Host $Text -ForegroundColor $Color
}

function Get-ModelReply([string]$Requirement) {
    $messages = @(
        @{ role = 'system'; content = $SystemPrompt },
        @{ role = 'user'; content = $Requirement }
    )

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

    $raw = $resp.choices[0].message.content
    if (-not $raw) { $raw = $resp.choices[0].text }
    if (-not $raw) {
        Write-Color 'no content in response' 'Red'
        return $null
    }

    return (ConvertFrom-Reply $raw)
}

# Turns a model reply into an object with Type (text|cmd) and Body.
function ConvertFrom-Reply([string]$Raw) {
    $stripped = $Raw -replace '^(?s)\s*(```[a-zA-Z0-9_+-]*\s*)?', ''
    $firstLine = ($stripped -split "`r?`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -First 1)
    if (-not $firstLine) { return $null }

    if ($firstLine -match '^(CMD|TEXT)\s*[:：]' -or $firstLine -match '^【(CMD|TEXT)】' -or $firstLine -match '^\[(CMD|TEXT)\]') {
        $kind = if ($firstLine -match 'CMD') { 'cmd' } else { 'text' }
        $body = $stripped -replace '(?s)^\s*(CMD\s*[:：]|TEXT\s*[:：]|【CMD】|【TEXT】|\[CMD\]|\[TEXT\])\s*', ''
        return [pscustomobject]@{ Type = $kind; Body = $body }
    }

    # No marker: judge by shape. A wrong guess in the text direction only prints
    # the text instead of running it, so the fallback leans to prose.
    $lines = @($stripped -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
    if ($lines.Count -gt 1) {
        return [pscustomobject]@{ Type = 'text'; Body = $stripped }
    }

    $first = ($stripped.Trim() -split '\s+')[0]
    if ($first -and (Get-Command $first -ErrorAction SilentlyContinue) -and $first -match '^[A-Za-z0-9_.\\/-]+$') {
        return [pscustomobject]@{ Type = 'cmd'; Body = $stripped }
    }

    return [pscustomobject]@{ Type = 'text'; Body = $stripped }
}

function ConvertTo-CommandText([string]$Body) {
    $lines = $Body -split "`r?`n" | Where-Object {
        $t = $_.Trim()
        $t -ne '' -and $t -notmatch '^```' -and $t -notmatch '^\s*#'
    } | ForEach-Object { $_.Trim() -replace '^\$\s*', '' }

    if (-not $lines -or $lines.Count -eq 0) { return $null }
    if ($lines.Count -gt 5) { $lines = $lines[0..4] }

    return ($lines -join '; ')
}

function Test-Dangerous([string]$Command) {
    foreach ($p in $DangerPatterns) {
        if ($Command -match $p) { return $p }
    }
    return $null
}

function Invoke-CommandText([string]$Command) {
    Write-Host ''
    Write-Color '--- output ---' 'DarkGray'

    $output = ''
    try {
        $output = (Invoke-Expression $Command 2>&1 | Out-String).Trim()
    }
    catch {
        $output = ($_ | Out-String).Trim()
    }

    $script:LastOutput = $output
    if ($output) { Write-Host $output }

    $code = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }
    Write-Color "--- exit code: $code ---" 'DarkGray'
    return $code
}

Write-Host 'Termux AI Harness' -ForegroundColor Cyan
Write-Host "endpoint: $Endpoint"
Write-Host 'mode: human in the loop (chat is answered, commands are shown and need y)'
Write-Host 'commands: /exit  quit   /help  help'
Write-Host ''

while ($true) {
    Write-Host 'Task> ' -ForegroundColor Cyan -NoNewline
    $request = [Console]::ReadLine()
    if ($null -eq $request) { break }

    $request = $request.Trim()
    if ([string]::IsNullOrWhiteSpace($request)) { continue }

    if ($request -in @('/exit', '/quit', 'exit', 'quit')) {
        Write-Host ''
        Write-Host 'bye.'
        return
    }
    if ($request -eq '/help') {
        Write-Host 'Describe what you want done in plain language, or just ask a question.'
        Write-Host 'Questions are answered directly. Commands are shown first; press y to run.'
        continue
    }

    $attempt = 0
    $context = $request

    while ($true) {
        $reply = Get-ModelReply $context
        if (-not $reply) { break }

        if ($reply.Type -eq 'text') {
            Write-Host ''
            Write-Color 'answer>' 'Green'
            Write-Host $reply.Body
            break
        }

        $command = ConvertTo-CommandText $reply.Body
        if (-not $command) {
            Write-Color 'agent returned no command' 'Yellow'
            break
        }

        $danger = Test-Dangerous $command
        if ($danger) {
            Write-Host ''
            Write-Color '[blocked] dangerous pattern detected, command refused:' 'Red'
            Write-Color $command 'Yellow'
            Write-Color "matched rule: $danger" 'DarkGray'
            break
        }

        Write-Host ''
        Write-Color 'generated>' 'Cyan'
        Write-Color $command 'Yellow'
        Write-Host ''

        if ($AutoRetry -eq '1') {
            $answer = 'y'
        }
        else {
            Write-Host 'run it? [y/N] ' -NoNewline
            $answer = [Console]::ReadLine()
        }

        if ($answer -notmatch '^(y|Y|yes|YES)$') {
            Write-Host 'skipped'
            break
        }

        $code = Invoke-CommandText $command
        if ($code -eq 0) { break }

        $attempt++
        if ($attempt -gt $MaxRetry) {
            Write-Color "gave up after $MaxRetry attempts" 'Yellow'
            break
        }

        Write-Color "retrying with error context ($attempt/$MaxRetry)" 'Yellow'
        $context = @"
$request
The previous command failed:
$command
Its output was:
$script:LastOutput
Reply with a corrected command starting with CMD:.
"@
    }
}
