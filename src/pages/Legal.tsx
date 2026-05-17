import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, MapPin, UserMinus } from 'lucide-react';

type Tab = 'termos' | 'privacidade' | 'localizacao' | 'exclusao';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'termos', label: 'Termos de Uso', icon: <FileText size={14} /> },
  { id: 'privacidade', label: 'Privacidade', icon: <Shield size={14} /> },
  { id: 'localizacao', label: 'Localização', icon: <MapPin size={14} /> },
  { id: 'exclusao', label: 'Excluir conta', icon: <UserMinus size={14} /> },
];

export default function Legal() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const active = (params.get('tab') as Tab) || 'termos';

  useEffect(() => {
    const titles: Record<Tab, string> = {
      termos: 'Termos de Uso · Visionario Drive',
      privacidade: 'Política de Privacidade · Visionario Drive',
      localizacao: 'Política de Localização · Visionario Drive',
      exclusao: 'Exclusão de Conta · Visionario Drive',
    };
    document.title = titles[active];
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [active]);

  const setTab = (t: Tab) => navigate(`/legal?tab=${t}`, { replace: false });

  const content = useMemo(() => {
    switch (active) {
      case 'termos': return <Termos />;
      case 'privacidade': return <Privacidade />;
      case 'localizacao': return <Localizacao />;
      case 'exclusao': return <Exclusao />;
    }
  }, [active]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="p-2 rounded-lg hover:bg-secondary"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="font-display font-bold leading-tight">Visionario Drive</p>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Documentos legais</p>
          </div>
        </div>
        <nav className="max-w-3xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                active === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 prose prose-sm dark:prose-invert max-w-none">
        {content}
        <footer className="mt-10 pt-6 border-t text-[11px] text-muted-foreground space-y-1">
          <p>Versão 1.0 · vigente desde 17/05/2026</p>
          <p>
            <Link to="/" className="underline">Voltar ao app</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-2xl font-bold mb-2">{children}</h1>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-bold mt-6 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-foreground/90 mb-3">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm leading-relaxed text-foreground/90 list-disc pl-5 space-y-1 mb-3">{children}</ul>;
}

function Termos() {
  return (
    <>
      <H1>Termos de Uso</H1>
      <P>
        Bem-vindo ao Visionario Drive. Estes Termos regulam o uso do aplicativo. Ao criar uma conta ou utilizar o app,
        você declara que leu, entendeu e concorda com estes Termos.
      </P>

      <H2>1. Natureza do serviço</H2>
      <P>
        O Visionario Drive é uma <strong>ferramenta auxiliar</strong> de organização e análise financeira voltada a
        entregadores e motoristas de aplicativo. O app <strong>não</strong>:
      </P>
      <UL>
        <li>presta serviços de entrega ou transporte;</li>
        <li>intermedia corridas, pedidos ou contratos;</li>
        <li>realiza pagamentos, repasses ou cobranças;</li>
        <li>substitui consultoria contábil, financeira, tributária ou jurídica;</li>
        <li>garante lucro, ganhos ou redução de custos.</li>
      </UL>

      <H2>2. Cálculos estimativos</H2>
      <P>
        Todos os cálculos exibidos (lucro, custo por km, R$/km, metas, projeções) são <strong>estimativas</strong>{' '}
        baseadas nas informações fornecidas pelo próprio usuário e em referências do veículo cadastrado. Os valores
        podem variar conforme combustível, trânsito, clima, manutenção, desgaste e outros fatores externos. Os números
        servem apenas como apoio de análise pessoal.
      </P>

      <H2>3. Responsabilidade do usuário</H2>
      <P>O usuário é integralmente responsável por:</P>
      <UL>
        <li>veracidade dos dados cadastrados (veículo, custos, corridas, despesas);</li>
        <li>decisões financeiras e operacionais tomadas a partir das informações exibidas;</li>
        <li>decisões de aceitar, recusar ou cancelar corridas;</li>
        <li>guarda das credenciais de acesso da própria conta.</li>
      </UL>

      <H2>4. Limitação de responsabilidade</H2>
      <P>
        Na máxima extensão permitida pela lei aplicável, a plataforma <strong>não se responsabiliza</strong> por:
      </P>
      <UL>
        <li>prejuízos financeiros, perda de ganhos ou lucros cessantes;</li>
        <li>decisões tomadas com base em cálculos ou indicadores do app;</li>
        <li>indisponibilidade temporária do serviço, manutenção ou interrupções;</li>
        <li>falhas externas de GPS, internet, sistema operacional ou hardware do dispositivo;</li>
        <li>informações incorretas ou incompletas inseridas pelo próprio usuário.</li>
      </UL>

      <H2>5. Alterações de funcionalidades e planos</H2>
      <P>
        Funcionalidades, recursos, limites e planos podem ser adicionados, alterados, suspensos ou removidos a qualquer
        momento, com o objetivo de evoluir, corrigir falhas ou ajustar a sustentabilidade do serviço. Sempre que
        possível, comunicaremos mudanças relevantes com antecedência razoável.
      </P>

      <H2>6. Uso adequado</H2>
      <P>É vedado ao usuário:</P>
      <UL>
        <li>utilizar o app para fraudes, simulação de dados ou indução a erro de terceiros;</li>
        <li>realizar engenharia reversa, descompilação ou tentativas de violar a segurança;</li>
        <li>explorar falhas, automatizar acessos indevidos ou sobrecarregar a plataforma;</li>
        <li>utilizar a conta de outra pessoa sem autorização.</li>
      </UL>
      <P>O descumprimento pode resultar em suspensão ou encerramento da conta, sem prejuízo de demais medidas legais.</P>

      <H2>7. Propriedade intelectual</H2>
      <P>
        A marca, o nome, a identidade visual, o código-fonte e os textos do Visionario Drive são protegidos por lei. O
        uso do app não transfere qualquer direito de propriedade intelectual ao usuário.
      </P>

      <H2>8. Encerramento</H2>
      <P>
        O usuário pode encerrar a conta a qualquer momento pela opção <em>Excluir minha conta</em> dentro do perfil. A
        exclusão remove dados pessoais, histórico e sessões ativas, conforme descrito na Política de Privacidade.
      </P>

      <H2>9. Foro e legislação</H2>
      <P>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais controvérsias serão resolvidas
        no foro do domicílio do usuário, quando aplicável a legislação consumerista.
      </P>

      <H2>10. Contato</H2>
      <P>Dúvidas sobre estes Termos podem ser enviadas por meio dos canais oficiais divulgados no site do app.</P>
    </>
  );
}

function Privacidade() {
  return (
    <>
      <H1>Política de Privacidade</H1>
      <P>
        Esta Política descreve como o Visionario Drive trata os dados pessoais dos seus usuários, em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </P>

      <H2>1. Dados que coletamos</H2>
      <P>Coletamos apenas o estritamente necessário para o funcionamento do app:</P>
      <UL>
        <li>nome ou apelido informado pelo usuário (opcional);</li>
        <li>endereço de e-mail (utilizado como identificador de login);</li>
        <li>veículos cadastrados (modelo, consumo, custo fixo) — informados pelo usuário;</li>
        <li>dados financeiros inseridos manualmente (corridas, despesas, metas);</li>
        <li>localização aproximada <strong>apenas durante turnos ativos</strong>, para cálculo de distância;</li>
        <li>histórico de turnos, corridas e configurações do app.</li>
      </UL>
      <P>
        <strong>Não coletamos</strong> CPF, RG, documentos pessoais, endereço residencial, dados bancários, conteúdo de
        agenda, contatos ou arquivos do dispositivo.
      </P>

      <H2>2. Finalidades</H2>
      <UL>
        <li>permitir a autenticação e o acesso à sua conta;</li>
        <li>calcular indicadores de desempenho (lucro, R$/km, metas);</li>
        <li>manter o histórico financeiro e operacional do usuário;</li>
        <li>personalizar a experiência (ex.: objetivo principal, veículo padrão);</li>
        <li>garantir segurança, prevenção a fraude e estabilidade do serviço.</li>
      </UL>

      <H2>3. Base legal</H2>
      <P>
        O tratamento ocorre com base na execução de contrato e no legítimo interesse do controlador, bem como no
        consentimento expresso (ex.: uso de localização) quando aplicável.
      </P>

      <H2>4. Compartilhamento</H2>
      <P>
        <strong>Não vendemos</strong> seus dados. <strong>Não compartilhamos</strong> sua localização com terceiros.
        Suas informações financeiras não são comercializadas. Utilizamos provedores de infraestrutura (hospedagem,
        autenticação e banco de dados) que processam dados estritamente em nosso nome, com obrigações de sigilo e
        segurança.
      </P>

      <H2>5. Armazenamento e segurança</H2>
      <UL>
        <li>autenticação por e-mail e senha, com hash seguro no servidor;</li>
        <li>transporte de dados criptografado (HTTPS/TLS);</li>
        <li>regras de acesso por linha (Row Level Security) — você só acessa seus próprios dados;</li>
        <li>sessão local protegida pelo provedor de autenticação no seu dispositivo.</li>
      </UL>

      <H2>6. Retenção</H2>
      <P>
        Os dados são mantidos enquanto a conta estiver ativa. Após a exclusão da conta, removemos dados pessoais e
        histórico, ressalvadas hipóteses legais de guarda.
      </P>

      <H2>7. Direitos do titular (LGPD)</H2>
      <P>Você pode, a qualquer momento:</P>
      <UL>
        <li>acessar seus dados básicos pelo próprio app;</li>
        <li>corrigir informações cadastrais (nome, veículo, metas etc.);</li>
        <li>solicitar a exclusão da conta e do histórico em <em>Perfil → Excluir minha conta</em>;</li>
        <li>revogar o consentimento de localização nas configurações do sistema operacional.</li>
      </UL>

      <H2>8. Cookies e tecnologias similares</H2>
      <P>
        Utilizamos apenas armazenamento local necessário ao funcionamento (sessão, preferências e cache de dados do
        próprio usuário). Não utilizamos rastreadores publicitários de terceiros.
      </P>

      <H2>9. Crianças e adolescentes</H2>
      <P>
        O serviço é destinado a maiores de 18 anos, condizente com a atividade profissional de entrega/transporte. Não
        coletamos intencionalmente dados de menores.
      </P>

      <H2>10. Alterações desta Política</H2>
      <P>
        Esta Política pode ser atualizada para refletir melhorias, exigências legais ou novas funcionalidades.
        Mudanças relevantes serão comunicadas dentro do app.
      </P>
    </>
  );
}

function Localizacao() {
  return (
    <>
      <H1>Política de Localização</H1>
      <P>
        A localização do dispositivo é utilizada de forma <strong>limitada e contextual</strong> pelo Visionario Drive,
        apenas para apoiar o cálculo de desempenho durante turnos.
      </P>

      <H2>Quando usamos</H2>
      <UL>
        <li>somente durante turnos <strong>ativos</strong> iniciados pelo próprio usuário;</li>
        <li>encerramos o uso assim que o turno é finalizado ou pausado;</li>
        <li>nunca solicitamos a permissão durante o cadastro ou em contextos não relacionados ao turno.</li>
      </UL>

      <H2>Para que serve</H2>
      <UL>
        <li>calcular a distância percorrida durante o turno (km do GPS);</li>
        <li>complementar o cálculo de R$/km, custo de combustível e lucro estimado.</li>
      </UL>

      <H2>O que não fazemos</H2>
      <UL>
        <li>não rastreamos o usuário fora do turno;</li>
        <li>não mantemos rastreamento contínuo em segundo plano sem necessidade;</li>
        <li>não compartilhamos sua localização com terceiros;</li>
        <li>não usamos sua localização para publicidade.</li>
      </UL>

      <H2>Modo manual</H2>
      <P>
        Caso o usuário negue a permissão de GPS, ou o sinal esteja indisponível, o app continua funcionando em{' '}
        <strong>modo manual</strong>: o km de cada corrida é informado diretamente pelo usuário no momento do
        registro, sem prejuízo do histórico.
      </P>

      <H2>Como revogar</H2>
      <P>
        Você pode desativar a permissão de localização a qualquer momento nas configurações do sistema operacional
        (Android ou iOS). Após a revogação, o app passará automaticamente para o modo manual.
      </P>
    </>
  );
}

function Exclusao() {
  return (
    <>
      <H1>Exclusão de Conta</H1>
      <P>
        Você pode excluir sua conta a qualquer momento, de forma simples e definitiva, diretamente pelo aplicativo.
      </P>

      <H2>Como excluir</H2>
      <UL>
        <li>abra o app e acesse <em>Perfil</em>;</li>
        <li>toque em <strong>Excluir minha conta</strong>;</li>
        <li>confirme sua senha;</li>
        <li>confirme a exclusão.</li>
      </UL>

      <H2>O que é removido</H2>
      <UL>
        <li>dados pessoais (nome, e-mail, preferências);</li>
        <li>histórico de turnos, corridas, despesas e metas;</li>
        <li>dados de localização registrados durante turnos;</li>
        <li>veículos cadastrados;</li>
        <li>sessões ativas (logout automático).</li>
      </UL>

      <H2>Importante</H2>
      <P>
        A exclusão é <strong>irreversível</strong>. Após a confirmação, não é possível recuperar dados, histórico ou
        relatórios. Eventuais cópias em backups de segurança serão sobrescritas conforme o ciclo padrão de retenção.
      </P>

      <H2>Suporte</H2>
      <P>
        Caso enfrente qualquer problema durante a exclusão, entre em contato pelos canais oficiais do site do app.
      </P>
    </>
  );
}
