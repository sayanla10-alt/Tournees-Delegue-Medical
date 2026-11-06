# scripts/check_presences.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
$pres = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/presences?select=*" -Headers $headers -Method Get
Write-Output "Nombre de présences : $($pres.Count)"
$pres | ForEach-Object { Write-Output " - $($_.id) : $($_.nom) -> $($_.lieu) ($($_.commune)) [GPS: $($_.lat), $($_.lon)]" }
