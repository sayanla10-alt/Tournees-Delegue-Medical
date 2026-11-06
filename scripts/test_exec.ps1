# scripts/test_exec.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}

$endpoints = @(
    "https://nldyinokqgshnzvdsxgr.supabase.co/pg/query",
    "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/rpc/exec",
    "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/rpc/query"
)

foreach ($ep in $endpoints) {
    try {
        $body = '{"query":"SELECT 1;"}'
        $resp = Invoke-RestMethod -Uri $ep -Headers $headers -Method Post -Body $body
        Write-Output "SUCCES sur $ep !"
        Write-Output ($resp | ConvertTo-Json)
    } catch {
        Write-Output "ECHEC sur $ep : $($_.Exception.Message)"
    }
}
