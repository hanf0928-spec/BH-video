$pids = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
    Write-Host "No process is listening on port 8765 — nothing to stop."
} else {
    foreach ($procId in $pids) {
        try {
            $p = Get-Process -Id $procId -ErrorAction Stop
            Stop-Process -Id $procId -Force
            Write-Host ("Stopped PID {0} ({1})" -f $procId, $p.ProcessName)
        } catch {
            Write-Host ("PID {0} already gone" -f $procId)
        }
    }
}

Start-Sleep -Milliseconds 500

if (Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue) {
    Write-Host "Port 8765 is still LISTENING"
} else {
    Write-Host "Port 8765 is FREE"
}
