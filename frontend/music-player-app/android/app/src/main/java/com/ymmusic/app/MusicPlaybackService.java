package com.ymmusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * 后台音乐播放服务
 * 使用前台服务保持音频在后台播放和屏幕关闭时继续播放
 */
public class MusicPlaybackService extends Service {
    private static final String TAG = "MusicPlaybackService";
    private static final int NOTIFICATION_ID = 1;
    private static final String CHANNEL_ID = "MusicPlaybackChannel";

    private final IBinder mBinder = new LocalBinder();
    private PowerManager.WakeLock wakeLock;

    /**
     * 本地绑定器
     */
    public class LocalBinder extends Binder {
        MusicPlaybackService getService() {
            return MusicPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "音乐播放服务已创建");

        // 创建通知渠道
        createNotificationChannel();

        // 获取WakeLock，保持CPU运行
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "YMMusic:MusicWakeLock");
        wakeLock.acquire();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "音乐播放服务已启动");

        // 启动前台服务，显示通知
        startForeground(NOTIFICATION_ID, createNotification());

        // 如果服务被杀死，系统将尝试重新创建服务
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return mBinder;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "音乐播放服务已销毁");

        // 释放WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        super.onDestroy();
    }

    /**
     * 创建通知渠道
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "音乐播放通知",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("用于显示当前正在播放的音乐");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    /**
     * 创建通知
     */
    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()));

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("YMMusic正在播放")
                .setContentText("点击返回应用")
                .setSmallIcon(getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()))
                .setLargeIcon(largeIcon)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .build();
    }

    /**
     * 更新通知信息
     * @param title 歌曲标题
     * @param artist 艺术家
     */
    public void updateNotificationInfo(String title, String artist) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()));

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(artist)
                .setSmallIcon(getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()))
                .setLargeIcon(largeIcon)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .build();

        notificationManager.notify(NOTIFICATION_ID, notification);
    }
} 