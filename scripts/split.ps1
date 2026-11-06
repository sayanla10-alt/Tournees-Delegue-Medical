# scripts/split.ps1 : Découpage modulaire du monolithe app.js en composants distincts
$root = (Get-Location).Path
$appJsPath = Join-Path $root "app.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$lines = [System.IO.File]::ReadAllLines($appJsPath, [System.Text.Encoding]::UTF8)
Write-Output "Total lignes dans app.js : $($lines.Length)"

function ExtraireSlice($debutIndex, $finIndex, $destRelatif) {
    $slice = $lines[$debutIndex..$finIndex]
    $destPath = Join-Path $root $destRelatif
    $destDir = Split-Path $destPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
    [System.IO.File]::WriteAllLines($destPath, $slice, $utf8NoBom)
    Write-Output "Écrit : $destRelatif ($($slice.Length) lignes, L$($debutIndex+1) à L$($finIndex+1))"
}

# 1. src/core/utils.js (L1 à L747)
ExtraireSlice 0 746 "src\core\utils.js"

# 2. src/storage/storage.js (L748 à L1192)
ExtraireSlice 747 1191 "src\storage\storage.js"

# 3. src/core/format.js (L1193 à L2100)
ExtraireSlice 1192 2099 "src\core\format.js"

# 4. src/api/api.js (L2101 à L2423)
ExtraireSlice 2100 2422 "src\api\api.js"

# 5. src/ui/render.js (L2424 à L2826)
ExtraireSlice 2423 2825 "src\ui\render.js"

# 6. src/views/views.js (L2827 à L7143)
ExtraireSlice 2826 7142 "src\views\views.js"

# 7. src/views/feuilles.js (L7144 à L8898)
ExtraireSlice 7143 8897 "src\views\feuilles.js"

# 8. src/engine/engine.js (L8899 à L11733)
ExtraireSlice 8898 11732 "src\engine\engine.js"

# 9. src/ui/lifecycle.js (L11734 à L12137)
ExtraireSlice 11733 12136 "src\ui\lifecycle.js"

Write-Output "Découpage terminé avec succès !"
