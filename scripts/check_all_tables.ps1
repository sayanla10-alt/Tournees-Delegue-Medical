# scripts/check_all_tables.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

$tables = @("praticiens", "presences", "pharmacies", "etablissements", "visites", "plannings", "rapports")
foreach ($t in $tables) {
    $url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/$t`?select=*"
    try {
        $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        Write-Output "Table [$t] : OK (compte = $($resp.Count))"
    } catch {
        Write-Output "Table [$t] : MANQUANTE ou ERREUR ($($_.Exception.Message))"
    }
}
