# scripts/test_post_error.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}
$body = '{"code":"MED-TEST","nom":"Test","specialite":"Generaliste"}'

try {
    $resp = Invoke-WebRequest -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens" -Headers $headers -Method Post -Body $body
    Write-Output "Status: $($resp.StatusCode)"
    Write-Output $resp.Content
} catch {
    Write-Output "Status code: $($_.Exception.Response.StatusCode.value__)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Output "Body: $($reader.ReadToEnd())"
}
