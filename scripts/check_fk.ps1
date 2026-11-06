# scripts/check_fk.ps1
$prats = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\praticiens.csv"
$phars = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\pharmacies.csv"
$pres = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\presences.csv"

$pratCodes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$prats | ForEach-Object { if ($_.CodeContact) { [void]$pratCodes.Add($_.CodeContact.Trim()) } }

$pharCodes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$phars | ForEach-Object { if ($_.CodeContact) { [void]$pharCodes.Add($_.CodeContact.Trim()) } }

$missing = @()
$inPhar = @()
foreach ($p in $pres) {
    $c = $p.CodeContact.Trim()
    if (-not $pratCodes.Contains($c)) {
        if ($pharCodes.Contains($c)) {
            $inPhar += $c
        } else {
            $missing += $c
        }
    }
}

Write-Host "Total presences: $($pres.Count)"
Write-Host "Presences avec CodeContact dans Pharmacies: $($inPhar.Count)"
Write-Host "Presences avec CodeContact introuvable dans Praticiens: $($missing.Count)"
if ($missing.Count -gt 0) {
    Write-Host "Exemples introuvables: $(($missing | Select-Object -Unique -First 5) -join ', ')"
}
