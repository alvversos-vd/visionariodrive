# Gate 5 · Conquistas Premium UX

## Auditoria
- A tela existente é `AchievementsModal`, aberta pelo Perfil Inteligente; o perfil também apresenta até cinco desbloqueadas e seis próximas, com acesso à lista completa.
- O catálogo existente tem 18 conquistas e quatro raridades: Comum, Rara, Épica e Lendária. Não existem Bronze, Prata, Ouro ou Platina; nenhuma categoria foi criada.
- `useAchievements` fornece definição, XP, estado, data e progresso normalizado. Apenas conquistas com função de progresso já existente recebem barra quando bloqueadas. As demais continuam mostrando requisito/descrição, sem percentual inventado.
- Não há bloqueio START/PRO nesse módulo; comportamento e acesso foram preservados.

## Arquivos alterados
- `src/components/gamification/AchievementCard.tsx` (novo): apresentação compartilhada de nome, descrição completa, ícone existente, raridade, recompensa e estado. Formata o progresso do hook como percentual, sem calcular requisitos; a barra usa diretamente a mesma fração.
- `src/components/gamification/AchievementsModal.tsx`: duas colunas quando há espaço e uma no mobile, cabeçalho fixo dentro do diálogo, conteúdo rolável, fechamento com alvo de 44px e área segura inferior.
- `src/components/gamification/ProfileGamificationCard.tsx`: reutiliza os cards e mantém limites, expansão e destinos existentes; controles de conquistas agora têm alvo mínimo de 44px e acesso por teclado.
- `AGENTS.md`, `roadmap.md`: governança e conclusão.

## Integridade
Nenhuma alteração em catálogo, recompensas, engine, hooks públicos, services, repositories, eventos, sincronização, modelos, persistência, autenticação, GPS ou turnos. Nenhuma dependência ou timer adicionado. Superfícies permanecem neutras; cores de raridade existentes aparecem apenas nos ícones e indicadores. Transição de barra em 200ms com reduced-motion.

## Evidências
- Vitest: 21 arquivos, 147 testes passaram, incluindo XP/desbloqueios e merge da gamificação.
- ESLint dos três arquivos de apresentação: sem erros.
- Checklist do design system: todos os checks HARD passaram.
- Compilação automática da aplicação: `build OK` após as alterações. Não foi executado comando manual separado de typecheck/build; validação de compilação provém do ambiente automático.
- Chromium com conta autenticada: Perfil → Ver todas; 18 cards reais, quatro desbloqueados e 14 bloqueados; valores de progresso do hook conferidos nos indicadores. Nenhum dado de conquista foi fabricado ou gravado pelo teste.
- 1280×1800, 360×800, 375×667, 360×420 e 768×900: sem overflow no diálogo, último card alcançável por rolagem, botão fechar com 44×44px; screenshots desktop/mobile inspecionadas.
- Expansão de próximas conquistas, abertura pelo contador, fechamento por Escape e reabertura após recarregar verificados; zero erros de execução.

## Limitações
Não houve validação física no Samsung A07, Android/PWA, Safari/iOS ou Capacitor. A conta real usada tem acesso START; equivalência PRO verificada por ausência de condicionais de plano no módulo, não por troca do plano real. Performance física de aparelho de entrada e comportamento do sistema operacional continuam não verificados.