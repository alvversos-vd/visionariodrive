package app.lovable.fa6584b5282341a1b19d2e91ce68bac4;

import android.app.Activity;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import java.util.UUID;

/**
 * QuickRideActivity — Sprint 10.5 (ADR-015).
 *
 * Formulário nativo de registro rápido, aberto DIRETAMENTE pela notificação
 * persistente do turno. Janela em estilo diálogo, sem task própria e fora dos
 * recentes: o motorista continua no Uber/99/iFood/Keeta e nenhuma tela do
 * Visionário Drive é aberta.
 *
 * ADR-015 — fronteira nativa agnóstica de GPS:
 *   - Esta Activity NUNCA consulta localização.
 *   - NUNCA importa gpsService / BackgroundGeolocation / CAPGO.
 *   - NUNCA decide kmOrigin nem captureMode.
 *   - NUNCA persiste nada.
 *
 * Ela apenas COLETA e devolve o contrato oficial (v1):
 *   { value, km, kmSource: "user" | "prefilled", clientRequestId, notes? }
 *
 * O campo KM pode chegar pré-preenchido (futuro PRO) via EXTRA_PREFILL_KM.
 * Se o motorista editar esse valor, `kmSource` volta para "user" e o Service
 * reclassifica o domínio. A tela é a mesma para START e PRO.
 */
public class QuickRideActivity extends Activity {

    /** KM sugerido por quem abriu a tela. Sem semântica de origem aqui. */
    public static final String EXTRA_PREFILL_KM = "extra_prefill_km";

    private EditText valueInput;
    private EditText kmInput;
    private EditText notesInput;

    private boolean kmPrefilled = false;
    private boolean kmEditedByUser = false;
    private boolean submitted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_ride);

        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
                        | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );
        setFinishOnTouchOutside(true);

        valueInput = findViewById(R.id.quick_ride_value);
        kmInput = findViewById(R.id.quick_ride_km);
        notesInput = findViewById(R.id.quick_ride_notes);
        Button save = findViewById(R.id.quick_ride_save);
        Button cancel = findViewById(R.id.quick_ride_cancel);

        String prefill = getIntent() != null ? getIntent().getStringExtra(EXTRA_PREFILL_KM) : null;
        if (prefill != null && !prefill.trim().isEmpty()) {
            kmPrefilled = true;
            kmInput.setText(prefill.trim());
        }

        kmInput.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void afterTextChanged(Editable s) {
                if (kmPrefilled) kmEditedByUser = true;
            }
        });

        valueInput.requestFocus();

        save.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submit(); }
        });
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { finish(); }
        });
    }

    private void submit() {
        if (submitted) return;

        Double value = parseNumber(valueInput.getText().toString());
        Double km = parseNumber(kmInput.getText().toString());

        if (value == null || value <= 0) {
            valueInput.setError("Informe o valor");
            valueInput.requestFocus();
            return;
        }
        if (km == null || km <= 0) {
            kmInput.setError("Informe o KM");
            kmInput.requestFocus();
            return;
        }

        submitted = true;

        String notes = notesInput.getText().toString().trim();
        String kmSource = (kmPrefilled && !kmEditedByUser) ? "prefilled" : "user";
        String clientRequestId = "quickform:" + UUID.randomUUID();

        VisionarioQuickActionsPlugin.dispatchQuickForm(
                getApplicationContext(),
                value,
                km,
                kmSource,
                clientRequestId,
                notes.isEmpty() ? null : notes
        );

        Toast.makeText(getApplicationContext(), "Corrida registrada", Toast.LENGTH_SHORT).show();
        finish();
        overridePendingTransition(0, 0);
    }

    /** Aceita "18,50" e "18.50". Nenhuma regra de negócio — só formato. */
    private Double parseNumber(String raw) {
        if (raw == null) return null;
        String cleaned = raw.trim().replace("R$", "").replace("km", "").replace("Km", "")
                .replace("KM", "").replace(",", ".").trim();
        if (cleaned.isEmpty()) return null;
        try {
            return Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
