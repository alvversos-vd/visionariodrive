package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(VisionarioPermissionsPlugin.class);
        registerPlugin(VisionarioQuickActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
