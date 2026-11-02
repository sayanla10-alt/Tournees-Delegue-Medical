package com.mediplanner.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

// MediPlanner : application Android qui ouvre la version en ligne (toujours à jour), avec GPS,
// appels, SMS, WhatsApp, Maps et Waze ouverts dans les applications du téléphone.
public class MainActivity extends AppCompatActivity {
    private static final String URL_APP = "https://sayanla10-alt.github.io/Tournees-Delegue-Medical/";
    private static final String HOTE_APP = "sayanla10-alt.github.io";
    private static final int REQ_GPS = 1, REQ_FICHIER = 2;
    private WebView vue;
    private GeolocationPermissions.Callback gpsRappel; private String gpsOrigine;
    private ValueCallback<Uri[]> fichierRappel;

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        vue = new WebView(this);
        setContentView(vue);
        WebSettings s = vue.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " MediPlannerAPK");
        vue.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return ouvrirAilleurs(r.getUrl()); }
        });
        vue.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origine, GeolocationPermissions.Callback rappel) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    rappel.invoke(origine, true, true);
                } else {
                    gpsRappel = rappel; gpsOrigine = origine;
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GPS);
                }
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> rappel, FileChooserParams p) {
                if (fichierRappel != null) fichierRappel.onReceiveValue(null);
                fichierRappel = rappel;
                try { startActivityForResult(p.createIntent(), REQ_FICHIER); } catch (ActivityNotFoundException e) { fichierRappel = null; return false; }
                return true;
            }
        });
        if (etat != null) vue.restoreState(etat); else vue.loadUrl(URL_APP);
    }

    // Liens hors de MediPlanner (tél., SMS, WhatsApp, Maps, Waze…) : ouverts dans l'application du téléphone
    private boolean ouvrirAilleurs(Uri u) {
        String sch = u.getScheme() == null ? "" : u.getScheme();
        if ((sch.equals("https") || sch.equals("http")) && HOTE_APP.equals(u.getHost())) return false;
        try {
            Intent i = sch.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            startActivity(i);
        } catch (Exception e) {
            if (sch.equals("http") || sch.equals("https")) return false;
        }
        return true;
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_GPS && gpsRappel != null) {
            boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
            gpsRappel.invoke(gpsOrigine, ok, ok); gpsRappel = null;
        }
    }
    @Override protected void onActivityResult(int code, int resultat, Intent data) {
        super.onActivityResult(code, resultat, data);
        if (code == REQ_FICHIER && fichierRappel != null) {
            fichierRappel.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultat, data)); fichierRappel = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle etat) { super.onSaveInstanceState(etat); vue.saveState(etat); }
    @Override public void onBackPressed() { if (vue.canGoBack()) vue.goBack(); else super.onBackPressed(); }
}
