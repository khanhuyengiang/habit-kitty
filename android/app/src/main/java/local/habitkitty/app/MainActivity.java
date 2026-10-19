package local.habitkitty.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_TAB = "tab";
    /** Tab the web app should switch to (set by the widget); handed over once by RoomWidgetPlugin.pendingTab. */
    static String pendingTab = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RoomWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        remember(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        remember(intent);
    }

    private static void remember(Intent intent) {
        if (intent != null && intent.hasExtra(EXTRA_TAB)) pendingTab = intent.getStringExtra(EXTRA_TAB);
    }
}
