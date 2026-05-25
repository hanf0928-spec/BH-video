$port = 8765
$root = $PSScriptRoot

# Step 1: make sure the port is free first.
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($procId in ($existing | Select-Object -ExpandProperty OwningProcess -Unique)) {
        try {
            $p = Get-Process -Id $procId -ErrorAction Stop
            Stop-Process -Id $procId -Force
            Write-Host ("Stopped previous server: PID {0} ({1})" -f $procId, $p.ProcessName)
        } catch {
            Write-Host ("PID {0} already gone" -f $procId)
        }
    }
    Start-Sleep -Milliseconds 400
}

# Step 2: locate a real Python 3 executable.
# We deliberately avoid `python3` because on Windows it is usually a
# Microsoft Store App Execution Alias stub that silently swallows the
# command instead of running Python.
$python3Exe = $null

# 2a. The Python launcher `py -3` is the most reliable way on Windows.
$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) {
    $resolved = & $py.Source -3 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $resolved) {
        $python3Exe = $resolved.Trim()
    }
}

# 2b. Fallback: any `python` on PATH that is NOT the WindowsApps stub.
if (-not $python3Exe) {
    foreach ($cmd in (Get-Command python -All -ErrorAction SilentlyContinue)) {
        if ($cmd.Source -and $cmd.Source -notlike "*\WindowsApps\*") {
            $python3Exe = $cmd.Source
            break
        }
    }
}

if (-not $python3Exe) {
    Write-Error "No real Python 3 interpreter found. Please install Python 3 from https://www.python.org/downloads/."
    exit 1
}

Write-Host ("Using Python 3 interpreter: {0}" -f $python3Exe)
$ver = & $python3Exe --version 2>&1
Write-Host ("                   Version: {0}" -f $ver)

# Step 3: start the static file server in the background.
$logOut = Join-Path $root ".server.log"
$logErr = Join-Path $root ".server.err.log"

$proc = Start-Process -FilePath $python3Exe `
    -ArgumentList @("-m", "http.server", "$port", "--bind", "127.0.0.1") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError  $logErr `
    -PassThru

Start-Sleep -Milliseconds 800

# Step 4: verify the server is actually listening.
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Error ("Server failed to start. Check log: {0}" -f $logErr)
    if (Test-Path $logErr) { Get-Content $logErr | Select-Object -Last 20 }
    exit 1
}

Write-Host ""
Write-Host "==================================================="
Write-Host (" BH-video server is running")
Write-Host (" PID  : {0}" -f $proc.Id)
Write-Host (" URL  : http://127.0.0.1:{0}/index.html" -f $port)
Write-Host (" Root : {0}" -f $root)
Write-Host (" Log  : {0}" -f $logOut)
Write-Host (" Stop : powershell -ExecutionPolicy Bypass -File `"{0}\.stopserver.ps1`"" -f $root)
Write-Host "==================================================="
