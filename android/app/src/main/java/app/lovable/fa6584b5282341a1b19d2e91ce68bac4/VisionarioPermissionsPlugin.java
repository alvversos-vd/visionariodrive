package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
        name = "VisionarioPermissions",
        permissions = {
                @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications"),
                @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "backgroundLocation")
        }
)
public class VisionarioPermissionsPlugin extends Plugin {
    private boolean hasAndroidPermission(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isLocationEnabled() {
        LocationManager manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return manager.isLocationEnabled();
        return manager.isProviderEnabled(LocationManager.GPS_PROVIDER) || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    private JSObject buildStatus() {
        boolean fine = hasAndroidPermission(Manifest.permission.ACCESS_FINE_LOCATION);
        boolean coarse = hasAndroidPermission(Manifest.permission.ACCESS_COARSE_LOCATION);
        boolean foreground = fine || coarse;
        boolean background = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                ? foreground
                : hasAndroidPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION);
        boolean notificationRequired = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
        boolean notificationGranted = !notificationRequired || hasAndroidPermission(Manifest.permission.POST_NOTIFICATIONS);

        JSObject status = new JSObject();
        status.put("native", true);
        status.put("platform", "android");
        status.put("sdkInt", Build.VERSION.SDK_INT);
        status.put("foregroundLocationGranted", foreground);
        status.put("fineLocationGranted", fine);
        status.put("coarseLocationGranted", coarse);
        status.put("backgroundLocationGranted", background);
        status.put("locationServicesEnabled", isLocationEnabled());
        status.put("notificationPermissionRequired", notificationRequired);
        status.put("notificationPermissionGranted", notificationGranted);
        return status;
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(buildStatus());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PluginMethod
    public void requestBackgroundLocationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasAndroidPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
            call.resolve(buildStatus());
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            call.resolve(buildStatus());
            return;
        }
        requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PermissionCallback
    private void backgroundLocationPermissionCallback(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openLocationPermissionSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("destination", "app-details-permissions");
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            call.reject("Unable to open app permission settings", e);
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("destination", "notification-settings");
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            call.reject("Unable to open notification settings", e);
        }
    }
}