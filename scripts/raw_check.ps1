# scripts/raw_check.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
$r = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*" -Headers $headers -Method Get
Write-Host "Type:" ($r.GetType().FullName)
Write-Host "Json:" ($r | ConvertTo-Json -Depth 5)
