# scripts/test_insert_rls.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$body = '{"code":"TEST-RLS","nom":"Docteur Test RLS","specialite":"Testeur"}'
try {
    $resp = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens" -Headers $headers -Method Post -Body $body
    Write-Output "INSERT SUCCES : $($resp.nom) ($($resp.code))"
    
    # Nettoyage
    Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?code=eq.TEST-RLS" -Headers $headers -Method Delete
    Write-Output "DELETE SUCCES (Nettoyage OK)"
} catch {
    Write-Output "ERREUR INSERT : $($_.Exception.Message)"
}
