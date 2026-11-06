# scripts/test_insert.ps1
$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

$body = @{
    code = "MED-001"
    nom = "Dr Kouassi Marcel"
    specialite = "Cardiologue"
    note = 3
    telephone = "07 07 12 34 56"
    actif = $true
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/praticiens" -Headers $headers -Method Post -Body $body
    Write-Output "SUCCES INSERTION PRATICIEN !"
    Write-Output ($resp | ConvertTo-Json)
} catch {
    Write-Output "ERREUR INSERTION :"
    Write-Output $_.Exception.Message
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Output $reader.ReadToEnd()
    }
}
