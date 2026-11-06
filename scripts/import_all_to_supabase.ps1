# scripts/import_all_to_supabase.ps1
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

function Convert-DateToIso ($val) {
    if ([string]::IsNullOrWhiteSpace($val)) { return $null }
    $s = $val.Trim()
    if ($s -match '^(\d{1,2})/(\d{1,2})/(\d{4})') {
        $day = $matches[1].PadLeft(2, '0')
        $month = $matches[2].PadLeft(2, '0')
        $year = $matches[3]
        return "$year-$month-$day"
    }
    if ($s -match '^\d{4}-\d{2}-\d{2}') { return $s }
    return $null
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
    $req.ContentType = "application/json; charset=utf-8"
    $req.Headers.Add("apikey", $key)
    $req.Headers.Add("Authorization", "Bearer $key")
    $req.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal")
    $req.ContentLength = $bytes.Length
    
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    
    try {
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch [System.Net.WebException] {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        throw "Erreur HTTP ($table): $errBody"
    }
}

Write-Host "=== IMPORTATION DE LA BASE GOOGLE SHEETS DANS SUPABASE ==="

# -------------------------------------------------------------------------
# 1. PRATICIENS
# -------------------------------------------------------------------------
Write-Host "`n1. Lecture de praticiens.csv..."
$csvPrats = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\praticiens.csv"
$pratRows = @()

foreach ($r in $csvPrats) {
    $code = $r.CodeContact.Trim()
    $nom = $r.Nom.Trim()
    if (-not $code -or -not $nom) { continue }
    
    $note = 2
    if ($r.Note -match '^[1-3]$') { $note = [int]$r.Note }
    $nbVis = 0
    if ($r.NbVisites -match '^\d+$') { $nbVis = [int]$r.NbVisites }
    
    $pratRows += @{
        code = $code
        type = if ($r.Type) { $r.Type.Trim() } else { "Médecin" }
        nom = $nom
        specialite = if ($r.'Spécialité') { $r.'Spécialité'.Trim() } else { "Généraliste" }
        note = $note
        conventionne = ($r.'Engagé' -eq 'Oui' -or $r.'Conventionné' -eq 'Oui')
        telephone = if ($r.'Téléphone') { $r.'Téléphone'.Trim() } else { $null }
        derniere = Convert-DateToIso $r.DateDerniereVisite
        statut = if ($r.DernierStatut) { $r.DernierStatut.Trim() } else { $null }
        commentaire = if ($r.DernierCommentaire) { $r.DernierCommentaire.Trim() } else { $null }
        nb_visites = $nbVis
        actif = ($r.Actif -ne 'Non')
    }
}

Write-Host "   -> $($pratRows.Count) praticiens prepares. Envoi a Supabase..."
for ($i = 0; $i -lt $pratRows.Count; $i += 100) {
    $end = [Math]::Min($i + 99, $pratRows.Count - 1)
    $batch = $pratRows[$i..$end]
    Post-Batch "praticiens" $batch
    Write-Host "   Praticiens: $($end + 1) / $($pratRows.Count)"
}

# -------------------------------------------------------------------------
# 2. PHARMACIES
# -------------------------------------------------------------------------
Write-Host "`n2. Lecture de pharmacies.csv..."
$csvPhar = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\pharmacies.csv"
$pharRows = @()

foreach ($r in $csvPhar) {
    $code = $r.CodeContact.Trim()
    $nom = $r.Nom.Trim()
    if (-not $code -or -not $nom) { continue }
    
    $note = 2
    if ($r.Note -match '^[1-3]$') { $note = [int]$r.Note }
    $nbVis = 0
    if ($r.NbVisites -match '^\d+$') { $nbVis = [int]$r.NbVisites }
    
    $pharRows += @{
        code = $code
        nom = $nom
        titulaire = if ($r.Titulaire) { $r.Titulaire.Trim() } else { $null }
        quartier = if ($r.Quartier) { $r.Quartier.Trim() } else { $null }
        commune = if ($r.Commune) { $r.Commune.Trim() } else { "Abidjan" }
        zone = if ($r.Zone) { $r.Zone.Trim() } else { $null }
        lat = Convert-Coord $r.Latitude
        lon = Convert-Coord $r.Longitude
        telephone = if ($r.'Téléphone') { $r.'Téléphone'.Trim() } else { $null }
        horaire_matin = if ($r.HoraireMatin) { $r.HoraireMatin.Trim() } else { $null }
        horaire_soir = if ($r.HoraireSoir) { $r.HoraireSoir.Trim() } else { $null }
        note = $note
        conventionne = ($r.'Engagé' -eq 'Oui' -or $r.'Conventionné' -eq 'Oui')
        derniere = Convert-DateToIso $r.DateDerniereVisite
        statut = if ($r.DernierStatut) { $r.DernierStatut.Trim() } else { $null }
        commentaire = if ($r.DernierCommentaire) { $r.DernierCommentaire.Trim() } else { $null }
        nb_visites = $nbVis
        actif = ($r.Actif -ne 'Non')
    }
}

Write-Host "   -> $($pharRows.Count) pharmacies preparees. Envoi a Supabase..."
for ($i = 0; $i -lt $pharRows.Count; $i += 100) {
    $end = [Math]::Min($i + 99, $pharRows.Count - 1)
    $batch = $pharRows[$i..$end]
    Post-Batch "pharmacies" $batch
    Write-Host "   Pharmacies: $($end + 1) / $($pharRows.Count)"
}

# -------------------------------------------------------------------------
# 3. PRESENCES
# -------------------------------------------------------------------------
Write-Host "`n3. Lecture de presences.csv..."
$csvPres = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\presences.csv"
$presRows = @()

foreach ($r in $csvPres) {
    $id = if ($r.IdPresence) { $r.IdPresence.Trim() } else { $null }
    $code = if ($r.CodeContact) { $r.CodeContact.Trim() } else { $null }
    $lieu = if ($r.'Lieu/Etablissement') { $r.'Lieu/Etablissement'.Trim() } else { $null }
    if (-not $code -or -not $lieu) { continue }
    if (-not $id) { $id = "$code" + "_" + ($lieu -replace '\s+', '_') }
    
    $presRows += @{
        id = $id
        code = $code
        nom = if ($r.Nom) { $r.Nom.Trim() } else { $null }
        lieu = $lieu
        quartier = if ($r.Quartier) { $r.Quartier.Trim() } else { $null }
        commune = if ($r.Commune) { $r.Commune.Trim() } else { "Abidjan" }
        zone = if ($r.Zone) { $r.Zone.Trim() } else { $null }
        lundi = if ($r.Lundi) { $r.Lundi.Trim() } else { $null }
        mardi = if ($r.Mardi) { $r.Mardi.Trim() } else { $null }
        mercredi = if ($r.Mercredi) { $r.Mercredi.Trim() } else { $null }
        jeudi = if ($r.Jeudi) { $r.Jeudi.Trim() } else { $null }
        vendredi = if ($r.Vendredi) { $r.Vendredi.Trim() } else { $null }
        horaire_matin = if ($r.HoraireMatin) { $r.HoraireMatin.Trim() } else { $null }
        horaire_soir = if ($r.HoraireSoir) { $r.HoraireSoir.Trim() } else { $null }
        lat = Convert-Coord $r.Latitude
        lon = Convert-Coord $r.Longitude
        reperes = if ($r.'Repères') { $r.'Repères'.Trim() } else { $null }
    }
}

Write-Host "   -> $($presRows.Count) presences preparees. Envoi a Supabase..."
for ($i = 0; $i -lt $presRows.Count; $i += 100) {
    $end = [Math]::Min($i + 99, $presRows.Count - 1)
    $batch = $presRows[$i..$end]
    Post-Batch "presences" $batch
    Write-Host "   Presences: $($end + 1) / $($presRows.Count)"
}

# -------------------------------------------------------------------------
# 4. ETABLISSEMENTS
# -------------------------------------------------------------------------
Write-Host "`n4. Lecture de etablissements.csv..."
$csvEtab = Import-Csv "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\data_export\etablissements.csv"
$etabRows = @()

foreach ($r in $csvEtab) {
    $code = if ($r.CodeEtab) { $r.CodeEtab.Trim() } else { $null }
    $nom = if ($r.Nom) { $r.Nom.Trim() } else { $null }
    if (-not $code -or -not $nom) { continue }
    
    $etabRows += @{
        code = $code
        nom = $nom
        categorie = if ($r.Categorie) { $r.Categorie.Trim() } else { $null }
        commune = if ($r.Commune) { $r.Commune.Trim() } else { "Abidjan" }
        quartier = if ($r.Quartier) { $r.Quartier.Trim() } else { $null }
        zone = if ($r.Zone) { $r.Zone.Trim() } else { $null }
        lat = Convert-Coord $r.Latitude
        lon = Convert-Coord $r.Longitude
        telephone = if ($r.Telephone) { $r.Telephone.Trim() } else { $null }
        reperes = if ($r.Reperes) { $r.Reperes.Trim() } else { $null }
    }
}

Write-Host "   -> $($etabRows.Count) etablissements prepares. Envoi a Supabase..."
for ($i = 0; $i -lt $etabRows.Count; $i += 100) {
    $end = [Math]::Min($i + 99, $etabRows.Count - 1)
    $batch = $etabRows[$i..$end]
    Post-Batch "etablissements" $batch
    Write-Host "   Etablissements: $($end + 1) / $($etabRows.Count)"
}

Write-Host "`n=== SYNCHRONISATION COMPLETE ET REUSSIE ! ==="
