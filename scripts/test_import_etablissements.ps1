# scripts/test_import_etablissements.ps1
$csv = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\etablissements.csv"
Write-Host "Colonnes du CSV Etablissements:"
$csv[0].PSObject.Properties.Name | ForEach-Object { Write-Host " - $_" }
Write-Host "`nExemple de première ligne:"
$csv[0] | Out-String | Write-Host
