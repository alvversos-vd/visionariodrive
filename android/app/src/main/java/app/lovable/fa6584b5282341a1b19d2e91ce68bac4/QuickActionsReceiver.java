package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * QuickActionsReceiver — Sprint 7 · Checkpoint 1.
 *
 * Placeholder de infraestrutura. Registrado no manifest para que os
 * PendingIntents dos botões (Checkpoint 2/3) já tenham um alvo estável.
 * Traduzirá cliques em chamadas ao VisionarioQuickActionsPlugin via
 * notifyListeners("action", { type, payload? }).
 *
 * Nesta etapa nada é despachado — o plugin ainda não expõe os handlers
 * de ação. Fase 1 (infra) apenas garante o pipeline visual.
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
        VisionarioQuickActionsPlugin.dispatchAction(action);
    }
}
