# scripts/test_key.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens?select=*"

# Test 1: Only apikey
try {
    $h1 = @{ "apikey" = $key }
    $r1 = Invoke-RestMethod -Uri $url -Headers $h1 -Method Get
    Write-Output "Test 1 (only apikey) : SUCCES ! Compte = $($r1.Count)"
} catch {
    Write-Output "Test 1 : Echec ($($_.Exception.Message))"
}

# Test 2: apikey + Bearer
try {
    $h2 = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
    $r2 = Invoke-RestMethod -Uri $url -Headers $h2 -Method Get
    Write-Output "Test 2 (apikey + bearer) : SUCCES ! Compte = $($r2.Count)"
} catch {
    Write-Output "Test 2 : Echec ($($_.Exception.Message))"
}
