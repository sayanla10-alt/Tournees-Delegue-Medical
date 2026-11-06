$lines = [System.IO.File]::ReadAllLines("app.js", [System.Text.Encoding]::UTF8)
$count = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($lines[$i])
    for ($j = 0; $j -lt ($bytes.Length - 1); $j++) {
        if ($bytes[$j] -eq 0xC3 -and $bytes[$j+1] -eq 0x83) {
            Write-Output "Ligne $($i+1): $($lines[$i])"
            $count++
            break
        }
    }
}
if ($count -eq 0) {
    Write-Output "VERIFICATION ENCODAGE : ZERO MOJIBAKE ! app.js est 100% propre."
} else {
    Write-Error "Total mojibake: $count"
}
