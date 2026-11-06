# scripts/count_csv.ps1
$files = Get-ChildItem "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\*.csv"
foreach ($f in $files) {
    $count = (Get-Content $f.FullName | Measure-Object -Line).Lines
    Write-Host "$($f.Name) : $($count - 1) lignes"
}
