package io.github.huangqia123.termuxaiharness;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Termux AI Harness — Android front end.
 *
 * This shell does not bundle llama.cpp. It finds a llama-server that is already
 * listening on localhost (the one you start from Termux), proxies chat traffic
 * through Java so the WebView never hits a CORS wall, and can ask Termux to
 * start the server for you through the public RUN_COMMAND intent.
 */
public class MainActivity extends Activity {

    private static final int FIRST_PORT = 8080;
    private static final int LAST_PORT = 8091;
    private static final String TERMUX_PKG = "com.termux";

    private WebView web;
    private volatile int activePort = -1;
    private volatile boolean autoStarted = false;

    private static final String START_CMD =
        "M=$(ls -1 $HOME/models/*.gguf $HOME/.termux-ai/models/*.gguf 2>/dev/null | head -1); " +
        "if [ -z \"$M\" ]; then echo NO_MODEL; exit 1; fi; " +
        "exec llama-server -m \"$M\" -c 2048 --port 8080 -t 4";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setBackgroundColor(0xFF07080C);
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /* ---------------------------------------------------------- http helper */

    private static String fetch(String url, String body, int timeoutMs) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(timeoutMs);
            c.setReadTimeout(Math.max(timeoutMs, 12000));
            if (body != null) {
                c.setRequestMethod("POST");
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                OutputStream os = c.getOutputStream();
                os.write(body.getBytes("UTF-8"));
                os.flush();
                os.close();
            }
            int code = c.getResponseCode();
            InputStream is = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
            if (is == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            is.close();
            return out.toString("UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private int probePort() {
        for (int p = FIRST_PORT; p <= LAST_PORT; p++) {
            String r = fetch("http://127.0.0.1:" + p + "/v1/models", null, 400);
            if (r == null) continue;
            try {
                JSONObject j = new JSONObject(r);
                JSONArray d = j.optJSONArray("data");
                if (d != null && d.length() > 0) return p;
            } catch (Exception ignored) {}
        }
        return -1;
    }

    /* -------------------------------------------------------------- bridge */

    class Bridge {

        @JavascriptInterface
        public String probe() {
            JSONObject out = new JSONObject();
            try {
                int p = probePort();
                activePort = p;
                out.put("port", p);
                out.put("termux", termuxInstalled());
                out.put("autoStarted", autoStarted);
            } catch (Exception e) {
                try { out.put("port", -1); } catch (Exception ignored) {}
            }
            return out.toString();
        }

        @JavascriptInterface
        public boolean termuxInstalled() {
            try {
                getPackageManager().getPackageInfo(TERMUX_PKG, 0);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openTermux() {
            runOnUiThread(new Runnable() {
                public void run() {
                    Intent i = getPackageManager().getLaunchIntentForPackage(TERMUX_PKG);
                    if (i == null) {
                        toast("没有安装 Termux，请先装 Termux");
                        return;
                    }
                    startActivity(i);
                }
            });
        }

        @JavascriptInterface
        public void tryStartEngine() {
            runOnUiThread(new Runnable() {
              public void run() {
                if (!termuxInstalled()) {
                    toast("请先安装 Termux");
                    return;
                }
                try {
                    Intent i = new Intent();
                    i.setClassName(TERMUX_PKG, "com.termux.app.RunCommandService");
                    i.setAction("com.termux.RUN_COMMAND");
                    i.putExtra("com.termux.RUN_COMMAND_PATH",
                            "/data/data/com.termux/files/usr/bin/bash");
                    i.putExtra("com.termux.RUN_COMMAND_ARGUMENTS",
                            new String[] { "-lc", START_CMD });
                    i.putExtra("com.termux.RUN_COMMAND_WORKDIR",
                            "/data/data/com.termux/files/home");
                    i.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
                    i.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0");
                    startService(i);
                    autoStarted = true;
                    toast("已请求 Termux 启动引擎，等它加载完");
                } catch (Exception e) {
                    toast("调用 Termux 失败：需要允许外部命令（allow-external-apps）");
                }
              }
            });
        }

        @JavascriptInterface
        public void chat(final String messagesJson, final String cbId) {
            final int port = activePort > 0 ? activePort : probePort();
            if (port <= 0) {
                sendResult(cbId, "服务没起来：先用 Termux 启动 llama-server", null);
                return;
            }
            new Thread(new Runnable() {
              public void run() {
                String body = messagesJson;
                String r = fetch("http://127.0.0.1:" + port + "/v1/chat/completions", body, 5000);
                if (r == null) {
                    sendResult(cbId, "请求失败：连不上 127.0.0.1:" + port, null);
                    return;
                }
                try {
                    JSONObject j = new JSONObject(r);
                    JSONArray choices = j.optJSONArray("choices");
                    if (choices == null || choices.length() == 0) {
                        sendResult(cbId, "返回体里没有 choices", null);
                        return;
                    }
                    JSONObject msg = choices.getJSONObject(0).optJSONObject("message");
                    String content = msg != null ? msg.optString("content", "") : "";
                    sendResult(cbId, null, content);
                } catch (Exception e) {
                    sendResult(cbId, "解析失败：" + e.getMessage(), null);
                }
              }
            }).start();
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public String startCommand() {
            return START_CMD;
        }
    }

    private void sendResult(String cbId, String error, String content) {
        final String js = "window.__onChat("
                + JSONObject.quote(cbId) + ","
                + JSONObject.quote(error == null ? "" : error) + ","
                + JSONObject.quote(content == null ? "" : content) + ")";
        runOnUiThread(new Runnable() {
            public void run() {
                if (web != null) web.evaluateJavascript(js, null);
            }
        });
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }
}
