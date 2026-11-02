/* InstallationApk.gs : dépose l'application Android MediPlanner dans le Drive (dossier « MediPlanner Android »)
   et donne un lien de téléchargement direct. À relancer après chaque nouvelle APK. */
var URL_APK = 'https://sayanla10-alt.github.io/Tournees-Delegue-Medical/MediPlanner.apk';
function installerApkDansDrive() {
  var rep = UrlFetchApp.fetch(URL_APK + '?v=' + Date.now(), { followRedirects: true, muteHttpExceptions: true });
  if (rep.getResponseCode() !== 200) throw new Error('APK introuvable (' + rep.getResponseCode() + ')');
  var dossier = dossierApk();
  var anciens = dossier.getFilesByName('MediPlanner.apk');
  while (anciens.hasNext()) anciens.next().setTrashed(true);
  var f = dossier.createFile(rep.getBlob().setName('MediPlanner.apk').setContentType('application/vnd.android.package-archive'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var lien = 'https://drive.google.com/uc?export=download&id=' + f.getId();
  PropertiesService.getScriptProperties().setProperty('LIEN_APK', lien);
  Logger.log('LIEN_APK ' + lien + ' taille ' + f.getSize());
  return lien;
}
function dossierApk() {
  var it = DriveApp.getFoldersByName('MediPlanner Android');
  return it.hasNext() ? it.next() : DriveApp.createFolder('MediPlanner Android');
}
