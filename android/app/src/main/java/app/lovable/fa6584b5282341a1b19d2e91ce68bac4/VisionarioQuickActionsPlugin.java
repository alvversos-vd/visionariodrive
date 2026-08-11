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

import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

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
    private static final java.util.List<JSObject> PENDING = new java.util.ArrayList<>();

    private final Runnable hideUndoRunnable = () -> pushUndoState(false, null);

    @Override
    public void load() {
        super.load();
        INSTANCE = new WeakReference<>(this);
        flushPending();
        flushPersisted();
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(hideUndoRunnable);
        if (INSTANCE.get() == this) INSTANCE = new WeakReference<>(null);
        super.handleOnDestroy();
    }

    /** Fila durável (sobrevive à morte do processo) para payloads do Quick Form. */
    private static final String PREFS = "visionario_quick_actions";
    private static final String KEY_QUEUE = "pending_forms";

    /**
     * Sprint 10.5 (ADR-015) — payload do Quick Form nativo.
     *
     * Transporte puro: a Activity coleta, o plugin transporta, o
     * NotificationActionService interpreta (`kmSource` → `kmOrigin`) e o
     * RideService persiste. Nenhuma regra de negócio aqui.
     */
    /**
     * Sprint 10.6.2 (LIM-001) — retorna o estado REAL da entrega:
     *   "delivered" → o pipeline TS recebeu a intenção agora (Bridge vivo).
     *   "hosting"   → sem Bridge vivo; o host invisível foi iniciado e vai
     *                 processar pelo MESMO pipeline em instantes.
     *   "queued"    → intenção gravada na fila durável; será entregue assim
     *                 que o Bridge carregar. NUNCA é sucesso de registro.
     *   "failed"    → não foi possível nem enfileirar.
     *
     * A intenção é SEMPRE persistida antes do dispatch e só é removida
     * quando o pipeline oficial confirma via {@link #ackQuickForm}. A fila
     * é transporte/recovery — nunca uma segunda fonte de verdade.
     */
    static String dispatchQuickForm(
            Context appContext,
            double value,
            double km,
            String kmSource,
            String clientRequestId,
            String notes
    ) {
        JSObject form = new JSObject();
        form.put("contractVersion", 1);
        form.put("value", value);
        form.put("km", km);
        form.put("kmSource", kmSource);
        form.put("clientRequestId", clientRequestId);
        if (notes != null && !notes.isEmpty()) form.put("notes", notes);

        JSObject payload = new JSObject();
        payload.put("type", "register");
        payload.put("form", form);

        boolean persisted = persistPending(appContext, payload);

        VisionarioQuickActionsPlugin p = INSTANCE.get();
        if (p != null) {
            try {
                p.notifyListeners("action", payload);
                return "delivered";
            } catch (Throwable ignored) { /* cai no host invisível abaixo */ }
        }

        // LIM-001: sem Bridge vivo. Em vez de esperar o motorista abrir o app,
        // sobe o HOST INVISÍVEL do Bridge oficial — mesmo bundle, mesmo
        // pipeline, mesmo storage. Nada é gravado aqui.
        if (persisted && BridgeHostActivity.start(appContext)) return "hosting";
        return persisted ? "queued" : "failed";
    }

    private static boolean persistPending(Context ctx, JSObject payload) {
        if (ctx == null) return false;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(KEY_QUEUE, "[]"));
            arr.put(new JSONObject(payload.toString()));
            // commit() (síncrono): a intenção precisa estar em disco ANTES de
            // qualquer feedback ao motorista.
            return prefs.edit().putString(KEY_QUEUE, arr.toString()).commit();
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** Remove a intenção da fila durável pelo clientRequestId. */
    private static void removePending(Context ctx, String clientRequestId) {
        if (ctx == null || clientRequestId == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(KEY_QUEUE, "[]"));
            JSONArray next = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                JSONObject form = o.optJSONObject("form");
                String id = form != null ? form.optString("clientRequestId", "") : "";
                if (clientRequestId.equals(id)) continue;
                next.put(o);
            }
            prefs.edit().putString(KEY_QUEUE, next.toString()).commit();
            // Fila vazia → o pipeline oficial confirmou tudo. Se quem está
            // hospedando o Bridge é o host invisível, ele pode encerrar.
            if (next.length() == 0) BridgeHostActivity.notifyDrained();
        } catch (Throwable ignored) { }
    }

    /**
     * Confirmação do pipeline oficial: a intenção virou corrida (ou foi
     * reconhecida como duplicata idempotente). Só então sai da fila.
     */
    /**
     * Sprint 10.6.2 — reentrega das intenções pendentes sob demanda.
     * Chamado pelo TS logo após o listener oficial ser registrado, para
     * cobrir a corrida entre `load()` (Bridge) e o mount do bundle React.
     * Apenas transporte: nada é gravado nem removido aqui.
     */
    @PluginMethod
    public void flushPending(PluginCall call) {
        flushPersisted();
        JSObject r = new JSObject();
        r.put("flushed", true);
        call.resolve(r);
    }

    @PluginMethod
    public void ackQuickForm(PluginCall call) {
        removePending(getContext(), call.getString("clientRequestId"));
        JSObject r = new JSObject();
        r.put("acked", true);
        call.resolve(r);
    }

    private void flushPersisted() {
        Context ctx = getContext();
        if (ctx == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_QUEUE, "[]");
            if ("[]".equals(raw)) return;
            // NÃO remove aqui: a intenção só sai da fila via ackQuickForm,
            // depois que o pipeline oficial confirmou a persistência.
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                notifyListeners("action", JSObject.fromJSONObject(o));
            }
        } catch (Throwable ignored) { }
    }

    /** Chamado pelo QuickActionsReceiver. */
    static void dispatchAction(String action, String raw) {
        String type = mapAction(action);
        if (type == null) return;
        JSObject payload = new JSObject();
        payload.put("type", type);
        if (raw != null && !raw.isEmpty()) payload.put("raw", raw);

        VisionarioQuickActionsPlugin p = INSTANCE.get();
        if (p == null) {
            // Bridge ainda não carregado (processo reiniciado pelo FGS).
            // Fila em memória — sem storage paralelo. Entregue em load().
            synchronized (PENDING) { PENDING.add(payload); }
            return;
        }
        p.notifyListeners("action", payload);
    }

    private void flushPending() {
        java.util.List<JSObject> copy;
        synchronized (PENDING) {
            if (PENDING.isEmpty()) return;
            copy = new java.util.ArrayList<>(PENDING);
            PENDING.clear();
        }
        for (JSObject payload : copy) notifyListeners("action", payload);
    }

    /** Toast nativo curto — feedback sem abrir o app (Sprint 10.4.8). */
    @PluginMethod
    public void showToast(PluginCall call) {
        final String message = call.getString("message");
        final Context ctx = getContext();
        if (ctx != null && message != null && !message.isEmpty()) {
            mainHandler.post(() ->
                    android.widget.Toast.makeText(ctx, message, android.widget.Toast.LENGTH_SHORT).show());
        }
        JSObject r = new JSObject();
        r.put("shown", true);
        call.resolve(r);
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
        try { ctx.startService(i); } catch (Throwable ignored) {}
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

    @PluginMethod
    public void showAutoRideCandidate(PluginCall call) {
        String label = call.getString("resumo");
        pushAutoState(true, label != null && !label.isEmpty() ? label : "Corrida detectada");
        JSObject r = new JSObject();
        r.put("shown", true);
        call.resolve(r);
    }

    @PluginMethod
    public void hideAutoRideCandidate(PluginCall call) {
        pushAutoState(false, null);
        JSObject r = new JSObject();
        r.put("hidden", true);
        call.resolve(r);
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

    private void pushAutoState(boolean visible, String label) {
        Context ctx = getContext();
        if (ctx == null) return;
        Intent i = new Intent(ctx, QuickActionsForegroundService.class);
        i.setAction(QuickActionsForegroundService.ACTION_UPDATE);
        i.putExtra(QuickActionsForegroundService.EXTRA_AUTO_VISIBLE, visible);
        if (label != null) i.putExtra(QuickActionsForegroundService.EXTRA_AUTO_LABEL, label);
        startForegroundServiceCompat(ctx, i);
    }

    private void startForegroundServiceCompat(Context ctx, Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Throwable ignored) {}
    }
}
