package local.habitkitty.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;
import java.util.Calendar;

/**
 * Home-screen widget showing the cozy room. The web app renders one picture per time of day
 * (room-widget-day/dusk/night.png in the app's files folder); this picks the one that matches the clock.
 */
public class RoomWidgetProvider extends AppWidgetProvider {

    static String phaseNow() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);   // same split as skyPhase() in app.ts
        if (h >= 8 && h < 17) return "day";
        if ((h >= 6 && h < 8) || (h >= 17 && h < 20)) return "dusk";
        return "night";
    }

    static void update(Context ctx, AppWidgetManager mgr, int[] ids) {
        File file = new File(ctx.getFilesDir(), "room-widget-" + phaseNow() + ".png");
        Bitmap bmp = file.exists() ? BitmapFactory.decodeFile(file.getAbsolutePath()) : null;
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) open.putExtra(MainActivity.EXTRA_TAB, "room");   // the widget opens the Room tab
        PendingIntent tap = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_room);
            if (bmp != null) rv.setImageViewBitmap(R.id.room_img, bmp);
            rv.setViewVisibility(R.id.room_hint, bmp != null ? View.GONE : View.VISIBLE);
            rv.setOnClickPendingIntent(R.id.widget_root, tap);
            mgr.updateAppWidget(id, rv);
        }
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        update(ctx, mgr, ids);
    }
}
