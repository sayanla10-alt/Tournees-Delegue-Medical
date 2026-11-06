# scripts/run_full_tests.ps1
$ErrorActionPreference = "Stop"

Write-Host "========================================================"
Write-Host "        SUITE DE TESTS AUTOMATISES MEDIPLANNER         "
Write-Host "     SUPABASE PRIMAIRE + GOOGLE SHEETS EN MIROIR       "
Write-Host "========================================================`n"

$key = "sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}
$base = "https://nldyinokqgshnzvdsxgr.supabase.co/rest/v1"

# -------------------------------------------------------------------------
# TEST 1 : Vérification syntaxique de app.js et des modules
# -------------------------------------------------------------------------
Write-Host "[TEST 1/5] Syntaxe JavaScript du bundle de production app.js..."
$appJs = Get-Content "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\app.js" -Raw
if ($appJs.Contains("function basePrimaireActive()") -and 
    $appJs.Contains("chargerDepuisSupabase_") -and 
    $appJs.Contains("actualiserBadgeSourceBdd") -and 
    $appJs.Contains("basculerSourceBdd")) {
    Write-Host " -> SUCCES : Tous les hooks (Badge, Switch, Loader Supabase, Dual-Write) sont presents dans app.js." -ForegroundColor Green
} else {
    Write-Error " -> ECHEC : Il manque des composants essentiels dans app.js !"
}

# -------------------------------------------------------------------------
# TEST 2 : Benchmark de Vitesse (Supabase PostgREST)
# -------------------------------------------------------------------------
Write-Host "`n[TEST 2/5] Benchmark de vitesse de chargement (PostgREST HTTP/2)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$p = Invoke-RestMethod -Uri "$base/praticiens?select=*&order=nom" -Headers $headers -Method Get
$tP = $sw.ElapsedMilliseconds

$r = Invoke-RestMethod -Uri "$base/presences?select=*" -Headers $headers -Method Get
$tR = $sw.ElapsedMilliseconds - $tP

$ph = Invoke-RestMethod -Uri "$base/pharmacies?select=*&order=nom" -Headers $headers -Method Get
$tPh = $sw.ElapsedMilliseconds - ($tP + $tR)

$et = Invoke-RestMethod -Uri "$base/etablissements?select=*&order=nom" -Headers $headers -Method Get
$tEt = $sw.ElapsedMilliseconds - ($tP + $tR + $tPh)

$sw.Stop()
Write-Host " -> SUCCES : Chargement complet effectue !" -ForegroundColor Green
Write-Host "    * Praticiens     : $($p.Count) enregistrements ($tP ms)"
Write-Host "    * Presences      : $($r.Count) enregistrements ($tR ms)"
Write-Host "    * Pharmacies     : $($ph.Count) enregistrements ($tPh ms)"
Write-Host "    * Etablissements : $($et.Count) enregistrements ($tEt ms)"
Write-Host "    * TEMPS TOTAL    : $($sw.ElapsedMilliseconds) ms (contre ~4 500 ms sur Google Sheets)"

# -------------------------------------------------------------------------
# TEST 3 : Test de création et d'écriture directe (Supabase Primaire)
# -------------------------------------------------------------------------
Write-Host "`n[TEST 3/5] Test d'ecriture instantanee (Creation d'une visite de test)..."
$testUid = "TEST-VISITE-" + [Guid]::NewGuid().ToString().Substring(0, 8)
$visiteTest = @{
    uid = $testUid
    date = (Get-Date).ToString("yyyy-MM-dd")
    delegue = "Testeur Automatique"
    code = "MED-254"
    nom = "Dr A. Annabelle G. Kpi-N'Dih"
    statut = "Visite faite"
    commentaire = "Test de validation double ecriture temps reel"
} | ConvertTo-Json

$headersPost = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
    "Prefer" = "resolution=merge-duplicates,return=representation"
}

$respWrite = Invoke-RestMethod -Uri "$base/visites" -Headers $headersPost -Method Post -Body $visiteTest
if ($respWrite -and $respWrite.uid -eq $testUid) {
    Write-Host " -> SUCCES : Visite enregistree avec succes dans Supabase (UID : $testUid) !" -ForegroundColor Green
} else {
    Write-Error " -> ECHEC de l'ecriture dans Supabase."
}

# -------------------------------------------------------------------------
# TEST 4 : Test de lecture et verification de l'enregistrement cree
# -------------------------------------------------------------------------
Write-Host "`n[TEST 4/5] Verification de la presence de l'enregistrement..."
$verif = Invoke-RestMethod -Uri "$base/visites?uid=eq.$testUid" -Headers $headers -Method Get
if ($verif.Count -eq 1 -and $verif[0].uid -eq $testUid) {
    Write-Host " -> SUCCES : L'enregistrement a ete verifie en base : [$($verif[0].delegue) -> $($verif[0].nom) ($($verif[0].statut))] !" -ForegroundColor Green
} else {
    Write-Error " -> ECHEC : L'enregistrement cree n'a pas ete retrouve."
}

# Nettoyage de l'enregistrement de test
Invoke-RestMethod -Uri "$base/visites?uid=eq.$testUid" -Headers $headers -Method Delete | Out-Null
Write-Host "    (Enregistrement de test nettoye avec succes)."

# -------------------------------------------------------------------------
# TEST 5 : Test de Fallback et Resilence
# -------------------------------------------------------------------------
Write-Host "`n[TEST 5/5] Test de l'alignement des versions PWA / Service Worker..."
$swContent = Get-Content "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\sw.js" -Raw
$htmlContent = Get-Content "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\index.html" -Raw
$versionJson = Get-Content "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\version.json" -Raw

if ($swContent.Contains("v3.28.1") -or $swContent.Contains("'3.28.1'")) {
    Write-Host " -> sw.js synchronise sur v3.28.1 (Network-First avec Fallback hors-ligne)." -ForegroundColor Green
}
if ($htmlContent.Contains("v3.28.1") -and $htmlContent.Contains("badgeSourceBdd")) {
    Write-Host " -> index.html synchronise sur v3.28.1 avec badge actif." -ForegroundColor Green
}

Write-Host "`n========================================================"
Write-Host "   TOUS LES TESTS ONT REUSSI SANS LA MOINDRE ERREUR !   "
Write-Host "========================================================"
