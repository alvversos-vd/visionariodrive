# Correção cirúrgica do loop de permissões

## Diagnóstico confirmado

O ciclo não nasce no card nem no plugin Android. Ele ocorre integralmente no JavaScript:

```text
refreshPermissionDiagnostic()
→ getBackgroundPermissionStatus()
→ checkStatus()
→ foregroundLocationGranted=false
→ clearBgAlwaysVerified()
→ evento vd-bg-verified-changed
→ listener onResume()
→ refreshPermissionDiagnostic()
→ repete
```

A origem exata é `clearBgAlwaysVerified()` emitir `vd-bg-verified-changed` em toda chamada, mesmo quando a chave já estava ausente. No START, sem localização por definição, cada leitura nativa entra nesse ramo. O próprio `permissionDiagnostic` escuta esse evento, fechando o ciclo. Quando `ShiftMode` está montado, seu segundo listener amplifica o mesmo evento.

Há também chamadas iniciais duplicadas, mas finitas:
- `subscribePermissionDiagnostic()` já inicia uma leitura quando não existe cache.
- `NotificationActivationCard`, `OperationalStatusBadge` e `ShiftMode` chamam `refreshPermissionDiagnostic()` novamente logo após assinar.
- O card ainda chama outra leitura no efeito de `user.id` durante a montagem.

Essas duplicações aumentam a carga, mas não são a causa da repetição infinita.

## Implementação mínima

1. Tornar `clearBgAlwaysVerified()` idempotente: emitir o evento somente se a chave realmente existia e foi removida, simétrico a `markBgAlwaysVerified()`.
2. Fazer o `NotificationActivationCard` apenas assinar o SSOT no efeito de montagem; a assinatura continua responsável pela leitura inicial.
3. Manter uma única leitura explícita na mudança real de usuário, sem depender do resultado do diagnóstico.
4. Remover as leituras explícitas redundantes imediatamente após assinatura nos demais consumidores, preservando seus eventos legítimos de lifecycle.
5. Não alterar plugin Android, GPS, Shift, Quick Form, Ride, Services de domínio ou persistência.

## Testes e aceite

- Evento de limpeza só é emitido numa transição real de `verificado` para `não verificado`.
- Leituras repetidas com estado já limpo não geram evento nem recursão.
- Montagem do card inicia uma leitura; rerenders e atualização do diagnóstico não iniciam outra.
- Mudança real de usuário inicia nova leitura.
- Retorno do Android continua iniciando nova leitura pelos listeners existentes.
- Executar testes focados, suíte Vitest, lint e validação TypeScript; confirmar o build automático sem erros.
