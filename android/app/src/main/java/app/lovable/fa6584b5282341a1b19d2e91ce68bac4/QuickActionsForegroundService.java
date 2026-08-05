package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * QuickActionsForegroundService — Sprint 7 · Checkpoint 3.
 *
 * Foreground Service ongoing usado durante o turno ativo.
 * Não contém regra de negócio. Recebe comandos do plugin e atualiza
 * uma única notificação persistente (mesmo id) via notify(id, ...).
 *
 * Botões:
 *   - Registrar corrida  (sempre)
 *   - Finalizar turno    (sempre)
 *   - Desfazer           (apenas quando undoVisible)
 *   - Confirmar/Editar/Descartar (apenas quando autoVisible — CP3)
 *
 * Precedência visual: quando autoVisible=true, os botões da corrida
 * detectada substituem Registrar/Finalizar. Undo permanece independente.
 */
public class QuickActionsForegroundService extends Service {

    public static final String CHANNEL_ID = "visionario_shift";
    public static final int NOTIFICATION_ID = 8421;

    public static final String ACTION_START = "app.lovable.visionariodrive.qa.START";
    public static final String ACTION_STOP = "app.lovable.visionariodrive.qa.STOP";
    public static final String ACTION_UPDATE = "app.lovable.visionariodrive.qa.UPDATE";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_CONTENT = "extra_content";
    public static final String EXTRA_UNDO_VISIBLE = "extra_undo_visible";
    public static final String EXTRA_UNDO_LABEL = "extra_undo_label";
    public static final String EXTRA_AUTO_VISIBLE = "extra_auto_visible";
    public static final String EXTRA_AUTO_LABEL = "extra_auto_label";

    private String currentTitle = "Turno em andamento";
    private String currentContent = "Aguardando dados do turno";
    private boolean undoVisible = false;
    private String undoLabel = "Desfazer";
    private boolean isForeground = false;
    private boolean autoVisible = false;
    private String autoLabel = "Corrida detectada";

    @Override
    public void onCreate() {
        super.onCreate();
        try { ensureChannel(); } catch (Throwable ignored) { /* noop */ }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Sprint 10.4.7 — blindagem total: nenhuma falha deste serviço pode
        // derrubar o processo antes do Bridge Capacitor.
        try {
            return handleStartCommand(intent);
        } catch (Throwable t) {
            try { stopForegroundCompat(); } catch (Throwable ignored) { /* noop */ }
            try { stopSelf(); } catch (Throwable ignored) { /* noop */ }
            return START_NOT_STICKY;
        }
    }

    private int handleStartCommand(Intent intent) {
        // Sprint 10.4.6 — proteção de boot.
        // Um restart do sistema (START_STICKY / crash / update) reentrega o
        // Service com intent == null e o app em background. Nesse cenário o
        // Android 14+ recusa startForeground() e mata o processo ANTES do
        // Bridge Capacitor iniciar. O turno é sempre restaurado pelo JS,
        // então aqui apenas encerramos o serviço órfão.
        if (intent == null) {
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        String t = intent.getStringExtra(EXTRA_TITLE);
        String c = intent.getStringExtra(EXTRA_CONTENT);
        if (t != null && !t.isEmpty()) currentTitle = t;
        if (c != null && !c.isEmpty()) currentContent = c;
        if (intent.hasExtra(EXTRA_UNDO_VISIBLE)) {
            undoVisible = intent.getBooleanExtra(EXTRA_UNDO_VISIBLE, false);
        }
        String lbl = intent.getStringExtra(EXTRA_UNDO_LABEL);
        if (lbl != null && !lbl.isEmpty()) undoLabel = lbl;
        if (intent.hasExtra(EXTRA_AUTO_VISIBLE)) {
            autoVisible = intent.getBooleanExtra(EXTRA_AUTO_VISIBLE, false);
        }
        String alb = intent.getStringExtra(EXTRA_AUTO_LABEL);
        if (alb != null && !alb.isEmpty()) autoLabel = alb;

        if (ACTION_STOP.equals(action)) {
            undoVisible = false;
            autoVisible = false;
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification n = buildNotification();

        if (ACTION_UPDATE.equals(action) && isForeground) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            try {
                if (nm != null) nm.notify(NOTIFICATION_ID, n);
            } catch (Throwable ignored) { /* notificações desativadas */ }
        } else {
            try {
                // Sprint 10.4.7 — NUNCA usar FOREGROUND_SERVICE_TYPE_LOCATION aqui.
                // Este serviço não acessa GPS. Em Android 14+ (API 34) usamos
                // SPECIAL_USE, declarado no manifest. Em APIs anteriores o tipo
                // `specialUse` não existe: startForeground() sem tipo é o único
                // caminho válido (passar um tipo não declarado → SecurityException).
                if (Build.VERSION.SDK_INT >= 34) {
                    ServiceCompat.startForeground(
                            this,
                            NOTIFICATION_ID,
                            n,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    );
                } else {
                    startForeground(NOTIFICATION_ID, n);
                }
                isForeground = true;
            } catch (Throwable e) {
                // Ex.: SecurityException / ForegroundServiceStartNotAllowedException.
                // Nunca propagar: derrubaria o processo do app antes do Bridge.
                isForeground = false;
                try { stopForegroundCompat(); } catch (Throwable ignored) { /* noop */ }
                stopSelf();
                return START_NOT_STICKY;
            }
        }


        return START_NOT_STICKY;
    }

    private void stopForegroundCompat() {
        isForeground = false;
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        } catch (Exception ignored) { /* noop */ }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Turno ativo",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Notificação persistente do turno em andamento");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);
    }

    private PendingIntent broadcastPI(String action, int requestCode) {
        Intent i = new Intent(this, QuickActionsReceiver.class);
        i.setAction(action);
        i.setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(this, requestCode, i, flags);
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openApp, piFlags);

        String bodyText = autoVisible
                ? autoLabel + "\n" + currentContent
                : currentContent;

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_visionario)
                .setContentTitle(currentTitle)
                .setContentText(autoVisible ? autoLabel : currentContent)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyText))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(contentIntent);

        if (autoVisible) {
            b.addAction(
                    android.R.drawable.ic_menu_send,
                    "Confirmar",
                    broadcastPI(QuickActionsReceiver.ACTION_CONFIRM_AUTO, 10)
            ).addAction(
                    android.R.drawable.ic_menu_edit,
                    "Editar",
                    broadcastPI(QuickActionsReceiver.ACTION_EDIT_AUTO, 11)
            ).addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "Descartar",
                    broadcastPI(QuickActionsReceiver.ACTION_DISCARD_AUTO, 12)
            );
        } else {
            b.addAction(
                    android.R.drawable.ic_input_add,
                    "Registrar",
                    broadcastPI(QuickActionsReceiver.ACTION_REGISTER, 1)
            ).addAction(
                    android.R.drawable.ic_media_pause,
                    "Finalizar",
                    broadcastPI(QuickActionsReceiver.ACTION_FINISH, 2)
            );
            if (undoVisible) {
                b.addAction(
                        android.R.drawable.ic_menu_revert,
                        undoLabel,
                        broadcastPI(QuickActionsReceiver.ACTION_UNDO, 3)
                );
            }
        }

        return b.build();
    }
}
