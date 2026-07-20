package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * VisionarioQuickActionsPlugin — Sprint 7 · Checkpoint 1.
 *
 * Transporte puro. Não acessa storage nem regras de negócio.
 * Expõe start/stop/updateContent para o NotificationActionService (TS)
 * controlar o foreground service. Timers permanentes ficam do lado
 * Android (nunca em JS).
 *
 * Checkpoint 2/3: showAutoRideCandidate, showUndo, hideUndo e
 * dispatch de ações via notifyListeners("action", ...).
 */
@CapacitorPlugin(name = "VisionarioQuickActions")
public class VisionarioQuickActionsPlugin extends Plugin {

    private static WeakReference<VisionarioQuickActionsPlugin> INSTANCE = new WeakReference<>(null);

    @Override
    public void load() {
        super.load();
        INSTANCE = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (INSTANCE.get() == this) INSTANCE = new WeakReference<>(null);
        super.handleOnDestroy();
    }

    /** Chamado pelo QuickActionsReceiver (Checkpoint 2/3). */
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

    private void applyContentExtras(Intent i, PluginCall call) {
        String title = call.getString("title");
        String content = call.getString("content");
        if (title != null) i.putExtra(QuickActionsForegroundService.EXTRA_TITLE, title);
        if (content != null) i.putExtra(QuickActionsForegroundService.EXTRA_CONTENT, content);
    }

    private void startForegroundServiceCompat(Context ctx, Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (IllegalStateException ignored) {
            // Sem turno ativo em foreground — swallow para não crashar.
        }
    }
}
