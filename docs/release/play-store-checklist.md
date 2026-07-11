# Play Store Checklist — Visionário Drive Start v1.0.0

## 1. Build & Assinatura
- [ ] `npm run build && npx cap sync android` na máquina local.
- [ ] Gerar **keystore de release** (`keytool -genkey -v -keystore visionario-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias visionario`). Guardar em local seguro + backup — perder a keystore = perder o app na Play Store.
- [ ] Configurar `signingConfigs.release` em `android/app/build.gradle` (via `~/.gradle/gradle.properties`, nunca commitar).
- [ ] Ativar **Play App Signing** no console (Google guarda a upload key).
- [ ] Build final: `./gradlew bundleRelease` → `app-release.aab`.
- [ ] Testar o AAB em dispositivo real via **Internal Testing** antes de promover.

## 2. Ficha da loja (pt-BR)
- [ ] **Nome curto (30):** `Visionário Drive`
- [ ] **Descrição curta (80):** `Copiloto financeiro do entregador: turno, lucro real, km e custo em tempo real.`
- [ ] **Descrição longa (4.000):** destacar tracking automático de corridas, lucro/km, histórico por turno, funciona offline, sem cadastro em apps de entrega.
- [ ] **Ícone alta-res:** 512×512 PNG (usar `public/icon-512.png` como base).
- [ ] **Feature graphic:** 1024×500 PNG.
- [ ] **Screenshots celular:** mínimo 2, recomendado 4–8 (Dashboard em turno, Histórico, Financeiro, ShiftLiveMap).
- [ ] **Categoria:** Produtividade (secundária: Finanças).
- [ ] **Tags:** entregador, motorista, uber, ifood, delivery, lucro, km.

## 3. Política de Privacidade
- [ ] URL pública obrigatória. Usar `/legal` do domínio publicado (ex.: `https://visionariodrive.lovable.app/legal`) OU hospedar cópia estática.
- [ ] Conteúdo já existe em `src/pages/Legal.tsx` (versionado em `profiles.termos_versao`).

## 4. Data Safety (formulário Play Console)
Declarar coleta:
- [ ] **Localização precisa** — Coletada. Finalidade: **Funcionalidade do app** (tracking do turno). Compartilhada: **Não**. Opcional: **Não** (core). Criptografada em trânsito: **Sim**.
- [ ] **Localização em background** — mesma justificativa; explicar no formulário: *"O motorista inicia um turno e o app precisa registrar km percorridos mesmo com a tela bloqueada."*
- [ ] **Info financeira (ganhos/despesas)** — Coletada. Finalidade: Funcionalidade. Compartilhada: **Não**. Criptografada em trânsito: **Sim**. Usuário pode solicitar exclusão: **Sim** (via Excluir conta).
- [ ] **Email + user ID** — Coletados para autenticação. Não compartilhados.
- [ ] **Sem anúncios, sem tracking de terceiros, sem analytics de identidade.**
- [ ] Marcar **"Dados podem ser deletados pelo usuário"** e apontar para fluxo Perfil → Excluir conta.

## 5. Permissões sensíveis — declarações
- [ ] **Background Location declaration form:** anexar vídeo curto (30–60s) mostrando: motorista inicia turno → sai do app → bloqueia tela → volta e vê km registrados. Sem esse form, a Play Store rejeita.
- [ ] **Foreground Service (LOCATION):** justificar na descrição do form.
- [ ] Confirmar em `AndroidManifest.xml` que só existem permissões justificadas (validado na Sprint 5.4).

## 6. Compliance & Ratings
- [ ] **Content Rating:** responder questionário → esperado **Livre / L**.
- [ ] **Target audience:** 18+.
- [ ] **News app / COVID / Government:** Não.
- [ ] **Financial features:** declarar apenas "cálculo de ganhos pessoais", **não** gerencia dinheiro real nem faz pagamentos.
- [ ] **Ads declaration:** Não contém anúncios.

## 7. Distribuição
- [ ] Países: Brasil (expandir depois).
- [ ] Preço: Grátis.
- [ ] Contém compras no app: **Sim** (plano PRO — quando ativado). Para v1.0.0 Start: **Não**.

## 8. Testes obrigatórios antes do release
- [ ] Fluxo completo em dispositivo Android real (Android 10, 12, 14).
- [ ] Validar background location com tela bloqueada por 20+ minutos.
- [ ] Testar exportação PDF/GPX/KML no dispositivo.
- [ ] Testar exclusão de conta ponta-a-ponta.
- [ ] Testar offline → online sync.

## 9. Publicação
- [ ] Enviar para **Internal Testing** primeiro (até 100 testadores, ativação em minutos).
- [ ] Após validação: **Closed Testing** (opcional) → **Production**.
- [ ] Preencher **Release Notes** em pt-BR.

## 10. Pós-publicação
- [ ] Configurar **Play Console → Deep links / Vitals** para monitorar ANRs e crashes.
- [ ] Preparar Sprint 6 apenas após 7 dias de dados de campo.
