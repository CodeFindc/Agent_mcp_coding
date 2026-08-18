$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\apps\web"
$env:NEXT_PUBLIC_API_BASE = if ($env:NEXT_PUBLIC_API_BASE) { $env:NEXT_PUBLIC_API_BASE } else { "http://localhost:8080" }
$env:npm_config_registry = if ($env:npm_config_registry) { $env:npm_config_registry } else { "https://registry.npmmirror.com" }
npm run dev
