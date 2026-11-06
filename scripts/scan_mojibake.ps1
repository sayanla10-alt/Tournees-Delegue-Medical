$root = (Get-Location).Path
$files = Get-ChildItem -Path $root -Include *.js, *.html, *.css, *.json, *.webmanifest -Recurse | Where-Object { 
    $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\data_export\\' -and $_.FullName -notmatch '\\scripts\\'
}

$hits = @()

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hasMojibake = $false
    $sample = ""
    for ($i = 0; $i -lt ($bytes.Length - 1); $i++) {
        # 0xC3 0x83 = Ã in UTF-8 (when é/à/etc. was double-encoded)
        # 0xC3 0x82 = Â in UTF-8 (when non-breaking space, quotes or symbols were double-encoded)
        # 0xC3 0x85 = Å in UTF-8
        if ($bytes[$i] -eq 0xC3 -and ($bytes[$i+1] -eq 0x83 -or $bytes[$i+1] -eq 0x82 -or $bytes[$i+1] -eq 0x85)) {
            $hasMojibake = $true
            $start = [Math]::Max(0, $i - 10)
            $len = [Math]::Min(40, $bytes.Length - $start)
            $sample = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $len)
            break
        }
    }
    if ($hasMojibake) {
        $hits += [PSCustomObject]@{
            File = $f.FullName.Substring($root.Length + 1)
            Sample = $sample.Replace("`r", "").Replace("`n", " ")
        }
    }
}

Write-Output "Nombre de fichiers avec mojibake double-UTF8: $($hits.Count)"
$hits | Format-Table -AutoSize
