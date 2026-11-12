# Nap ..\.env vao bien moi truong roi chay qua tools/run_test.py de luu ket qua.
# Cach dung: .\run.ps1 tests/load-login.js -e HOLD=5m
$envFile = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path $envFile)) {
    Write-Error "Không thấy file $envFile"
    exit 1
}
Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim()
}
Push-Location $PSScriptRoot
try {
    python tools/run_test.py @args
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
