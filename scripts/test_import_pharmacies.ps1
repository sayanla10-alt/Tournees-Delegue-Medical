# scripts/test_import_pharmacies.ps1
$csv = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\pharmacies.csv"
Write-Host "Colonnes du CSV Pharmacies:"
$csv[0].PSObject.Properties.Name | ForEach-Object { Write-Host " - $_" }
Write-Host "`nExemple de première ligne:"
$csv[0] | Out-String | Write-Host
