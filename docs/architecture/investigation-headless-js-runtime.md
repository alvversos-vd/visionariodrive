# Investigação — Runtime JS headless para o Quick Register

**Status:** Investigação (nenhum código implementado)
**Sprint:** 10.6.2 · Gate do Teste 5
**Relaciona-se com:** ADR-004 (camadas), ADR-012 (NotificationActionService), ADR-015 (fronteira nativa agnóstica de GPS)

## 1. Problema

Com a MainActivity destruída, o Quick Form nativo coleta a intenção, o
plugin persiste em `SharedPreferences` (fila durável) e o registro só
vira corrida quando o Bridge JS volta a existir. Não há perda de dado,
mas há **perda de experiência**: o motorista tocou em "Registrar
corrida" para registrar *agora*.

O que precisa rodar é o pipeline oficial, inteiro, sem duplicação:

```text
QuickRideActivity → plugin → notificationActionService
→ rideService.registerShiftRide() → rideRepository → outbox
→ CloudSync → EventBus
```

## 2. Fatos verificados no projeto (não suposições)

| Verificação | Resultado |
| --- | --- |
| `@capacitor/core` instalado | **8.3.4** |
| `@capacitor/android` instalado | **8.3.4** |
| Construtor do `Bridge` (Bridge.java:180-196) | exige `AppCompatActivity` + `WebView` |
| `Bridge.Builder` (Bridge.java:1497-1592) | só aceita `AppCompatActivity` ou `Fragment` ligado a uma Activity |
| `MainActivity` | `extends BridgeActivity` (nada custom) |
| API de background/headless JS no core instalado | **não existe** |
| Plugins instalados | app, filesystem, geolocation, haptics, share, capgo/background-geolocation |

Conclusão factual: **no Capacitor 8 o runtime JS é inseparável de um
WebView, e o WebView do Bridge é inseparável de uma Activity.**
Não há API oficial de "headless bridge".

## 3. Opção A — mecanismo oficial do Capacitor 8

Não existe no stack instalado. O único produto oficial adjacente é o
`@capacitor/background-runner`: ele **não** usa o WebView nem o bundle
do app. Roda um arquivo `runner.js` isolado em uma engine própria
(QuickJS/JavaScriptCore), **sem DOM, sem `localStorage`, sem
IndexedDB, sem os módulos do app**.

Consequência direta: para registrar uma corrida ali seria necessário
reescrever `rideService`, `rideRepository`, outbox, tombstones,
dedupe e CloudSync dentro do runner → **segundo pipeline, segunda
fonte de verdade**. Isso é exatamente o que o SSOT proíbe. Opção A é
descartada não por dificuldade, mas por violação arquitetural.

## 4. Opção B — runtime JS headless próprio (Service + engine JS)

Arquitetura hipotética: Foreground Service instancia uma engine JS
(WebView headless via `new WebView(context)` sem Activity, ou
QuickJS/Hermes embarcado) e executa o bundle.

Avaliação ponto a ponto:

| Dimensão | Veredito |
| --- | --- |
| Engine JS | WebView sem Activity funciona tecnicamente (`WebView(Context)`), mas **não é um Bridge Capacitor**: `Bridge` exige `AppCompatActivity`; seria um fork do Bridge mantido por nós |
| Ciclo de vida | Service pode morrer no meio de uma escrita; precisaria de reentrância própria |
| Inicialização / cold start | carregar o bundle React inteiro para gravar uma corrida: ~1–3 s e dezenas de MB |
| `localStorage` | **risco crítico**: duas instâncias de WebView na mesma origem mantêm caches independentes de `localStorage`; escrita concorrente com a MainActivity viva = perda silenciosa de dados |
| Código TS compilado | mesmo bundle só se importarmos o app inteiro (React, rotas, contexts) — arrastando UI para dentro de um Service |
| Supabase / Outbox | funcionariam, mas herdam o problema de concorrência acima |
| EventBus | instância separada: a UI viva **não** receberia os eventos → estado divergente |
| Concorrência | dois runtimes, mesmo storage: nenhuma garantia de ordem |
| Idempotência | `clientRequestId` protege duplicata, **não** protege escrita perdida por cache de `localStorage` |
| Bateria / performance | pior caso do sistema: engine JS completa por toque de botão |
| Recuperação após crash | exigiria a mesma fila durável que já temos (não elimina o fallback) |
| Android 13/14/15 | FGS `specialUse` já é justificativa frágil; adicionar WebView headless aumenta o risco de política na Play Store |
| Capacitor 8 | exige fork do `Bridge` → quebra em cada upgrade |

