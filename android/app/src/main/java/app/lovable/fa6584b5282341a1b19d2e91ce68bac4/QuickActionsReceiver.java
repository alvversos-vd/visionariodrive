package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.RemoteInput;

/**
 * QuickActionsReceiver — Sprint 10.4.8.
 *
 * Traduz cliques dos botões da notificação em chamadas ao
 * VisionarioQuickActionsPlugin. Zero regra de negócio.
 *
 * "Registrar corrida" usa RemoteInput: o formulário rápido acontece
 * DENTRO da central de notificações. Nenhuma Activity é aberta — o
 * motorista continua no Uber/99/iFood. O texto digitado é entregue ao
 * pipeline oficial (NotificationActionService → RideService).
 *
 * Só "Editar corrida detectada" continua trazendo o app ao topo, pois
 * exige o BottomSheet React existente.
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

        if (ACTION_REGISTER.equals(action)) {
            String raw = readRemoteInput(intent);
            if (raw != null && !raw.trim().isEmpty()) {
                // Registro inline — sem abrir o app.
                VisionarioQuickActionsPlugin.dispatchAction(action, raw.trim());
                return;
            }
            // Sem texto (device sem suporte a inline reply): fallback para o
            // modal React oficial, trazendo o app ao topo.
            bringAppToFront(context);
            VisionarioQuickActionsPlugin.dispatchAction(action, null);
            return;
        }

        if (ACTION_EDIT_AUTO.equals(action)) {
            bringAppToFront(context);
        }

        VisionarioQuickActionsPlugin.dispatchAction(action, null);
    }

    private String readRemoteInput(Intent intent) {
        try {
            Bundle results = RemoteInput.getResultsFromIntent(intent);
            if (results == null) return null;
            CharSequence cs = results.getCharSequence(
                    QuickActionsForegroundService.EXTRA_QUICK_INPUT);
            return cs != null ? cs.toString() : null;
        } catch (Throwable ignored) {
            return null;
        }
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
