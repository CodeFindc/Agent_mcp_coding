$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\apps\web"
$env:NEXT_PUBLIC_API_BASE = if ($env:NEXT_PUBLIC_API_BASE) { $env:NEXT_PUBLIC_API_BASE } else { "http://localhost:8080" }
npm run dev
