package com.contextvault;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * ContextVault Native Android MediaStore Observer
 * Listens for screenshot captures across OEM folders (Samsung, Xiaomi, OnePlus, Oppo, Vivo, Realme, Google Pixel)
 * and extracts comprehensive metadata including SHA-256 hash.
 */
public class MediaObserverModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "MediaObserverModule";
    private static final int DEBOUNCE_DELAY_MS = 350;

    private ContentObserver contentObserver;
    private final ReactApplicationContext reactContext;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingDebounceRunnable;

    // Track last emitted asset to prevent duplicate ContentObserver trigger bursts
    private String lastEmittedAssetId = "";
    private long lastEmittedTimestamp = 0;

    // OEM & Common Screenshot path keywords
    private static final String[] SCREENSHOT_PATH_KEYWORDS = {
            "screenshot",
            "screen_shot",
            "screen-shot",
            "screencap",
            "screencapture",
            "pictures/screenshots",
            "dcim/screenshots",
            "dcim/screencapture",
            "samsung",
            "xiaomi",
            "miui",
            "oneplus",
            "oppo",
            "coloros",
            "vivo",
            "funtouch",
            "realme"
    };

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
        if (contentObserver != null) {
            return;
        }

        contentObserver = new ContentObserver(mainHandler) {
            @Override
            public void onChange(boolean selfChange, Uri uri) {
                super.onChange(selfChange, uri);
                scheduleDebouncedCheck();
            }
        };

        try {
            reactContext.getContentResolver().registerContentObserver(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    true,
                    contentObserver
            );
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void stopObserving() {
        if (pendingDebounceRunnable != null) {
            mainHandler.removeCallbacks(pendingDebounceRunnable);
            pendingDebounceRunnable = null;
        }

        if (contentObserver != null) {
            try {
                reactContext.getContentResolver().unregisterContentObserver(contentObserver);
            } catch (Exception ignored) {
            }
            contentObserver = null;
        }
    }

    private void scheduleDebouncedCheck() {
        if (pendingDebounceRunnable != null) {
            mainHandler.removeCallbacks(pendingDebounceRunnable);
        }

        pendingDebounceRunnable = () -> {
            checkLatestScreenshot(null);
        };

        mainHandler.postDelayed(pendingDebounceRunnable, DEBOUNCE_DELAY_MS);
    }

    @ReactMethod
    public void checkLatestScreenshot(Promise promise) {
        WritableMap screenshotMap = queryLatestScreenshot();

        if (promise != null) {
            promise.resolve(screenshotMap);
        } else if (screenshotMap != null) {
            sendEvent("onScreenshotDetected", screenshotMap);
        }
    }

    @ReactMethod
    public void queryRecentScreenshots(int limit, Promise promise) {
        try {
            WritableArray array = Arguments.createArray();
            String[] projection = getProjection();
            String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC LIMIT " + Math.max(1, limit);

            try (Cursor cursor = reactContext.getContentResolver().query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
            )) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        WritableMap map = parseCursorRow(cursor);
                        if (map != null) {
                            array.pushMap(map);
                        }
                    }
                }
            }
            promise.resolve(array);
        } catch (Exception e) {
            promise.reject("QUERY_ERROR", e.getMessage());
        }
    }

    private WritableMap queryLatestScreenshot() {
        String[] projection = getProjection();
        String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC LIMIT 5";

        try (Cursor cursor = reactContext.getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
        )) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap map = parseCursorRow(cursor);
                    if (map != null) {
                        String assetId = map.getString("deviceAssetId");
                        long now = System.currentTimeMillis();

                        // Avoid duplicate event burst within 1.5 seconds for identical asset
                        if (assetId != null && assetId.equals(lastEmittedAssetId) && (now - lastEmittedTimestamp < 1500)) {
                            continue;
                        }

                        lastEmittedAssetId = assetId;
                        lastEmittedTimestamp = now;
                        return map;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String[] getProjection() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return new String[]{
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DATA,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.SIZE,
                    MediaStore.Images.Media.WIDTH,
                    MediaStore.Images.Media.HEIGHT,
                    MediaStore.Images.Media.DATE_ADDED,
                    MediaStore.Images.Media.DATE_TAKEN,
                    MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
                    MediaStore.Images.Media.RELATIVE_PATH
            };
        } else {
            return new String[]{
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DATA,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.SIZE,
                    MediaStore.Images.Media.WIDTH,
                    MediaStore.Images.Media.HEIGHT,
                    MediaStore.Images.Media.DATE_ADDED,
                    MediaStore.Images.Media.DATE_TAKEN,
                    MediaStore.Images.Media.BUCKET_DISPLAY_NAME
            };
        }
    }

    private WritableMap parseCursorRow(Cursor cursor) {
        try {
            int idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
            int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
            int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH);
            int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT);
            int dateAddedCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
            int bucketCol = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME);

            long id = cursor.getLong(idCol);
            String filePath = cursor.getString(dataCol);
            String fileName = cursor.getString(nameCol);
            long fileSize = cursor.getLong(sizeCol);
            int width = cursor.getInt(widthCol);
            int height = cursor.getInt(heightCol);
            long dateAdded = cursor.getLong(dateAddedCol);
            String bucketName = bucketCol >= 0 ? cursor.getString(bucketCol) : "";
            String relativePath = "";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int relPathCol = cursor.getColumnIndex(MediaStore.Images.Media.RELATIVE_PATH);
                if (relPathCol >= 0) {
                    relativePath = cursor.getString(relPathCol);
                }
            }

            // Must have valid path and not 0 bytes (wait until image is actually written)
            if (filePath == null || fileSize <= 0) {
                return null;
            }

            // Check if item qualifies as a screenshot
            if (!isScreenshotPath(filePath, fileName, bucketName, relativePath)) {
                return null;
            }

            Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
            String fileHash = computeSHA256Hash(contentUri, filePath, fileSize, dateAdded);

            long timestamp = dateAdded > 0 ? dateAdded * 1000 : System.currentTimeMillis();

            WritableMap params = Arguments.createMap();
            params.putString("deviceAssetId", String.valueOf(id));
            params.putString("filePath", filePath);
            params.putString("fileName", fileName != null ? fileName : new File(filePath).getName());
            params.putDouble("fileSize", (double) fileSize);
            params.putInt("width", width > 0 ? width : 1080);
            params.putInt("height", height > 0 ? height : 2400);
            params.putDouble("timestamp", (double) timestamp);
            params.putString("fileHash", fileHash);
            params.putString("uri", contentUri.toString());

            return params;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Determines whether a media item is a screenshot across Android OEMs:
     * Google, Samsung, Xiaomi/MIUI, OnePlus, Oppo, Vivo, Realme.
     */
    private boolean isScreenshotPath(String filePath, String fileName, String bucketName, String relativePath) {
        String lowerPath = filePath.toLowerCase(Locale.ROOT);
        String lowerName = (fileName != null) ? fileName.toLowerCase(Locale.ROOT) : "";
        String lowerBucket = (bucketName != null) ? bucketName.toLowerCase(Locale.ROOT) : "";
        String lowerRelPath = (relativePath != null) ? relativePath.toLowerCase(Locale.ROOT) : "";

        // Check bucket display name
        if (lowerBucket.contains("screenshot") || lowerBucket.contains("screen shot") || lowerBucket.contains("screencap")) {
            return true;
        }

        // Check file name prefix or substring
        if (lowerName.contains("screenshot") || lowerName.contains("screen_shot") || lowerName.contains("screencap")) {
            return true;
        }

        // Check path and relative path against known OEM & system directories
        for (String keyword : SCREENSHOT_PATH_KEYWORDS) {
            if (lowerPath.contains(keyword) || lowerRelPath.contains(keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Computes SHA-256 hash using streaming read for fast performance and memory safety.
     * Tries ContentResolver stream first (works across Scoped Storage), falls back to FileInputStream,
     * and finally to composite SHA-256 fallback if file cannot be read directly.
     */
    private String computeSHA256Hash(Uri contentUri, String filePath, long fileSize, long dateAdded) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            InputStream is = null;

            try {
                ContentResolver resolver = reactContext.getContentResolver();
                is = resolver.openInputStream(contentUri);
            } catch (Exception ignored) {
            }

            if (is == null) {
                File file = new File(filePath);
                if (file.exists() && file.canRead()) {
                    is = new FileInputStream(file);
                }
            }

            if (is != null) {
                try {
                    while ((read = is.read(buffer)) > 0) {
                        digest.update(buffer, 0, read);
                    }
                } finally {
                    is.close();
                }

                byte[] hashBytes = digest.digest();
                StringBuilder hex = new StringBuilder();
                for (byte b : hashBytes) {
                    hex.append(String.format("%02x", b));
                }
                return hex.toString();
            }
        } catch (Exception ignored) {
        }

        // Composite hash fallback if raw file cannot be opened
        return computeCompositeSHA256(filePath + "_" + fileSize + "_" + dateAdded);
    }

    private String computeCompositeSHA256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                hexString.append(String.format("%02x", b));
            }
            return hexString.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
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
        // Required for React Native built-in NativeEventEmitter
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for React Native built-in NativeEventEmitter
    }
}
