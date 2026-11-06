# scripts/build.ps1 : Assemblage des modules de src/ vers le bundle de production app.js
$root = (Get-Location).Path
$appJsPath = Join-Path $root "app.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$modules = @(
    "src\core\utils.js",
    "src\storage\storage.js",
    "src\core\format.js",
    "src\api\supabase.js",
    "src\api\api.js",
    "src\ui\render.js",
    "src\views\accueil.js",
    "src\views\jour.js",
    "src\views\planifier.js",
    "src\views\produits.js",
    "src\views\autour.js",
    "src\views\equipe.js",
    "src\views\repertoire.js",
    "src\views\suivi.js",
    "src\views\reglages.js",
    "src\views\feuilles.js",
    "src\engine\export.js",
    "src\engine\planning.js",
    "src\engine\actions.js",
    "src\ui\lifecycle.js"
)

$sb = New-Object System.Text.StringBuilder

foreach ($mod in $modules) {
    $modPath = Join-Path $root $mod
    if (-not (Test-Path $modPath)) {
        Write-Error "Module manquant : $mod"
        exit 1
    }
    $text = [System.IO.File]::ReadAllText($modPath, [System.Text.Encoding]::UTF8)
    [void]$sb.Append($text)
    if (-not $text.EndsWith("`r`n") -and -not $text.EndsWith("`n")) {
        [void]$sb.Append("`r`n")
    }
    Write-Output "Inclus : $mod"
}

[System.IO.File]::WriteAllText($appJsPath, $sb.ToString().TrimEnd() + "`r`n", $utf8NoBom)
Write-Output "Build termine avec succes : app.js regenere ($($modules.Count) modules)"
