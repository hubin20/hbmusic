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
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

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
    private MediaSessionCompat mediaSession;
    private boolean isPlaying = false;
    private String currentTitle = "YMMusic正在播放";
    private String currentArtist = "点击返回应用";
    private Bitmap currentAlbumArt = null;

    // 定义广播接收器的Action常量
    public static final String ACTION_PLAY = "com.ymmusic.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.ymmusic.app.ACTION_PAUSE";
    public static final String ACTION_PREVIOUS = "com.ymmusic.app.ACTION_PREVIOUS";
    public static final String ACTION_NEXT = "com.ymmusic.app.ACTION_NEXT";

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

        // 初始化媒体会话
        initMediaSession();

        // 获取WakeLock，保持CPU运行
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "YMMusic:MusicWakeLock");
        wakeLock.acquire();
    }

    /**
     * 初始化媒体会话
     */
    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "YMMusicSession");
        
        // 设置媒体会话的回调
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                // 通知WebView播放
                sendCommandToWebView("play");
                isPlaying = true;
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                updateNotificationInfo(currentTitle, currentArtist, currentAlbumArt);
            }

            @Override
            public void onPause() {
                // 通知WebView暂停
                sendCommandToWebView("pause");
                isPlaying = false;
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                updateNotificationInfo(currentTitle, currentArtist, currentAlbumArt);
            }

            @Override
            public void onSkipToPrevious() {
                // 通知WebView播放上一首
                Log.d(TAG, "收到通知栏上一首命令，通知WebView");
                sendCommandToWebView("previous");
                // 在通知栏点击上一首后，不立即更新通知栏信息
                // 等待WebView处理完毕后，会通过updateNowPlaying方法更新
            }

            @Override
            public void onSkipToNext() {
                // 通知WebView播放下一首
                Log.d(TAG, "收到通知栏下一首命令，通知WebView");
                sendCommandToWebView("next");
                // 在通知栏点击下一首后，不立即更新通知栏信息
                // 等待WebView处理完毕后，会通过updateNowPlaying方法更新
            }
        });
        
        // 设置媒体会话标志
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | 
                             MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        
        // 激活媒体会话
        mediaSession.setActive(true);
    }

    /**
     * 更新媒体会话播放状态
     */
    private void updatePlaybackState(int state) {
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
                .setState(state, 0, 1.0f);
        
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    /**
     * 向WebView发送命令
     */
    private void sendCommandToWebView(String command) {
        Intent intent = new Intent("YM_MUSIC_CONTROL_ACTION");
        intent.putExtra("command", command);
        sendBroadcast(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "音乐播放服务已启动");

        // 处理媒体按钮事件
        MediaButtonReceiver.handleIntent(mediaSession, intent);

        // 处理自定义Action
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_PLAY:
                    mediaSession.getController().getTransportControls().play();
                    break;
                case ACTION_PAUSE:
                    mediaSession.getController().getTransportControls().pause();
                    break;
                case ACTION_PREVIOUS:
                    mediaSession.getController().getTransportControls().skipToPrevious();
                    break;
                case ACTION_NEXT:
                    mediaSession.getController().getTransportControls().skipToNext();
                    break;
            }
        }

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

        // 释放媒体会话
        if (mediaSession != null) {
            mediaSession.release();
        }

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
        // 创建带有媒体控制的通知
        return createMediaStyleNotification(currentTitle, currentArtist, currentAlbumArt);
    }

    /**
     * 创建媒体样式通知
     */
    private Notification createMediaStyleNotification(String title, String artist, Bitmap albumArt) {
        // 主Activity的PendingIntent
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        // 播放/暂停按钮的PendingIntent
        Intent playPauseIntent = new Intent(this, MusicPlaybackService.class);
        playPauseIntent.setAction(isPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent playPausePendingIntent = PendingIntent.getService(
                this, 0, playPauseIntent, PendingIntent.FLAG_IMMUTABLE);

        // 上一首按钮的PendingIntent
        Intent previousIntent = new Intent(this, MusicPlaybackService.class);
        previousIntent.setAction(ACTION_PREVIOUS);
        PendingIntent previousPendingIntent = PendingIntent.getService(
                this, 0, previousIntent, PendingIntent.FLAG_IMMUTABLE);

        // 下一首按钮的PendingIntent
        Intent nextIntent = new Intent(this, MusicPlaybackService.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPendingIntent = PendingIntent.getService(
                this, 0, nextIntent, PendingIntent.FLAG_IMMUTABLE);

        // 如果没有专辑封面，使用默认图标
        if (albumArt == null) {
            albumArt = BitmapFactory.decodeResource(getResources(), 
                    getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()));
        }

        // 创建媒体样式通知
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(artist)
                .setSmallIcon(getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()))
                .setLargeIcon(albumArt)
                .setContentIntent(contentIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                // 添加媒体控制按钮
                .addAction(android.R.drawable.ic_media_previous, "上一首", previousPendingIntent)
                .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, 
                        isPlaying ? "暂停" : "播放", playPausePendingIntent)
                .addAction(android.R.drawable.ic_media_next, "下一首", nextPendingIntent)
                // 设置媒体样式
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)); // 显示所有三个按钮

        return builder.build();
    }

    /**
     * 更新通知信息
     * @param title 歌曲标题
     * @param artist 艺术家
     */
    public void updateNotificationInfo(String title, String artist) {
        updateNotificationInfo(title, artist, null);
    }

    /**
     * 更新通知信息
     * @param title 歌曲标题
     * @param artist 艺术家
     * @param albumArt 专辑封面
     */
    public void updateNotificationInfo(String title, String artist, Bitmap albumArt) {
        // 更新当前信息
        Log.d(TAG, "更新通知栏信息: " + title + " - " + artist);
        this.currentTitle = title;
        this.currentArtist = artist;
        if (albumArt != null) {
            this.currentAlbumArt = albumArt;
        }

        // 更新通知
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(NOTIFICATION_ID, createMediaStyleNotification(title, artist, this.currentAlbumArt));
    }

    /**
     * 设置播放状态
     * @param isPlaying 是否正在播放
     */
    public void setPlayingState(boolean isPlaying) {
        this.isPlaying = isPlaying;
        updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
        updateNotificationInfo(currentTitle, currentArtist, currentAlbumArt);
    }
} 