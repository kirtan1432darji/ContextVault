package com.contextvault;

import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class MediaObserverModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "MediaObserverModule";
    private ContentObserver contentObserver;
    private final ReactApplicationContext reactContext;

    public MediaObserverModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startObserving() {
        if (contentObserver != null) return;

        Handler handler = new Handler(Looper.getMainLooper());
        contentObserver = new ContentObserver(handler) {
            @Override
            public void onChange(boolean selfChange, Uri uri) {
                super.onChange(selfChange, uri);
                checkLatestScreenshot();
            }
        };

        reactContext.getContentResolver().registerContentObserver(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                true,
                contentObserver
        );
    }

    @ReactMethod
    public void stopObserving() {
        if (contentObserver != null) {
            reactContext.getContentResolver().unregisterContentObserver(contentObserver);
            contentObserver = null;
        }
    }

    private void checkLatestScreenshot() {
        String[] projection = {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.DATE_ADDED
        };

        String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";

        try (Cursor cursor = reactContext.getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
                int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
                int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH);
                int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT);

                String filePath = cursor.getString(dataCol);
                String fileName = cursor.getString(nameCol);
                long fileSize = cursor.getLong(sizeCol);
                int width = cursor.getInt(widthCol);
                int height = cursor.getInt(heightCol);

                // Detect if the media item is a screenshot by path or name heuristics
                if (filePath != null && (
                        filePath.toLowerCase().contains("screenshot") ||
                        (fileName != null && fileName.toLowerCase().contains("screenshot"))
                )) {
                    WritableMap params = Arguments.createMap();
                    params.putString("filePath", filePath);
                    params.putString("fileName", fileName);
                    params.putDouble("fileSize", fileSize);
                    params.putInt("width", width);
                    params.putInt("height", height);
                    params.putDouble("timestamp", System.currentTimeMillis());

                    sendEvent("onScreenshotDetected", params);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for RN built-in Event Emitter Calls.
    }
}
