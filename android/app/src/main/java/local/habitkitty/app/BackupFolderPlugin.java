package local.habitkitty.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Saves backup files where the user can see them: one folder they pick once (kept across restarts) for the automatic backups,
 * and a "save as" picker for a single file. Both go through Android's system file picker, so no storage permission is needed.
 * The web app writes each file into the app's cache first and passes its name here, so big files never cross the bridge.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {
    private static final String PREFS = "backup_folder", KEY = "tree";

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** The chosen folder, or null when none was chosen or it can no longer be written to (deleted, permission revoked, card removed). */
    private DocumentFile folder() {
        String s = prefs().getString(KEY, null);
        if (s == null) return null;
        DocumentFile d = DocumentFile.fromTreeUri(getContext(), Uri.parse(s));
        return d != null && d.exists() && d.isDirectory() && d.canWrite() ? d : null;
    }

    /** The chosen folder, or its subfolder {sub} (made when asked to) when one is given; null when it is not there. */
    private DocumentFile within(DocumentFile root, String sub, boolean create) {
        if (root == null || sub == null || sub.isEmpty()) return root;
        if (sub.contains("/") || sub.contains("..")) return null;
        DocumentFile d = root.findFile(sub);
        if (d != null && d.isDirectory()) return d;
        return create && d == null ? root.createDirectory(sub) : null;
    }

    private File cacheFile(String name) {
        if (name == null || name.isEmpty() || name.contains("/") || name.contains("..")) return null;
        return new File(getContext().getCacheDir(), name);
    }

    private void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush();
    }

    private JSObject state() {
        JSObject out = new JSObject();
        String s = prefs().getString(KEY, null);
        DocumentFile d = folder();
        out.put("chosen", s != null);
        out.put("ok", d != null);
        if (s != null) {
            DocumentFile t = DocumentFile.fromTreeUri(getContext(), Uri.parse(s));
            out.put("name", t != null && t.getName() != null ? t.getName() : "");
        }
        return out;
    }

    @PluginMethod
    public void folder(PluginCall call) { call.resolve(state()); }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "pickedFolder");
    }

    @ActivityCallback
    private void pickedFolder(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) { call.reject("cancelled"); return; }
        Uri uri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) { call.reject("Could not keep access to that folder."); return; }
        String old = prefs().getString(KEY, null);
        if (old != null && !old.equals(uri.toString())) {
            try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(old),
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception ignored) { }
        }
        prefs().edit().putString(KEY, uri.toString()).apply();
        call.resolve(state());
    }

    @PluginMethod
    public void forget(PluginCall call) {
        String old = prefs().getString(KEY, null);
        if (old != null) {
            try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(old),
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception ignored) { }
        }
        prefs().edit().remove(KEY).apply();
        call.resolve();
    }

    /** Copies the cache file {cache} into the folder as {name}, replacing a file of that name in place. */
    @PluginMethod
    public void put(PluginCall call) {
        File src = cacheFile(call.getString("cache"));
        String name = call.getString("name");
        DocumentFile dir = within(folder(), call.getString("dir"), true);
        if (src == null || !src.exists() || name == null || name.isEmpty()) { call.reject("Nothing to save."); return; }
        if (dir == null) { call.reject("no-folder"); return; }
        try {
            DocumentFile target = dir.findFile(name);
            if (target == null) target = dir.createFile("application/octet-stream", name);
            if (target == null) { call.reject("Could not create the file."); return; }
            try (InputStream in = new FileInputStream(src);
                 OutputStream out = getContext().getContentResolver().openOutputStream(target.getUri(), "wt")) {
                if (out == null) throw new Exception("no stream");
                copy(in, out);
            }
            call.resolve();
        } catch (Exception e) { call.reject("Could not write to the backup folder."); }
    }

    @PluginMethod
    public void list(PluginCall call) {
        DocumentFile root = folder();
        if (root == null) { call.reject("no-folder"); return; }
        DocumentFile dir = within(root, call.getString("dir"), false);
        JSArray files = new JSArray();
        if (dir == null) { JSObject none = new JSObject(); none.put("files", files); call.resolve(none); return; }   // no such subfolder yet
        for (DocumentFile f : dir.listFiles()) {
            if (!f.isFile() || f.getName() == null) continue;
            JSObject o = new JSObject();
            o.put("name", f.getName());
            o.put("modified", f.lastModified());
            o.put("size", f.length());
            files.put(o);
        }
        JSObject out = new JSObject();
        out.put("files", files);
        call.resolve(out);
    }

    /** Copies the folder's file {name} into the cache as {cache}, for the web app to read. */
    @PluginMethod
    public void fetch(PluginCall call) {
        DocumentFile dir = within(folder(), call.getString("dir"), false);
        File dst = cacheFile(call.getString("cache"));
        String name = call.getString("name");
        if (dir == null) { call.reject("no-folder"); return; }
        DocumentFile f = name == null ? null : dir.findFile(name);
        if (dst == null || f == null) { call.reject("That backup is gone."); return; }
        try (InputStream in = getContext().getContentResolver().openInputStream(f.getUri());
             OutputStream out = new FileOutputStream(dst)) {
            if (in == null) throw new Exception("no stream");
            copy(in, out);
            call.resolve();
        } catch (Exception e) { call.reject("Could not read that backup."); }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        DocumentFile root = folder();
        String name = call.getString("name");
        if (root == null) { call.reject("no-folder"); return; }
        DocumentFile dir = within(root, call.getString("dir"), false);
        if (dir == null) { call.resolve(); return; }
        DocumentFile f = name == null ? null : dir.findFile(name);
        if (f != null) f.delete();
        call.resolve();
    }

    /** "Save as": opens the system picker so the user chooses where the cache file {cache} goes, named {name}. */
    @PluginMethod
    public void saveAs(PluginCall call) {
        File src = cacheFile(call.getString("cache"));
        String name = call.getString("name");
        if (src == null || !src.exists() || name == null || name.isEmpty()) { call.reject("Nothing to save."); return; }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/octet-stream");
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, i, "savedAs");
    }

    @ActivityCallback
    private void savedAs(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) { call.reject("cancelled"); return; }
        Uri uri = data.getData();
        File src = cacheFile(call.getString("cache"));
        new Thread(() -> {
            try (InputStream in = new FileInputStream(src);
                 OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new Exception("no stream");
                copy(in, out);
                DocumentFile f = DocumentFile.fromSingleUri(getContext(), uri);
                JSObject o = new JSObject();
                o.put("name", f != null && f.getName() != null ? f.getName() : call.getString("name"));
                call.resolve(o);
            } catch (Exception e) { call.reject("Could not save the file there."); }
        }).start();
    }
}
