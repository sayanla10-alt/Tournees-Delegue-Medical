$root = (Get-Location).Path
$jsFiles = Get-ChildItem -Path $root -Filter *.js -Recurse | Where-Object { 
    $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\scripts\\' 
}

$pattern = "[\u00C3][\u0080-\u00BF]|[\u00C2][\u0080-\u00BF]|[\u00E2]\u20AC"

$foundAny = $false
foreach ($f in $jsFiles) {
    $txt = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $matches = [System.Text.RegularExpressions.Regex]::Matches($txt, $pattern)
    if ($matches.Count -gt 0) {
        $foundAny = $true
        $rel = $f.FullName.Substring($root.Length + 1)
        Write-Output "Fichier $rel : $($matches.Count) mojibake !"
        $ex = [System.Text.RegularExpressions.Regex]::Matches($txt, ".{0,20}($pattern).{0,20}")
        foreach ($m in ($ex | Select-Object -First 3)) {
            $val = $m.Value.Trim()
            Write-Output "   -> $val"
        }
    }
}

if (-not $foundAny) {
    Write-Output "TOUS LES FICHIERS JS SONT 100% PROPRES (0 mojibake)."
}
