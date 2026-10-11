# Correção visual dos veículos

## Arquivos de apresentação
- `src/components/vehicleIcons.tsx`: SVGs locais compatíveis com Lucide para motocicleta e bicicleta elétrica; sem dependências novas.
- `src/components/VehiclesView.tsx`: Moto deixa de usar caminhão; bicicleta elétrica passa a mostrar bicicleta com indicador de energia.
- `src/components/Onboarding.tsx`: mesmos símbolos na seleção inicial.
- `src/components/ShiftHistoryView.tsx`: mesmos símbolos nos filtros de tipo.

Governança atualizada em `AGENTS.md` e `roadmap.md`.

## Escopo preservado
Carro e bicicleta convencional continuam com Lucide. Tamanhos, verde, textos, layout, identificadores, cadastro, seleção, cálculos, persistência, turnos e START/PRO não foram alterados.
Ícones genéricos de corridas, conquistas e títulos não são mapeamentos de tipos de veículo e permanecem intactos; nenhum dispatcher de domínio foi criado.

## Verificação
- Onboarding e histórico de turnos: 6 testes passaram.
- ESLint dos quatro arquivos de apresentação: sem erros.
- Compilação automática: build OK.
- Chromium autenticado: Configurações → Meus veículos → Adicionar veículo; quatro símbolos confirmados, screenshots inspecionadas em 1280px e 360px, sem overflow ou erros de execução. Nenhum veículo foi gravado ou alterado.
- Android/iOS físicos não foram testados.