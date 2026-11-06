$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$tPrats = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*&order=nom' -Headers $headers -Method Get
$tPres = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/presences?select=*' -Headers $headers -Method Get
$tPharm = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/pharmacies?select=*&order=nom' -Headers $headers -Method Get
$tEtab = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/etablissements?select=*&order=nom' -Headers $headers -Method Get
$tFiches = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/fiches_produits?select=*&actif=is.true&order=produit' -Headers $headers -Method Get
$tQuartiers = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/quartiers?select=*&order=quartier' -Headers $headers -Method Get
$tListes = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/listes_reference?select=*&actif=is.true&order=ordre' -Headers $headers -Method Get
$tPlan = Invoke-RestMethod -Uri 'https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/plannings?select=*' -Headers $headers -Method Get
$sw.Stop()

Write-Output "Temps total de lecture : $($sw.ElapsedMilliseconds) ms"
Write-Output "Praticiens: $($tPrats.Count)"
Write-Output "Presences: $($tPres.Count)"
Write-Output "Pharmacies: $($tPharm.Count)"
Write-Output "Etablissements: $($tEtab.Count)"
Write-Output "Fiches produits: $($tFiches.Count)"
Write-Output "Quartiers: $($tQuartiers.Count)"
Write-Output "Listes: $($tListes.Count)"
Write-Output "Plannings: $($tPlan.Count)"
