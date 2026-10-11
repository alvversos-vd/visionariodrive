# Tutorial interativo premium

## Auditoria e integração
- O onboarding de seis telas continua controlado pelo acesso atual. O tutorial será montado apenas dentro do aplicativo principal, depois desse fluxo.
- O assistente de permissões e as telas da Sessão Visionária têm prioridade: o tutorial espera seu fechamento, sem pedir permissões nem abrir operações.
- A navegação continua sendo controlada por Index. Não há biblioteca de tutorial instalada; serão reutilizados os botões, diálogos e recursos de acessibilidade existentes.
- As configurações sincronizadas não possuem preferência de tutorial por usuário. Para evitar mudanças de modelos e sincronização, a preferência ficará no armazenamento local já reservado para engajamento, identificada por usuário. Não acompanha outro aparelho e pode reaparecer após limpar dados locais.

## O que será entregue
- Apresentação discreta no primeiro acesso elegível com o texto solicitado, “Começar tutorial” e “Agora não”.
- Ajuda permanente com CircleHelp no cabeçalho, alvo de toque de 44px e opções “Iniciar tutorial” e “Fechar”.
- Guia com destaque de um elemento real por vez, progresso, Voltar, Próximo, Pular e Concluir; Escape encerra e o foco retorna à ajuda.
- Roteiro: resultados no Início; navegação; área de turno; registro de corridas; Financeiro; Histórico; Metas; conquistas no Perfil. O roteiro separa os destinos combinados para destacar apenas um alvo por vez.
- Sem turno ativo, o registro explica o caminho a partir da área de turno; não simula um botão de registro inexistente. Com turno ativo, destaca o botão real de registro. START recebe orientação manual; PRO não recebe instruções para ativar GPS.
- Navegação por destinos existentes, sem criar dados ou acionar controles operacionais. O guia não apaga um resultado aberto na calculadora e restaura a seção anterior ao sair.

## Detalhes técnicos
- Componente de tutorial separado com estado visual local e alvos explícitos de apresentação; Index fornece navegação e elegibilidade.
- Pequena API exclusiva de preferências visuais, com persistência na camada de repository e estados adiado, em andamento, pulado e concluído por usuário. Não alterar Services/Repositories de domínio, Auth, modelos, EventBus ou CloudSync.
- Observadores de tamanho/montagem e eventos de rolagem reposicionam o destaque; sem polling ou timers recorrentes. Alternativa honesta quando o alvo não existe ou a tela não comporta destaque e dica juntos.
- Diálogo acessível com foco previsível, fundo escurecido ao redor do alvo, áreas seguras e movimento reduzido.

## Riscos e aceite
- Priorizar modais existentes para evitar sobreposição; testar elementos tardios das telas carregadas sob demanda.
- Testar isolamento entre contas, apresentação única, reabertura, adiamento, conclusão, navegação e ausência de ações operacionais.
- Executar testes pertinentes e lint aplicável; conferir compilação automática e fluxo autenticado no navegador em dimensões pequenas e desktop.
- Relatório com arquivos alterados, resultados reais e limites: Android/iOS físicos, PWA instalado e Capacitor não poderão ser certificados no navegador do ambiente.