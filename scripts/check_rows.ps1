# scripts/check_rows.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

$prat = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*" -Headers $headers -Method Get
Write-Output "Nombre de praticiens : $($prat.Count)"
$prat | ForEach-Object { Write-Output " - $($_.code) : $($_.nom) ($($_.specialite))" }

$phar = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/pharmacies?select=*" -Headers $headers -Method Get
Write-Output "`nNombre de pharmacies : $($phar.Count)"
$phar | ForEach-Object { Write-Output " - $($_.code) : $($_.nom) ($($_.commune))" }
