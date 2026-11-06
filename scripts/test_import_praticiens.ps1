# scripts/test_import_praticiens.ps1
$csv = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\praticiens.csv"
Write-Host "Colonnes du CSV Praticiens:"
$csv[0].PSObject.Properties.Name | ForEach-Object { Write-Host " - $_" }
Write-Host "`nExemple de première ligne:"
$csv[0] | Out-String | Write-Host
