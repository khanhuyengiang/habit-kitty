package local.habitkitty.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app tell the home-screen widget that its pictures changed. */
@CapacitorPlugin(name = "RoomWidget")
public class RoomWidgetPlugin extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        Context ctx = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, RoomWidgetProvider.class));
        if (ids.length > 0) RoomWidgetProvider.update(ctx, mgr, ids);
        call.resolve();
    }

    /** The tab the widget asked for, once; empty when the app was opened some other way. */
    @PluginMethod
    public void pendingTab(PluginCall call) {
        JSObject out = new JSObject();
        out.put("tab", MainActivity.pendingTab == null ? "" : MainActivity.pendingTab);
        MainActivity.pendingTab = null;
        call.resolve(out);
    }
}
