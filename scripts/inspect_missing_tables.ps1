# scripts/inspect_missing_tables.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$csvFiches = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\fiches_produits.csv"
$csvQuartiers = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\quartiers.csv"
$csvListes = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\listes.csv"

Write-Host "--- FICHES PRODUITS ---"
$fiches = Import-Csv -Path $csvFiches -Encoding UTF8
Write-Host "Count: $($fiches.Count)"
$fiches | Select-Object -First 3 | Format-Table -Property Produit, Gamme, "DCI et dosage"

Write-Host "--- QUARTIERS ---"
$quartiers = Import-Csv -Path $csvQuartiers -Encoding UTF8
Write-Host "Count: $($quartiers.Count)"
$quartiers | Select-Object -First 3 | Format-Table -Property Commune, Quartier, Zone, Secteur

Write-Host "--- LISTES ---"
$listes = Import-Csv -Path $csvListes -Encoding UTF8
Write-Host "Count: $($listes.Count)"
$prods = $listes | Where-Object { ![string]::IsNullOrWhiteSpace($_.Produits) } | Select-Object -ExpandProperty Produits
Write-Host "Produits dans Listes: $($prods -join ', ')"
$dels = $listes | Where-Object { ![string]::IsNullOrWhiteSpace($_."Délégués") } | Select-Object -ExpandProperty "Délégués"
Write-Host "Délégués dans Listes: $($dels -join ', ')"
