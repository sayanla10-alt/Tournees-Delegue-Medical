# scripts/check_schema.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}
try {
    $openapi = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/" -Headers $headers -Method Get
    Write-Host "Tables exposées dans l'API :"
    $openapi.definitions.PSObject.Properties.Name | ForEach-Object { Write-Host " - $_" }
    
    Write-Host "`nColonnes de praticiens :"
    $openapi.definitions.praticiens.properties.PSObject.Properties.Name | ForEach-Object { Write-Host "   * $_" }
    
    Write-Host "`nColonnes de pharmacies :"
    $openapi.definitions.pharmacies.properties.PSObject.Properties.Name | ForEach-Object { Write-Host "   * $_" }

    Write-Host "`nColonnes de visites :"
    $openapi.definitions.visites.properties.PSObject.Properties.Name | ForEach-Object { Write-Host "   * $_" }
} catch {
    Write-Host "Erreur : " $_.Exception.Message
}
