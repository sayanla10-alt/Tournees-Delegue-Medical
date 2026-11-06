# scripts/patch_ecriture.ps1
$path = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\apps-script\Ecriture.gs"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Rapport
$target1 = "    if (rang > 0) sh.getRange(rang, 1, 1, ligne.length).setValues([ligne]);`r`n    else sh.getRange(sh.getLastRow() + 1, 1, 1, ligne.length).setValues([ligne]);`r`n    return { ok: true, date: r.date };"
$repl1 = "    if (rang > 0) sh.getRange(rang, 1, 1, ligne.length).setValues([ligne]);`r`n    else sh.getRange(sh.getLastRow() + 1, 1, 1, ligne.length).setValues([ligne]);`r`n    try { if (typeof miroirSupabaseRapport_ === 'function') miroirSupabaseRapport_(r); } catch (eMir) { console.warn('Miroir Supabase rapport:', eMir); }`r`n    return { ok: true, date: r.date };"

# Check if LF instead of CRLF
if (-not $content.Contains($target1)) {
    $target1 = $target1.Replace("`r`n", "`n")
    $repl1 = $repl1.Replace("`r`n", "`n")
}
if ($content.Contains($target1)) {
    $content = $content.Replace($target1, $repl1)
    Write-Host "Hook 1 (Rapport) : OK"
} else {
    Write-Host "Hook 1 (Rapport) : Non trouve"
}

# 2. Visites
$target2 = "    return { ok: true, recus: recus, ajoutes: nouvelles.length, corriges: corrections.length };`r`n  } finally {"
$repl2 = "    try { if (typeof miroirSupabaseVisites_ === 'function') miroirSupabaseVisites_(visites); } catch (eMir) { console.warn('Miroir Supabase visites:', eMir); }`r`n    return { ok: true, recus: recus, ajoutes: nouvelles.length, corriges: corrections.length };`r`n  } finally {"

if (-not $content.Contains($target2)) {
    $target2 = $target2.Replace("`r`n", "`n")
    $repl2 = $repl2.Replace("`r`n", "`n")
}
if ($content.Contains($target2)) {
    $content = $content.Replace($target2, $repl2)
    Write-Host "Hook 2 (Visites) : OK"
} else {
    Write-Host "Hook 2 (Visites) : Non trouve"
}

# 3. Planning
$target3 = "    if (tout.length) sh.getRange(2, 1, tout.length, nbCol).setNumberFormat('@').setValues(tout);`r`n    return { ok: true, publies: nouvelles.length, conflits: conflits };"
$repl3 = "    if (tout.length) sh.getRange(2, 1, tout.length, nbCol).setNumberFormat('@').setValues(tout);`r`n    try { if (typeof miroirSupabasePlanning_ === 'function') miroirSupabasePlanning_(b); } catch (eMir) { console.warn('Miroir Supabase planning:', eMir); }`r`n    return { ok: true, publies: nouvelles.length, conflits: conflits };"

if (-not $content.Contains($target3)) {
    $target3 = $target3.Replace("`r`n", "`n")
    $repl3 = $repl3.Replace("`r`n", "`n")
}
if ($content.Contains($target3)) {
    $content = $content.Replace($target3, $repl3)
    Write-Host "Hook 3 (Planning) : OK"
} else {
    Write-Host "Hook 3 (Planning) : Non trouve"
}

# 4. Fiche Praticien
$target4 = "    return { ok: true, code: code, ancien: String(p.code || ''), ids: ids, coords: coords };`r`n  } finally {"
$repl4 = "    try { if (typeof miroirSupabasePraticien_ === 'function') miroirSupabasePraticien_(modif, lieux, ids); } catch (eMir) { console.warn('Miroir Supabase praticien:', eMir); }`r`n    return { ok: true, code: code, ancien: String(p.code || ''), ids: ids, coords: coords };`r`n  } finally {"

if (-not $content.Contains($target4)) {
    $target4 = $target4.Replace("`r`n", "`n")
    $repl4 = $repl4.Replace("`r`n", "`n")
}
if ($content.Contains($target4)) {
    $content = $content.Replace($target4, $repl4)
    Write-Host "Hook 4 (Fiche Praticien) : OK"
} else {
    Write-Host "Hook 4 (Fiche Praticien) : Non trouve"
}

# 5. Pharmacie
$target5 = "  var ids = {}; if (lieu.id) ids[lieu.id] = 'P-' + code;`r`n  return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };"
$repl5 = "  var ids = {}; if (lieu.id) ids[lieu.id] = 'P-' + code;`r`n  try { if (typeof miroirSupabasePharmacie_ === 'function') miroirSupabasePharmacie_(modif, lieu); } catch (eMir) { console.warn('Miroir Supabase pharmacie:', eMir); }`r`n  return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };"

if (-not $content.Contains($target5)) {
    $target5 = $target5.Replace("`r`n", "`n")
    $repl5 = $repl5.Replace("`r`n", "`n")
}
if ($content.Contains($target5)) {
    $content = $content.Replace($target5, $repl5)
    Write-Host "Hook 5 (Pharmacie) : OK"
} else {
    Write-Host "Hook 5 (Pharmacie) : Non trouve"
}

# 6. Etablissement
$target6 = "    return { ok: true, code: code, nom: nom, lat: modif.lat, lon: modif.lon, cascades: cascades };`r`n  } finally {"
$repl6 = "    try { if (typeof miroirSupabaseEtablissement_ === 'function') miroirSupabaseEtablissement_(modif); } catch (eMir) { console.warn('Miroir Supabase etablissement:', eMir); }`r`n    return { ok: true, code: code, nom: nom, lat: modif.lat, lon: modif.lon, cascades: cascades };`r`n  } finally {"

if (-not $content.Contains($target6)) {
    $target6 = $target6.Replace("`r`n", "`n")
    $repl6 = $repl6.Replace("`r`n", "`n")
}
if ($content.Contains($target6)) {
    $content = $content.Replace($target6, $repl6)
    Write-Host "Hook 6 (Etablissement) : OK"
} else {
    Write-Host "Hook 6 (Etablissement) : Non trouve"
}

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Patch termine avec succes !"
