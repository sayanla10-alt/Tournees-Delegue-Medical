# scripts/inspect_api.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Prefer" = "count=exact"
}
try {
    $resp = Invoke-WebRequest -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*" -Headers $headers -Method Get -UseBasicParsing
    Write-Host "Status:" $resp.StatusCode
    Write-Host "Content-Range:" $resp.Headers["Content-Range"]
    Write-Host "Body:" $resp.Content
} catch {
    Write-Host "Error:" $_.Exception.Message
}
