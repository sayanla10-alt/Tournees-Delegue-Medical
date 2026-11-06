# scripts/import_missing_to_supabase.ps1
param (
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json; charset=utf-8"
    "Prefer" = "resolution=merge-duplicates,return=minimal"
}

function Convert-Coord ($val) {
    if ([string]::IsNullOrWhiteSpace($val)) { return $null }
    $s = $val.Trim().Replace(',', '.')
    $d = 0.0
    if ([double]::TryParse($s, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$d)) {
        return $d
    }
    return $null
}

function Post-Batch ($table, $batch) {
    $url = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1/$table"
    $json = $batch | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = "POST"
    foreach ($k in $headers.Keys) {
        if ($k -eq "Content-Type") { continue }
        $req.Headers.Add($k, $headers[$k])
    }
    $req.ContentType = "application/json; charset=utf-8"
    $req.ContentLength = $bytes.Length

    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    $resp = $req.GetResponse()
    $resp.Close()
}

Write-Host "=== IMPORT DES TABLES MANQUANTES VERS SUPABASE ==="

# 1. Fiches Produits
$csvFiches = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\fiches_produits.csv"
if (Test-Path $csvFiches) {
    Write-Host "`n--- Import Fiches Produits ---"
    $rows = Import-Csv -Path $csvFiches -Encoding UTF8
    $batch = @()
    $vus = @{}
    foreach ($r in $rows) {
        $prod = [string]$r.Produit
        if ([string]::IsNullOrWhiteSpace($prod)) { continue }
        $prod = $prod.Trim()
        if ($vus.ContainsKey($prod)) { continue }
        $vus[$prod] = $true

        $actif = $true
        if (-not [string]::IsNullOrWhiteSpace($r.Actif)) {
            $a = $r.Actif.Trim().ToLower()
            if ($a -eq "false" -or $a -eq "faux" -or $a -eq "0" -or $a -eq "non") { $actif = $false }
        }

        $item = @{
            produit = $prod
            gamme = [string]$r.Gamme
            aire = [string]$r."Aire thérapeutique"
            dci = [string]$r."DCI et dosage"
            classe = [string]$r.Classe
            indications = [string]$r.Indications
            contre_indications = [string]$r."Contre-indications"
            posologie = [string]$r.Posologie
            precautions = [string]$r."Précautions et interactions"
            effets = [string]$r."Effets indésirables"
            arguments = [string]$r."Arguments clés"
            laboratoire = [string]$r.Laboratoire
            sources = [string]$r.Sources
            actif = $actif
        }
        $batch += $item
    }

    Write-Host "Total Fiches valides: $($batch.Count)"
    if (-not $DryRun) {
        for ($i = 0; $i -lt $batch.Count; $i += 30) {
            $end = [Math]::Min($i + 30, $batch.Count)
            $sub = $batch[$i..($end - 1)]
            Post-Batch "fiches_produits" $sub
            Write-Host "  Fiches $i a $end envoyees."
        }
    }
}

# 2. Quartiers
$csvQuartiers = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\quartiers.csv"
if (Test-Path $csvQuartiers) {
    Write-Host "`n--- Import Quartiers ---"
    $rows = Import-Csv -Path $csvQuartiers -Encoding UTF8
    $batch = @()
    $vus = @{}
    foreach ($r in $rows) {
        $commune = [string]$r.Commune
        $quartier = [string]$r.Quartier
        if ([string]::IsNullOrWhiteSpace($commune) -or [string]::IsNullOrWhiteSpace($quartier)) { continue }
        $commune = $commune.Trim()
        $quartier = $quartier.Trim()
        $cle = "$commune::$quartier"
        if ($vus.ContainsKey($cle)) { continue }
        $vus[$cle] = $true

        $item = @{
            commune = $commune
            quartier = $quartier
            zone = [string]$r.Zone
            lat = Convert-Coord $r.Latitude
            lon = Convert-Coord $r.Longitude
            secteur = [string]$r.Secteur
        }
        $batch += $item
    }

    Write-Host "Total Quartiers valides: $($batch.Count)"
    if (-not $DryRun) {
        for ($i = 0; $i -lt $batch.Count; $i += 50) {
            $end = [Math]::Min($i + 50, $batch.Count)
            $sub = $batch[$i..($end - 1)]
            Post-Batch "quartiers" $sub
            Write-Host "  Quartiers $i a $end envoyes."
        }
    }
}

# 3. Listes de référence
$csvListes = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\listes.csv"
if (Test-Path $csvListes) {
    Write-Host "`n--- Import Listes de reference ---"
    $rows = Import-Csv -Path $csvListes -Encoding UTF8
    $batch = @()
    $vus = @{}

    function Add-ListItem ($cat, $val, $meta, $ordre) {
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
        if (-not [string]::IsNullOrWhiteSpace($r.Produits)) {
            Add-ListItem "produit" $r.Produits $null $idx
        }
        if (-not [string]::IsNullOrWhiteSpace($r."Délégués")) {
            Add-ListItem "delegue" $r."Délégués" $null $idx
        }
        if (-not [string]::IsNullOrWhiteSpace($r.Statut)) {
            $visite = ($r.CompteCommeVisite -and $r.CompteCommeVisite.Trim().ToLower() -eq "oui")
            Add-ListItem "statut" $r.Statut @{ compte_comme_visite = $visite } $idx
        }
        if (-not [string]::IsNullOrWhiteSpace($r."Activités")) {
            Add-ListItem "activite" $r."Activités" $null $idx
        }
        if (-not [string]::IsNullOrWhiteSpace($r."ActivitésPharmacie")) {
            Add-ListItem "activite_pharmacie" $r."ActivitésPharmacie" $null $idx
        }
        if (-not [string]::IsNullOrWhiteSpace($r."JoursFériés")) {
            Add-ListItem "ferie" $r."JoursFériés" $null $idx
        }
    }

    Write-Host "Total Listes de reference: $($batch.Count)"
    if (-not $DryRun) {
        for ($i = 0; $i -lt $batch.Count; $i += 50) {
            $end = [Math]::Min($i + 50, $batch.Count)
            $sub = $batch[$i..($end - 1)]
            Post-Batch "listes_reference" $sub
            Write-Host "  Listes $i a $end envoyees."
        }
    }
}

Write-Host "`n=== IMPORT TERMINE ==="
