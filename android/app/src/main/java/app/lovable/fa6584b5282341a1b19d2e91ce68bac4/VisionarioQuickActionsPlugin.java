package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * VisionarioQuickActionsPlugin — Sprint 7 · Checkpoint 2.
 *
 * Transporte puro. Sem storage, sem regra de negócio.
 * Timer do Undo (10s) vive aqui — nunca em JS.
 */
@CapacitorPlugin(name = "VisionarioQuickActions")
public class VisionarioQuickActionsPlugin extends Plugin {

    private static final long UNDO_WINDOW_MS = 10_000L;

    private static WeakReference<VisionarioQuickActionsPlugin> INSTANCE = new WeakReference<>(null);

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideUndoRunnable = () -> pushUndoState(false, null);

    @Override
    public void load() {
        super.load();
        INSTANCE = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(hideUndoRunnable);
        if (INSTANCE.get() == this) INSTANCE = new WeakReference<>(null);
        super.handleOnDestroy();
    }

    /** Chamado pelo QuickActionsReceiver. */
    static void dispatchAction(String action) {
        VisionarioQuickActionsPlugin p = INSTANCE.get();
        if (p == null) return;
        String type = mapAction(action);
        if (type == null) return;
        JSObject payload = new JSObject();
        payload.put("type", type);
        p.notifyListeners("action", payload);
    }

    private static String mapAction(String androidAction) {
        if (QuickActionsReceiver.ACTION_REGISTER.equals(androidAction)) return "register";
        if (QuickActionsReceiver.ACTION_FINISH.equals(androidAction)) return "finish";
        if (QuickActionsReceiver.ACTION_CONFIRM_AUTO.equals(androidAction)) return "confirm-auto";
        if (QuickActionsReceiver.ACTION_EDIT_AUTO.equals(androidAction)) return "edit-auto";
        if (QuickActionsReceiver.ACTION_DISCARD_AUTO.equals(androidAction)) return "discard-auto";
        if (QuickActionsReceiver.ACTION_UNDO.equals(androidAction)) return "undo";
        return null;
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, QuickActionsForegroundService.class);
        i.setAction(QuickActionsForegroundService.ACTION_START);
        applyContentExtras(i, call);
        startForegroundServiceCompat(ctx, i);
        JSObject r = new JSObject();
        r.put("started", true);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        mainHandler.removeCallbacks(hideUndoRunnable);
        Context ctx = getContext();
        Intent i = new Intent(ctx, QuickActionsForegroundService.class);
        i.setAction(QuickActionsForegroundService.ACTION_STOP);
        try { ctx.startService(i); } catch (IllegalStateException ignored) {}
        JSObject r = new JSObject();
        r.put("stopped", true);
        call.resolve(r);
    }

    @PluginMethod
    public void updateContent(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, QuickActionsForegroundService.class);
        i.setAction(QuickActionsForegroundService.ACTION_UPDATE);
        applyContentExtras(i, call);
        startForegroundServiceCompat(ctx, i);
        JSObject r = new JSObject();
        r.put("updated", true);
        call.resolve(r);
    }

    @PluginMethod
    public void showUndo(PluginCall call) {
        String resumo = call.getString("resumo");
        pushUndoState(true, resumo != null && !resumo.isEmpty() ? "Desfazer · " + resumo : "Desfazer");
        mainHandler.removeCallbacks(hideUndoRunnable);
        mainHandler.postDelayed(hideUndoRunnable, UNDO_WINDOW_MS);
        JSObject r = new JSObject();
        r.put("shown", true);
        call.resolve(r);
    }

    @PluginMethod
    public void hideUndo(PluginCall call) {
        mainHandler.removeCallbacks(hideUndoRunnable);
        pushUndoState(false, null);
        JSObject r = new JSObject();
        r.put("hidden", true);
        call.resolve(r);
    }

    // Reservado para o Checkpoint 3 (Auto Ride).
    @PluginMethod
    public void showAutoRideCandidate(PluginCall call) {
        call.resolve();
    }

    private void applyContentExtras(Intent i, PluginCall call) {
        String title = call.getString("title");
        String content = call.getString("content");
        if (title != null) i.putExtra(QuickActionsForegroundService.EXTRA_TITLE, title);
        if (content != null) i.putExtra(QuickActionsForegroundService.EXTRA_CONTENT, content);
    }

    private void pushUndoState(boolean visible, String label) {
        Context ctx = getContext();
        if (ctx == null) return;
        Intent i = new Intent(ctx, QuickActionsForegroundService.class);
        i.setAction(QuickActionsForegroundService.ACTION_UPDATE);
        i.putExtra(QuickActionsForegroundService.EXTRA_UNDO_VISIBLE, visible);
        if (label != null) i.putExtra(QuickActionsForegroundService.EXTRA_UNDO_LABEL, label);
        startForegroundServiceCompat(ctx, i);
    }

    private void startForegroundServiceCompat(Context ctx, Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (IllegalStateException ignored) {}
    }
}
