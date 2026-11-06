# scripts/test_load_supabase.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }

$sw = [System.Diagnostics.Stopwatch]::StartNew()

$uP = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*&order=nom"
$uR = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/presences?select=*"
$uE = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/etablissements?select=*"

$p = Invoke-RestMethod -Uri $uP -Headers $headers -Method Get
$r = Invoke-RestMethod -Uri $uR -Headers $headers -Method Get
$e = Invoke-RestMethod -Uri $uE -Headers $headers -Method Get

$sw.Stop()

Write-Host "Chargement Supabase termine en $($sw.ElapsedMilliseconds) ms !"
Write-Host " - Praticiens : $($p.Count)"
Write-Host " - Presences : $($r.Count)"
Write-Host " - Etablissements : $($e.Count)"
