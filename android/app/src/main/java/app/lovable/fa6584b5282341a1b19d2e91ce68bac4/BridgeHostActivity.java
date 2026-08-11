package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

import java.lang.ref.WeakReference;

/**
 * BridgeHostActivity — Sprint 10.6.2 (LIM-001).
 *
 * HOST INVISÍVEL do Bridge oficial do Capacitor.
 *
 * Não é um segundo app, não é uma segunda tela, não tem UI e não tem
 * regra de negócio. Sua única razão de existir: quando a MainActivity
 * foi destruída, o runtime JS oficial (mesmo bundle, mesmo
 * `localStorage`, mesmo pipeline) precisa existir para processar a
 * intenção do Quick Form.
 *
 * Regras:
 *   - Só é iniciado quando NÃO existe Bridge vivo
 *     ({@link VisionarioQuickActionsPlugin} INSTANCE == null). Nunca há
 *     dois WebViews concorrendo pelo mesmo `localStorage`.
 *   - Janela 1x1, transparente, sem foco e sem toque: o motorista
 *     continua no Uber/99/iFood/Keeta.
 *   - Encerra sozinho assim que a fila durável é drenada (ack do
 *     pipeline oficial) ou após o timeout de segurança.
 *   - Nenhuma navegação, nenhum Dashboard, nenhuma MainActivity.
 */
public class BridgeHostActivity extends BridgeActivity {

    /** Teto de vida do host. Se o pipeline não confirmar, a intenção
     *  permanece na fila durável para nova tentativa. */
    private static final long MAX_LIFETIME_MS = 30_000L;

    private static WeakReference<BridgeHostActivity> HOST = new WeakReference<>(null);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable lifetimeGuard = this::finishHost;

    /**
     * Sobe o host invisível. Chamado apenas pelo plugin, e apenas quando
     * o Bridge oficial não está disponível.
     *
     * @return true se o host já existe ou foi iniciado com sucesso.
     */
    static boolean start(Context ctx) {
        if (ctx == null) return false;
        if (HOST.get() != null) return true;
        try {
            Intent i = new Intent(ctx, BridgeHostActivity.class);
            i.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_NO_ANIMATION
                            | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            );
            ctx.startActivity(i);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Fila durável vazia → o pipeline oficial confirmou tudo. */
    static void notifyDrained() {
        final BridgeHostActivity a = HOST.get();
        if (a == null) return;
        a.handler.post(a::finishHost);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VisionarioPermissionsPlugin.class);
        registerPlugin(VisionarioQuickActionsPlugin.class);
        super.onCreate(savedInstanceState);

        HOST = new WeakReference<>(this);

        // Invisível e intocável: o app de entrega em uso continua no controle.
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.width = 1;
        lp.height = 1;
        lp.dimAmount = 0f;
        lp.alpha = 0f;
        getWindow().setAttributes(lp);
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        );
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
            }
        } catch (Throwable ignored) { }
        overridePendingTransition(0, 0);

        handler.postDelayed(lifetimeGuard, MAX_LIFETIME_MS);
    }

    private void finishHost() {
        handler.removeCallbacks(lifetimeGuard);
        try {
            finish();
            overridePendingTransition(0, 0);
        } catch (Throwable ignored) { }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(lifetimeGuard);
        if (HOST.get() == this) HOST = new WeakReference<>(null);
        super.onDestroy();
    }
}
