package io.github.huangqia123.termuxaiharness;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
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
 * This shell does not bundle llama.cpp. It talks to a llama-server over HTTP,
 * proxies chat traffic through Java so the WebView never hits a CORS wall, and
 * can ask Termux to start the server for you through the RUN_COMMAND intent.
 *
 * Endpoint: 127.0.0.1:8080 by default. If that port is busy or nothing answers,
 * it walks up to 8091. Tap the status pill to type in a LAN address instead,
 * e.g. 192.168.1.40:8080 — on Android 10+ that is the only way another app can
 * reach a server bound inside Termux.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "tah";
    private static final String KEY_HOST = "host";
    private static final String KEY_PORT = "port";
    private static final String DEFAULT_HOST = "127.0.0.1";
    private static final int DEFAULT_PORT = 8080;
    private static final int MAX_PORT = 8091;
    private static final String TERMUX_PKG = "com.termux";

    private WebView web;
    private SharedPreferences prefs;

    private volatile String cfgHost = DEFAULT_HOST;
    private volatile int cfgPort = DEFAULT_PORT;
    private volatile String activeHost = null;
    private volatile int activePort = -1;
    private volatile boolean autoStarted = false;

    private static final String START_CMD =
        "M=$(ls -1 $HOME/models/*.gguf $HOME/.termux-ai/models/*.gguf 2>/dev/null | head -1); " +
        "if [ -z \"$M\" ]; then echo NO_MODEL; exit 1; fi; " +
        "exec llama-server -m \"$M\" -c 2048 --host 0.0.0.0 --port 8080 -t 4";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        cfgHost = prefs.getString(KEY_HOST, DEFAULT_HOST);
        cfgPort = prefs.getInt(KEY_PORT, DEFAULT_PORT);

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

    private boolean isLlama(String host, int port) {
        String r = fetch("http://" + host + ":" + port + "/v1/models", null, 350);
        if (r == null) return false;
        try {
            JSONObject j = new JSONObject(r);
            JSONArray d = j.optJSONArray("data");
            return d != null && d.length() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    /** Configured endpoint first, then walk up the port range when it is local. */
    private int resolvePort(String host) {
        if (isLlama(host, cfgPort)) return cfgPort;
        if (DEFAULT_HOST.equals(host) || "localhost".equals(host)) {
            for (int p = DEFAULT_PORT; p <= MAX_PORT; p++) {
                if (p == cfgPort) continue;
                if (isLlama(host, p)) return p;
            }
        }
        return -1;
    }

    private int probePort() {
        int p = resolvePort(cfgHost);
        if (p > 0) {
            activeHost = cfgHost;
            activePort = p;
            return p;
        }
        activeHost = null;
        activePort = -1;
        return -1;
    }

    private boolean isTermuxInstalled() {
        try {
            getPackageManager().getPackageInfo(TERMUX_PKG, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private JSONObject configJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("host", cfgHost);
            o.put("port", cfgPort);
            o.put("activeHost", activeHost == null ? "" : activeHost);
            o.put("activePort", activePort);
            o.put("ok", activePort > 0);
            o.put("url", "http://" + cfgHost + ":" + cfgPort);
            o.put("termux", isTermuxInstalled());
            o.put("autoStarted", autoStarted);
        } catch (Exception ignored) {}
        return o;
    }

    /* -------------------------------------------------------------- bridge */

    class Bridge {

        @JavascriptInterface
        public String probe() {
            probePort();
            return configJson().toString();
        }

        @JavascriptInterface
        public String config() {
            return configJson().toString();
        }

        @JavascriptInterface
        public String setEndpoint(String input) {
            String s = input == null ? "" : input.trim();
            if (s.startsWith("http://")) s = s.substring(7);
            if (s.startsWith("https://")) s = s.substring(8);
            int slash = s.indexOf('/');
            if (slash >= 0) s = s.substring(0, slash);

            String h = DEFAULT_HOST;
            int p = DEFAULT_PORT;
            if (s.contains(":")) {
                String[] parts = s.split(":");
                if (parts.length >= 2) {
                    h = parts[0].trim();
                    try {
                        p = Integer.parseInt(parts[1].trim());
                    } catch (Exception e) {
                        p = DEFAULT_PORT;
                    }
                }
            } else if (s.length() > 0) {
                h = s;
            }
            if (h.isEmpty()) h = DEFAULT_HOST;
            if (p < 1 || p > 65535) p = DEFAULT_PORT;

            cfgHost = h;
            cfgPort = p;
            prefs.edit().putString(KEY_HOST, h).putInt(KEY_PORT, p).apply();

            probePort();
            return configJson().toString();
        }

        @JavascriptInterface
        public boolean termuxInstalled() {
            return isTermuxInstalled();
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
                    if (!isTermuxInstalled()) {
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
            if (activePort <= 0) probePort();
            final String host = activeHost;
            final int port = activePort;
            if (port <= 0 || host == null) {
                sendResult(cbId, "服务没起来：先在 Termux 启动 llama-server，或点右上角改地址", null);
                return;
            }
            new Thread(new Runnable() {
                public void run() {
                    String r = fetch("http://" + host + ":" + port + "/v1/chat/completions", messagesJson, 5000);
                    if (r == null) {
                        sendResult(cbId, "请求失败：连不上 " + host + ":" + port, null);
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
