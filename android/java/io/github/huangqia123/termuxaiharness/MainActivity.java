package io.github.huangqia123.termuxaiharness;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.content.ClipData;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String UA =
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
    private static final int MAX_TEXT = 3500;

    private WebView web;
    private android.webkit.ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE = 1024;
    private EngineManager engine;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        engine = new EngineManager(this);
        new Thread(new Runnable() {
            @Override
            public void run() {
                if (engine.installIfNeeded()) engine.startIfModel();
            }
        }).start();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(UA);
        web.addJavascriptInterface(new Bridge(), "AndroidApi");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                } else if (data.getClipData() != null) {
                    ClipData clip = data.getClipData();
                    results = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        results[i] = clip.getItemAt(i).getUri();
                    }
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (engine != null) engine.stop();
        super.onDestroy();
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }

    private static String clip(String text) {
        if (text == null) return "";
        String t = text.replace("\r", "").replaceAll("[ \t]+", " ").replaceAll("\n{3,}", "\n\n").trim();
        return t.length() > MAX_TEXT ? t.substring(0, MAX_TEXT) : t;
    }

    public class Bridge {

        @JavascriptInterface
        public void openExternal(String url) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String readUrl(String url) {
            final String[] box = new String[]{"{\"url\":\"" + esc(url) + "\",\"error\":\"页面加载超时\"}"};
            final CountDownLatch latch = new CountDownLatch(1);

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    final WebView v = new WebView(MainActivity.this);
                    WebSettings ws = v.getSettings();
                    ws.setJavaScriptEnabled(true);
                    ws.setDomStorageEnabled(true);
                    ws.setUserAgentString(UA);
                    ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

                    v.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String u) {
                            view.evaluateJavascript(
                                    "(function(){try{return JSON.stringify({t:document.title||'',x:(document.body&&(document.body.innerText||document.body.textContent))||''})}catch(e){return '{}'}})()",
                                    new ValueCallback<String>() {
                                        @Override
                                        public void onReceiveValue(String value) {
                                            try {
                                                String inner = new JSONObject("{\"v\":" + value + "}").getString("v");
                                                JSONObject o = new JSONObject(inner);
                                                String text = clip(o.optString("x", ""));
                                                JSONObject out = new JSONObject();
                                                out.put("url", u);
                                                out.put("title", o.optString("t", ""));
                                                out.put("text", text);
                                                out.put("chars", text.length());
                                                box[0] = out.toString();
                                            } catch (Exception e) {
                                                box[0] = "{\"url\":\"" + esc(u) + "\",\"error\":\"解析页面失败\"}";
                                            }
                                            latch.countDown();
                                        }
                                    });
                        }

                        @Override
                        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                            if (req != null && req.isForMainFrame()) {
                                box[0] = "{\"url\":\"" + esc(url) + "\",\"error\":\"" + esc(String.valueOf(err.getDescription())) + "\"}";
                                latch.countDown();
                            }
                        }
                    });

                    try {
                        v.loadUrl(url);
                    } catch (Exception e) {
                        box[0] = "{\"url\":\"" + esc(url) + "\",\"error\":\"打不开这个网址\"}";
                        latch.countDown();
                    }
                }
            });

            try {
                latch.await(28, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
            }
            return box[0];
        }

        @JavascriptInterface
        public String webSearch(String query) {
            try {
                String html = http("https://html.duckduckgo.com/html/?q=" + URLEncoder.encode(query, "UTF-8"));
                Pattern linkRe = Pattern.compile("<a[^>]+class=\"result__a\"[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>");
                Matcher m = linkRe.matcher(html);
                StringBuilder sb = new StringBuilder("[");
                int n = 0;
                while (m.find() && n < 5) {
                    String href = m.group(1);
                    Matcher uddg = Pattern.compile("uddg=([^&]+)").matcher(href);
                    if (uddg.find()) {
                        try {
                            href = java.net.URLDecoder.decode(uddg.group(1), "UTF-8");
                        } catch (Exception ignored) {
                        }
                    }
                    if (href.startsWith("//")) href = "https:" + href;
                    if (!href.startsWith("http")) continue;
                    String title = m.group(2).replaceAll("<[^>]+>", "");
                    if (n > 0) sb.append(",");
                    sb.append("{\"title\":\"").append(esc(title)).append("\",\"url\":\"").append(esc(href))
                            .append("\",\"snippet\":\"\"}");
                    n++;
                }
                sb.append("]");
                return sb.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        private String http(String url) throws Exception {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("User-Agent", UA);
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append("\n");
            br.close();
            return sb.toString();
        }

        @JavascriptInterface
        public String engineStatus() {
            try {
                return engine.statusJson();
            } catch (Exception e) {
                return "{\"installed\":false,\"running\":false,\"port\":8080,\"model\":\"\"}";
            }
        }

        @JavascriptInterface
        public void engineStart() {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    engine.startIfModel();
                }
            }).start();
        }
    }
}
