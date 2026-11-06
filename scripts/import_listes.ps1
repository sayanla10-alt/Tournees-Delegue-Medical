$ErrorActionPreference = "Stop"

$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Prefer" = "resolution=merge-duplicates,return=minimal"
}

function Post-Batch ($table, $batch) {
    $url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/" + $table + "?on_conflict=categorie,valeur"
    $json = $batch | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = "POST"
    foreach ($k in $headers.Keys) {
        $req.Headers.Add($k, $headers[$k])
    }
    $req.ContentType = "application/json; charset=utf-8"
    $req.ContentLength = $bytes.Length

    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    try {
        $resp = $req.GetResponse()
        $resp.Close()
    } catch [System.Net.WebException] {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Error "PostgREST Error: $errBody"
    }
}

$rows = Import-Csv -Path "data_export\listes.csv" -Encoding UTF8
$batch = @()
$vus = @{}

function Add-Item ($cat, $val, $meta, $ordre) {
    if ([string]::IsNullOrWhiteSpace($val)) { return }
    $v = $val.Trim()
    $cle = "$cat::$v"
    if ($vus.ContainsKey($cle)) { return }
    $vus[$cle] = $true
    $script:batch += @{
        categorie = $cat
        valeur = $v
        metadata = $meta
        ordre = $ordre
        actif = $true
    }
}

$idx = 0
foreach ($r in $rows) {
    $idx++
    $props = $r.PSObject.Properties
    foreach ($p in $props) {
        $n = $p.Name
        $v = [string]$p.Value
        if ([string]::IsNullOrWhiteSpace($v)) { continue }
        if ($n -like "*Statut*") {
            $vis = ($r.CompteCommeVisite -and $r.CompteCommeVisite.Trim().ToLower() -eq "oui")
            Add-Item "statut" $v @{ compte_comme_visite = $vis } $idx
        }
        elseif ($n -like "*D*l*gu*") { Add-Item "delegue" $v $null $idx }
        elseif ($n -like "*Produit*") { Add-Item "produit" $v $null $idx }
        elseif ($n -like "*Activit*Pharmacie*") { Add-Item "activite_pharmacie" $v $null $idx }
        elseif ($n -like "*Activit*") { Add-Item "activite" $v $null $idx }
        elseif ($n -like "*F*ri*") { Add-Item "ferie" $v $null $idx }
    }
}

Write-Output "Nombre total d'elements trouves dans listes: $($batch.Count)"
if ($batch.Count -gt 0) {
    Post-Batch "listes_reference" $batch
    Write-Output "Listes envoyees avec succes a Supabase !"
}
