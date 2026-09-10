package com.chamaja.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class ChamaJaFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "chamaja_general";
    public static final String PREFS_NAME = "chamaja_prefs";
    public static final String PREF_FCM_TOKEN = "fcm_token";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_FCM_TOKEN, token)
            .apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        String title = "ChamaJá";
        String body = "Você tem uma nova atualização.";
        if (message.getNotification() != null) {
            if (message.getNotification().getTitle() != null) {
                title = message.getNotification().getTitle();
            }
            if (message.getNotification().getBody() != null) {
                body = message.getNotification().getBody();
            }
        } else {
            if (message.getData().containsKey("title")) {
                title = message.getData().get("title");
            }
            if (message.getData().containsKey("body")) {
                body = message.getData().get("body");
            }
        }

        showNotification(title, body, message);
    }

    private void showNotification(String title, String body, RemoteMessage message) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Atualizações do ChamaJá",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Pedidos, mensagens, pagamentos e andamento dos serviços.");
            manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (String key : message.getData().keySet()) {
            intent.putExtra(key, message.getData().get(key));
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() & 0xfffffff),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(Notification.PRIORITY_HIGH);

        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
    }
}
