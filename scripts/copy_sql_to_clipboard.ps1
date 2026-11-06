# scripts/copy_sql_to_clipboard.ps1
$sql = Get-Content -Raw -Encoding UTF8 "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\supabase\schema_complet.sql"
Set-Clipboard -Value $sql
Write-Host "Le script SQL complet ($($sql.Length) caracteres) a ete copie avec succes dans votre presse-papiers Windows !"
