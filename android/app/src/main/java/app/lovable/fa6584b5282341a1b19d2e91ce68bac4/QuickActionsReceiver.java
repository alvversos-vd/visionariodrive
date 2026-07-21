package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * QuickActionsReceiver — Sprint 7 · Checkpoint 3.
 *
 * Traduz cliques dos botões da notificação em chamadas ao
 * VisionarioQuickActionsPlugin. Zero regra de negócio.
 *
 * Para ações que exigem UI React (Registrar, Editar corrida detectada),
 * também traz a MainActivity para o topo — o restante da lógica ocorre
 * no JS via EventBus.
 */
public class QuickActionsReceiver extends BroadcastReceiver {

    public static final String ACTION_REGISTER = "app.lovable.visionariodrive.qa.action.REGISTER";
    public static final String ACTION_FINISH = "app.lovable.visionariodrive.qa.action.FINISH";
    public static final String ACTION_CONFIRM_AUTO = "app.lovable.visionariodrive.qa.action.CONFIRM_AUTO";
    public static final String ACTION_EDIT_AUTO = "app.lovable.visionariodrive.qa.action.EDIT_AUTO";
    public static final String ACTION_DISCARD_AUTO = "app.lovable.visionariodrive.qa.action.DISCARD_AUTO";
    public static final String ACTION_UNDO = "app.lovable.visionariodrive.qa.action.UNDO";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        if (ACTION_REGISTER.equals(action) || ACTION_EDIT_AUTO.equals(action)) {
            bringAppToFront(context);
        }

        VisionarioQuickActionsPlugin.dispatchAction(action);
    }

    private void bringAppToFront(Context context) {
        try {
            Intent i = new Intent(context, MainActivity.class);
            i.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            );
            context.startActivity(i);
        } catch (Exception ignored) { /* noop */ }
    }
}
