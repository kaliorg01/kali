package org.kali.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** KALI pra Android: abre o KALI e deixa transmitir a tela do celular na call. */
public class MainActivity extends Activity {
    static MainActivity atual;
    private static final int REQ_TELA = 1, REQ_PERM = 2, REQ_ARQ = 3, REQ_AVISO = 4;
    // Endereço do servidor da KALI: vem do build (variável KALI_URL no GitHub Actions ou -PkaliUrl=...).
    private static final String ENDERECO = BuildConfig.KALI_URL;

    private WebView web;
    private PermissionRequest pedidoPendente;
    private ValueCallback<Uri[]> arqCallback;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        atual = this;
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " KaliApp/1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String host = r.getUrl().getHost();
                // O KALI (página fixa + túnel) abre dentro do app; links de fora vão pro navegador.
                if (host != null && (host.endsWith("trycloudflare.com") || host.equals("kaliorg01.github.io"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) { /* sem app pra abrir */ }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        req.grant(req.getResources());
                    } else {
                        pedidoPendente = req;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, REQ_PERM);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                arqCallback = cb;
                try {
                    startActivityForResult(p.createIntent(), REQ_ARQ);
                } catch (Exception e) {
                    arqCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Ponte(), "KaliNativo");

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_AVISO);
        }
        if (salvo != null) web.restoreState(salvo);
        else web.loadUrl(ENDERECO);
    }

    @Override
    protected void onSaveInstanceState(Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else moveTaskToBack(true); // não fecha: a call continua
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == REQ_PERM && pedidoPendente != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pedidoPendente.grant(pedidoPendente.getResources());
            else pedidoPendente.deny();
            pedidoPendente = null;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent dados) {
        if (req == REQ_TELA) {
            if (res == RESULT_OK && dados != null) {
                Intent i = new Intent(this, TelaServico.class);
                i.putExtra("codigo", res);
                i.putExtra("dados", dados);
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
                else startService(i);
            } else {
                js("window.__kaliTelaParou && __kaliTelaParou()");
            }
        } else if (req == REQ_ARQ) {
            if (arqCallback != null) arqCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, dados));
            arqCallback = null;
        } else {
            super.onActivityResult(req, res, dados);
        }
    }

    void js(String codigo) {
        web.post(() -> web.evaluateJavascript(codigo, null));
    }

    /** Um quadro da tela (JPEG em base64) pro KALI desenhar e mandar na call. */
    void quadro(String b64) {
        web.post(() -> web.evaluateJavascript("window.__kaliQuadro && __kaliQuadro('" + b64 + "')", null));
    }

    /** O que o KALI (JavaScript) pode chamar no app. */
    class Ponte {
        @JavascriptInterface
        public void iniciarTela() {
            runOnUiThread(() -> {
                MediaProjectionManager m = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                startActivityForResult(m.createScreenCaptureIntent(), REQ_TELA);
            });
        }

        @JavascriptInterface
        public void pararTela() {
            stopService(new Intent(MainActivity.this, TelaServico.class));
        }
    }
}
