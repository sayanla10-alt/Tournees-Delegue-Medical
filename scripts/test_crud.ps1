$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Prefer" = "resolution=merge-duplicates,return=minimal"
}
$testVisite = @(
    @{
        uid = "TEST_DUAL_WRITE_1"
        date = "2026-11-06"
        delegue = "Testeur"
        code = "TEST01"
        nom = "Dr Test"
        statut = "Visite faite"
    }
)
$json = $testVisite | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/visites?on_conflict=uid"
$req = [System.Net.HttpWebRequest]::Create($url)
$req.Method = "POST"
foreach ($k in $headers.Keys) { $req.Headers.Add($k, $headers[$k]) }
$req.ContentType = "application/json; charset=utf-8"
$req.ContentLength = $bytes.Length
$s = $req.GetRequestStream()
$s.Write($bytes, 0, $bytes.Length)
$s.Close()
$resp = $req.GetResponse()
Write-Output "HTTP Status: $([int]$resp.StatusCode)"
$resp.Close()

# Verification
$read = Invoke-RestMethod -Uri "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/visites?uid=eq.TEST_DUAL_WRITE_1" -Headers $headers -Method Get
Write-Output "Visite lue: $($read.nom) - Statut: $($read.statut)"

# Nettoyage
$delReq = [System.Net.HttpWebRequest]::Create("https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/visites?uid=eq.TEST_DUAL_WRITE_1")
$delReq.Method = "DELETE"
foreach ($k in $headers.Keys) { if ($k -ne "Prefer") { $delReq.Headers.Add($k, $headers[$k]) } }
$delResp = $delReq.GetResponse()
Write-Output "Suppression test HTTP Status: $([int]$delResp.StatusCode)"
$delResp.Close()
