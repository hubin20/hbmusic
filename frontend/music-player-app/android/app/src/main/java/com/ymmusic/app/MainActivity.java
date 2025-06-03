package com.ymmusic.app;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.app.Activity;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private MusicPlaybackService musicService;
    private boolean isBound = false;
    
    // 广播接收器，用于接收来自服务的命令
    private BroadcastReceiver musicControlReceiver;
    
    /**
     * 与服务的连接
     */
    private ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            MusicPlaybackService.LocalBinder binder = (MusicPlaybackService.LocalBinder) service;
            musicService = binder.getService();
            isBound = true;
            Log.d(TAG, "已连接到音乐播放服务");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            isBound = false;
            Log.d(TAG, "与音乐播放服务断开连接");
        }
    };
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 添加JavaScript接口
        bridge.getWebView().addJavascriptInterface(new WebAppInterface(this), "AndroidPlayer");
        
        // 启动音乐播放服务
        startMusicService();
        
        // 注册广播接收器，用于接收来自服务的命令
        registerMusicControlReceiver();
    }
    
    /**
     * 注册音乐控制广播接收器
     */
    private void registerMusicControlReceiver() {
        musicControlReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent.getAction().equals("YM_MUSIC_CONTROL_ACTION")) {
                    String command = intent.getStringExtra("command");
                    if (command != null) {
                        // 执行JavaScript调用WebView中的方法
                        final String jsCode;
                        switch (command) {
                            case "play":
                                jsCode = "if(window.playerControls) window.playerControls.play();";
                                break;
                            case "pause":
                                jsCode = "if(window.playerControls) window.playerControls.pause();";
                                break;
                            case "previous":
                                jsCode = "if(window.playerControls) window.playerControls.previous();";
                                break;
                            case "next":
                                jsCode = "if(window.playerControls) window.playerControls.next();";
                                break;
                            default:
                                jsCode = null;
                        }
                        
                        if (jsCode != null) {
                            runOnUiThread(() -> {
                                bridge.getWebView().evaluateJavascript(jsCode, null);
                            });
                        }
                    }
                }
            }
        };
        
        IntentFilter filter = new IntentFilter("YM_MUSIC_CONTROL_ACTION");
        registerReceiver(musicControlReceiver, filter);
    }
    
    /**
     * 重写返回键行为，使应用最小化而不是退出
     * 这样音乐可以在后台继续播放
     */
    @Override
    public void onBackPressed() {
        Log.d(TAG, "返回键被按下: 最小化应用而不是退出");
        // 移动应用到后台而不是结束它
        moveTaskToBack(true);
    }
    
    @Override
    public void onStart() {
        super.onStart();
        // 绑定服务
        if (!isBound) {
            Intent intent = new Intent(this, MusicPlaybackService.class);
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
        }
    }
    
    @Override
    public void onStop() {
        super.onStop();
        // 解绑服务，但不停止它，允许在后台继续播放
        if (isBound) {
            unbindService(serviceConnection);
            isBound = false;
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        // 注销广播接收器
        if (musicControlReceiver != null) {
            unregisterReceiver(musicControlReceiver);
        }
    }
    
    /**
     * 启动音乐播放服务
     */
    private void startMusicService() {
        Intent intent = new Intent(this, MusicPlaybackService.class);
        startForegroundService(intent);
    }
    
    /**
     * 为WebView提供的JavaScript接口
     */
    public class WebAppInterface {
        Context mContext;

        /**
         * 构造函数
         */
        WebAppInterface(Context c) {
            mContext = c;
        }
        
        /**
         * 更新当前播放歌曲信息
         */
        @JavascriptInterface
        public void updateNowPlaying(String title, String artist) {
            if (isBound && musicService != null) {
                musicService.updateNotificationInfo(title, artist);
            }
        }
        
        /**
         * 更新当前播放歌曲信息（包含专辑封面URL）
         */
        @JavascriptInterface
        public void updateNowPlayingWithCover(String title, String artist, String albumArtUrl) {
            if (isBound && musicService != null) {
                // 这里可以添加下载专辑封面的代码
                // 简单起见，我们先使用默认图标
                musicService.updateNotificationInfo(title, artist);
            }
        }
        
        /**
         * 设置播放状态
         */
        @JavascriptInterface
        public void setPlayingState(boolean isPlaying) {
            if (isBound && musicService != null) {
                musicService.setPlayingState(isPlaying);
            }
        }
        
        /**
         * 检查服务是否运行
         */
        @JavascriptInterface
        public boolean isServiceRunning() {
            return isBound && musicService != null;
        }
    }
}
