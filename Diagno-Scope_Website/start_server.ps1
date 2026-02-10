
Write-Host "Starting Multi-Service Backend..."
$backendPath = Join-Path $PSScriptRoot "backend"
cd $backendPath

Start-Process uvicorn -ArgumentList "api_fracture:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $backendPath
Start-Process uvicorn -ArgumentList "api_tumor:app --host 127.0.0.1 --port 8001 --reload" -WorkingDirectory $backendPath
Start-Process uvicorn -ArgumentList "api_dr:app --host 127.0.0.1 --port 8002 --reload" -WorkingDirectory $backendPath
Write-Host "Services started on Ports 8000 (Fracture), 8001 (Tumor), 8002 (DR)."
read-host "Press Enter to exit..."
