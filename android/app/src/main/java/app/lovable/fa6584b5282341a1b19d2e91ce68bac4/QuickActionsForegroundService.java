package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * QuickActionsForegroundService — Sprint 7 · Checkpoint 2.
 *
 * Foreground Service ongoing usado durante o turno ativo.
 * Não contém regra de negócio. Recebe comandos do plugin e atualiza
 * uma única notificação persistente (mesmo id) via notify(id, ...).
 *
 * Botões (PendingIntent.getBroadcast → QuickActionsReceiver → Plugin):
 *   - Registrar corrida  (sempre)
 *   - Finalizar turno    (sempre)
 *   - Desfazer           (apenas quando showUndo estiver ativo)
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

    private String currentTitle = "Turno em andamento";
    private String currentContent = "Aguardando dados do turno";
    private boolean undoVisible = false;
    private String undoLabel = "Desfazer";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (intent != null) {
            String t = intent.getStringExtra(EXTRA_TITLE);
            String c = intent.getStringExtra(EXTRA_CONTENT);
            if (t != null && !t.isEmpty()) currentTitle = t;
            if (c != null && !c.isEmpty()) currentContent = c;
            if (intent.hasExtra(EXTRA_UNDO_VISIBLE)) {
                undoVisible = intent.getBooleanExtra(EXTRA_UNDO_VISIBLE, false);
            }
            String lbl = intent.getStringExtra(EXTRA_UNDO_LABEL);
            if (lbl != null && !lbl.isEmpty()) undoLabel = lbl;
        }

        if (ACTION_STOP.equals(action)) {
            undoVisible = false;
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification n = buildNotification();

        if (ACTION_UPDATE.equals(action)) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, n);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }

        return START_STICKY;
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

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentTitle(currentTitle)
                .setContentText(currentContent)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(currentContent))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(contentIntent)
                .addAction(
                        android.R.drawable.ic_input_add,
                        "Registrar",
                        broadcastPI(QuickActionsReceiver.ACTION_REGISTER, 1)
                )
                .addAction(
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

        return b.build();
    }
}
