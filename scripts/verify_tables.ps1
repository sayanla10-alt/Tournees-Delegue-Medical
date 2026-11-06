# scripts/verify_tables.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

$tables = @("praticiens", "presences", "pharmacies", "etablissements", "visites", "plannings", "rapports")
$allOk = $true

foreach ($t in $tables) {
    $url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/$t`?select=*"
    try {
        $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        Write-Output "Table [$t] : OPERATIONNELLE (0 erreur, $($resp.Count) enregistrements)"
    } catch {
        $allOk = $false
        Write-Output "Table [$t] : ERREUR - $($_.Exception.Message)"
    }
}

if ($allOk) {
    Write-Output "`nTOUTES LES TABLES SONT CREEES ET EN LIGNE SUR SUPABASE !"
}