Veredito: **tecnicamente possível, arquiteturalmente insustentável.**
Não elimina a fila durável e introduz o pior risco possível para o
produto — perda silenciosa de corrida por concorrência de storage.

## 5. Opção C — híbrida mínima (nativo transporta, runtime oficial executa)

Manter exatamente **um** runtime, **um** pipeline, **um** storage, e
tornar o runtime oficial disponível em milissegundos sem trazer a
interface principal para a frente do motorista.

O mecanismo é o Bridge que já temos, hospedado por uma Activity
**invisível** (transparente, sem animação, `excludeFromRecents`,
`taskAffinity` próprio), acionada pela mesma intenção do Quick Form:

```text
QuickRideActivity (UI nativa, agnóstica de GPS)
   → plugin (transporte + fila durável já existente)
   → Bridge vivo?  sim → entrega direta (comportamento atual)
                   não → sobe host invisível do Bridge (mesmo bundle)
   → notificationActionService → rideService → rideRepository
   → outbox → CloudSync → EventBus
   → ackQuickForm → host invisível se encerra
```

Propriedades:

- **Zero duplicação**: nenhum código de domínio novo, nem em Java nem em JS.
- **SSOT intacto**: mesmo `localStorage`, mesma instância de WebView por vez.
- **ADR-015 intacto**: a fronteira nativa continua transportando
  `{ value, km, kmSource, clientRequestId }` e nada mais.
- **Fila durável continua existindo**, mas volta ao papel correto:
  recovery, não caminho normal.
- **Concorrência resolvida por construção**: se a MainActivity está
  viva, ela é usada; o host invisível só existe quando não há Bridge.
- Legalidade Android: o start é originado de uma Activity em primeiro
  plano (o próprio Quick Form) e/ou de um FGS ativo — dentro das
  exceções de background activity start do Android 10+.

Custos honestos:

- Cold start do bundle no primeiro registro após o app ser morto
  (~1–2 s de espera dentro do Quick Form, com estado de progresso).
- Uma Activity invisível é, formalmente, uma Activity — o requisito
  "sem abrir a MainActivity" é atendido no sentido de experiência
  (o motorista permanece no Uber/99/iFood), não no sentido literal
  de "sem Activity nenhuma".

## 6. Matriz de decisão

| Opção | Funciona sem MainActivity | Mantém SSOT | Complexidade | Risco | Recomendação |
| --- | --- | --- | --- | --- | --- |
| A — mecanismo oficial Capacitor 8 | Não (não existe); background-runner sim, mas isolado | **Não** (exige 2º pipeline) | Média | Alto | Rejeitada |
| B — runtime JS headless próprio | Sim | **Não** (2 runtimes, `localStorage` concorrente) | Muito alta | Muito alto (perda silenciosa de corrida) | Rejeitada |
| C — híbrida mínima (host invisível do Bridge) | Sim, sem trazer a UI ao motorista | **Sim** | Baixa/Média | Baixo | **Recomendada** |

## 7. Recomendação

**Opção C.** É a única que entrega registro imediato preservando
SSOT, ADR-015, idempotência, outbox e EventBus, sem fork do Capacitor
e sem regra de negócio no nativo. Também é a mais simples das três —
reaproveita o Bridge existente em vez de criar runtime novo.

## 8. Limitação arquitetural registrada

Enquanto a Opção C não for aprovada e implementada, fica registrado:

> **LIMITAÇÃO — LIM-001.** Com a MainActivity destruída, o Quick
> Register não conclui a persistência oficial no momento do toque. A
> intenção é persistida de forma durável e idempotente no nativo e
> processada quando o Bridge JS voltar. O estado `queued` ("Registro
> salvo — sincronizando") é **fallback de segurança**, não o
> comportamento pretendido.

Mesmo com a Opção C implementada, `queued` permanece como rede de
segurança para cold start interrompido, sem crash e sem perda.

## 9. START × PRO

Nada nesta investigação altera a separação: a fronteira nativa
continua sem qualquer conhecimento de GPS. O host invisível do Bridge
transporta o mesmo contrato para START e PRO; a interpretação de
`kmSource` permanece exclusivamente no Service. START segue 100%
manual, sem `gpsService`, sem `@capgo/background-geolocation`.
