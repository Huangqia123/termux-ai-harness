package io.github.huangqia123.termuxaiharness;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 内嵌推理引擎：把 assets/engine 里的 llama-server 与依赖库解压到应用私有目录，
 * 有模型时自动拉起本地服务（127.0.0.1:8080）。
 */
public class EngineManager {

    private static final String TAG = "TAH-Engine";
    public static final int PORT = 8080;

    private final Context ctx;
    private final File root;
    private final File bin;
    private final File lib;
    private Process proc;
    private volatile boolean wanted;

    public EngineManager(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        this.root = new File(this.ctx.getFilesDir(), "engine");
        this.bin = new File(root, "llama-server");
        this.lib = new File(root, "lib");
    }

    public File getRoot() {
        return root;
    }

    /** 模型目录：files/models，用户可以往里放 gguf */
    public File getModelsDir() {
        File d = new File(ctx.getFilesDir(), "models");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    public File firstModel() {
        File[] fs = getModelsDir().listFiles();
        if (fs == null) return null;
        for (File f : fs) {
            if (f.isFile() && f.getName().toLowerCase().endsWith(".gguf")) return f;
        }
        return null;
    }

    /** 首次启动把引擎解压出来 */
    public synchronized boolean installIfNeeded() {
        if (bin.exists() && bin.length() > 0) {
            bin.setExecutable(true);
            return true;
        }
        try {
            root.mkdirs();
            lib.mkdirs();
            copyAsset("engine");
            bin.setExecutable(true, false);
            File[] libs = lib.listFiles();
            if (libs != null) {
                for (File f : libs) f.setReadable(true, false);
            }
            Log.i(TAG, "engine installed at " + root.getAbsolutePath());
            return true;
        } catch (IOException e) {
            Log.e(TAG, "install failed", e);
            return false;
        }
    }

    private void copyAsset(String dir) throws IOException {
        AssetManager am = ctx.getAssets();
        String[] names = am.list(dir);
        if (names == null || names.length == 0) {
            copyFile(dir);
            return;
        }
        for (String n : names) {
            copyAsset(dir + "/" + n);
        }
    }

    private void copyFile(String path) throws IOException {
        File out = new File(root, path.substring("engine".length()).replaceFirst("^/", ""));
        out.getParentFile().mkdirs();
        InputStream in = ctx.getAssets().open(path);
        OutputStream os = new FileOutputStream(out);
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        in.close();
        os.close();
        Log.i(TAG, "extracted " + out.getName() + " (" + out.length() / 1048576 + "MB)");
    }

    public synchronized boolean isRunning() {
        return proc != null && proc.isAlive();
    }

    /** 有模型就启动，没有就跳过 */
    public synchronized void startIfModel() {
        if (isRunning()) return;
        File model = firstModel();
        if (model == null) {
            Log.i(TAG, "no model yet, engine idle");
            return;
        }
        if (!bin.exists()) {
            Log.w(TAG, "engine binary missing");
            return;
        }
        int threads = Math.max(2, Math.min(6, Runtime.getRuntime().availableProcessors()));
        List<String> cmd = new ArrayList<>();
        cmd.add(bin.getAbsolutePath());
        cmd.add("-m");
        cmd.add(model.getAbsolutePath());
        cmd.add("--host");
        cmd.add("127.0.0.1");
        cmd.add("--port");
        cmd.add(String.valueOf(PORT));
        cmd.add("-c");
        cmd.add("4096");
        cmd.add("-t");
        cmd.add(String.valueOf(threads));
        cmd.add("--no-warmup");

        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(root);
            pb.redirectErrorStream(true);
            pb.environment().put("LD_LIBRARY_PATH", lib.getAbsolutePath());
            pb.environment().put("TMPDIR", ctx.getCacheDir().getAbsolutePath());
            proc = pb.start();
            wanted = true;
            Log.i(TAG, "engine started: " + model.getName());
            Thread pump = new Thread(new Pump(proc));
            pump.setDaemon(true);
            pump.start();
        } catch (IOException e) {
            Log.e(TAG, "start failed", e);
        }
    }

    public synchronized void stop() {
        wanted = false;
        if (proc != null) {
            proc.destroy();
            proc = null;
        }
    }

    public String statusJson() {
        File m = firstModel();
        return "{\"installed\":" + (bin.exists()) +
                ",\"running\":" + isRunning() +
                ",\"port\":" + PORT +
                ",\"model\":\"" + (m == null ? "" : m.getName()) + "\"}";
    }

    private static class Pump implements Runnable {
        private final Process p;

        Pump(Process p) {
            this.p = p;
        }

        @Override
        public void run() {
            try {
                java.io.BufferedReader br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(p.getInputStream()));
                String line;
                while ((line = br.readLine()) != null) {
                    Log.i(TAG, line);
                }
            } catch (Exception ignored) {
            }
        }
    }
}
