# scripts/bump_v3281.ps1
$root = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner"

# 1. version.json
$vPath = Join-Path $root "version.json"
(Get-Content $vPath -Raw).Replace('"version": "3.28.0"', '"version": "3.28.1"') | Set-Content $vPath -NoNewline

# 2. sw.js
$swPath = Join-Path $root "sw.js"
(Get-Content $swPath -Raw).Replace("var VERSION = '3.28.0';", "var VERSION = '3.28.1';") | Set-Content $swPath -NoNewline

# 3. src/core/utils.js
$uPath = Join-Path $root "src\core\utils.js"
(Get-Content $uPath -Raw).Replace("var APP_VERSION = '3.28.0';", "var APP_VERSION = '3.28.1';") | Set-Content $uPath -NoNewline

# 4. index.html
$hPath = Join-Path $root "index.html"
$h = Get-Content $hPath -Raw
$h = $h.Replace("v3.28.0", "v3.28.1")
$h = $h.Replace("3.28.0", "3.28.1")
$h | Set-Content $hPath -NoNewline

# 5. Rebuild app.js
Set-Location $root
& ".\scripts\build.ps1"
Write-Host "Bump v3.28.1 termine !"
