package com.impulsomktdigital.raiox;

import android.app.Activity;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String APP_HOST = "raio-x-digital-express-38wa3a.v2.appdeploy.ai";
    private static final String HOME_URL = "https://" + APP_HOST + "/";

    private WebView webView;
    private Dialog popupDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 32, 23));
        window.setNavigationBarColor(Color.rgb(7, 32, 23));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        configureWebView(webView, false);
        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(resolveInitialUrl(getIntent()));
        }
    }

    private String resolveInitialUrl(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data != null && "https".equalsIgnoreCase(data.getScheme()) && APP_HOST.equalsIgnoreCase(data.getHost())) {
            return data.toString();
        }
        return HOME_URL;
    }

    private void configureWebView(WebView target, boolean popup) {
        WebSettings settings = target.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " RaioXDigitalAndroid/1.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(target, true);

        target.setWebViewClient(new RaioXWebViewClient());
        target.setWebChromeClient(new RaioXWebChromeClient(target, popup));
        target.setDownloadListener(new ExternalDownloadListener());
        target.setBackgroundColor(Color.WHITE);
    }

    private class RaioXWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return routeUrl(view, request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return routeUrl(view, Uri.parse(url));
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                Toast.makeText(MainActivity.this, "Não foi possível carregar a página. Verifique sua conexão.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private boolean routeUrl(WebView source, Uri uri) {
        if (uri == null) return false;

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();

        if (("https".equals(scheme) || "http".equals(scheme)) && APP_HOST.equals(host)) {
            return false;
        }

        if ("intent".equals(scheme)) {
            try {
                Intent intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                startActivity(intent);
            } catch (Exception ignored) {
                Toast.makeText(this, "Não foi possível abrir este aplicativo.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme)
                || "tel".equals(scheme) || "sms".equals(scheme) || "whatsapp".equals(scheme)) {
            openExternal(uri);
            return true;
        }

        return false;
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, "Nenhum aplicativo disponível para abrir este link.", Toast.LENGTH_SHORT).show();
        }
    }

    private class RaioXWebChromeClient extends WebChromeClient {
        private final WebView owner;
        private final boolean popup;

        RaioXWebChromeClient(WebView owner, boolean popup) {
            this.owner = owner;
            this.popup = popup;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
            WebView child = new WebView(MainActivity.this);
            configureWebView(child, true);

            popupDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
            popupDialog.setContentView(child, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));
            popupDialog.setOnDismissListener(dialog -> child.destroy());
            popupDialog.show();

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(child);
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public void onCloseWindow(WebView window) {
            if (popupDialog != null && popupDialog.isShowing()) {
                popupDialog.dismiss();
                popupDialog = null;
            }
            if (popup && owner != null) {
                owner.stopLoading();
            }
        }
    }

    private class ExternalDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
            if (url != null && !url.isEmpty()) {
                openExternal(Uri.parse(url));
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) {
            webView.loadUrl(resolveInitialUrl(intent));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (popupDialog != null && popupDialog.isShowing()) {
            popupDialog.dismiss();
            popupDialog = null;
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (popupDialog != null && popupDialog.isShowing()) {
            popupDialog.dismiss();
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
