import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bell,
  Building2,
  Cable,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  Headphones,
  HelpCircle,
  Home,
  Info,
  Leaf,
  ListFilter,
  MapPin,
  Menu,
  MonitorSmartphone,
  MoreHorizontal,
  Nfc,
  PanelLeftClose,
  PlugZap,
  Radio,
  ReceiptText,
  RefreshCw,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TerminalSquare,
  Timer,
  UserRound,
  WalletCards,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { ChargeGridCore, USER_DISCOUNT, USER_PRIORITY } from "./core/chargeGridCore";

const STORAGE_KEY = "chargegrid-intelligence-state-v3";

const stationCatalog = [
  {
    id: "CG-1024",
    name: "ChargeGrid Paulista",
    address: "Av. Paulista, 1.578 · Bela Vista",
    distance: "0,8 km",
    available: 4,
    total: 6,
    power: "150 kW",
    price: 1.79,
    tags: ["CCS2", "24 horas"],
  },
  {
    id: "CG-0841",
    name: "Shopping Eldorado",
    address: "Av. Rebouças, 3.970 · Pinheiros",
    distance: "2,4 km",
    available: 2,
    total: 4,
    power: "60 kW",
    price: 1.62,
    tags: ["CCS2", "Estacionamento"],
  },
  {
    id: "CG-0732",
    name: "ChargeGrid Moema",
    address: "Al. dos Maracatins, 780 · Moema",
    distance: "3,1 km",
    available: 5,
    total: 6,
    power: "120 kW",
    price: 1.74,
    tags: ["CCS2", "Tipo 2"],
  },
];

const connectorCatalog = [
  { id: 1, type: "CCS2", hardwarePower: 150, requestPower: 50 },
  { id: 2, type: "CCS2", hardwarePower: 150, requestPower: 50 },
  { id: 3, type: "Tipo 2", hardwarePower: 22, requestPower: 22 },
  { id: 4, type: "Tipo 2", hardwarePower: 22, requestPower: 22 },
  { id: 5, type: "CCS2", hardwarePower: 60, requestPower: 30 },
  { id: 6, type: "Tipo 2", hardwarePower: 11, requestPower: 11 },
];

const DEMO_VEHICLE = Object.freeze({
  model: "BYD Dolphin",
  batteryCapacityKwh: 44.9,
  initialSoc: 38,
  maxAcKw: 7,
  maxDcKw: 60,
  simulated: true,
});

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const number = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return currency.format(Number(value) || 0);
}

function formatNumber(value, suffix = "") {
  return `${number.format(Number(value) || 0)}${suffix}`;
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function formatDuration(value) {
  const totalMinutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function readStoredCore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new ChargeGridCore(JSON.parse(raw)) : new ChargeGridCore();
  } catch {
    return new ChargeGridCore();
  }
}

function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function Brand({ inverse = false, compact = false }) {
  return (
    <div className={`brand ${inverse ? "brand--inverse" : ""} ${compact ? "brand--compact" : ""}`}>
      <span className="brand__mark" aria-hidden="true">
        <Zap size={compact ? 21 : 25} strokeWidth={2.4} />
      </span>
      <span className="brand__copy">
        <strong>ChargeGrid</strong>
        {!compact && <small>Intelligence</small>}
      </span>
    </div>
  );
}

function StatusPill({ tone = "success", children, icon: Icon }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon = BatteryCharging, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function ModeSelector({ onSelect }) {
  return (
    <main className="mode-gateway">
      <div className="gateway-orb gateway-orb--one" />
      <div className="gateway-orb gateway-orb--two" />
      <header className="gateway-header">
        <Brand inverse />
        <div className="gateway-status">
          <span className="live-dot" />
          Plataforma operacional
        </div>
      </header>

      <section className="gateway-content">
        <div className="gateway-eyebrow">
          <Sparkles size={15} />
          Uma plataforma, duas experiências
        </div>
        <h1>Como você deseja acessar?</h1>
        <p className="gateway-lead">
          Escolha o ambiente para continuar. Os dados de recarga são compartilhados em tempo real entre os dois modos.
        </p>

        <div className="mode-cards">
          <button className="mode-card mode-card--app" onClick={() => onSelect("app")}>
            <span className="mode-card__topline">
              <span className="mode-card__icon">
                <MonitorSmartphone size={25} />
              </span>
              <StatusPill tone="info">Painel web</StatusPill>
            </span>
            <span className="mode-card__body">
              <small>Gestão inteligente</small>
              <strong>Aplicativo ChargeGrid</strong>
              <span>Monitore sessões, demanda, conectores, protocolos e resultados da operação.</span>
            </span>
            <span className="mini-dashboard" aria-hidden="true">
              <span className="mini-dashboard__rail" />
              <span className="mini-dashboard__canvas">
                <i />
                <i />
                <i />
                <b />
              </span>
            </span>
            <span className="mode-card__action">
              Entrar no aplicativo <ArrowRight size={18} />
            </span>
          </button>

          <button className="mode-card mode-card--station" onClick={() => onSelect("station")}>
            <span className="mode-card__topline">
              <span className="mode-card__icon">
                <TerminalSquare size={25} />
              </span>
              <StatusPill tone="success" icon={Wifi}>
                CG-1024 online
              </StatusPill>
            </span>
            <span className="mode-card__body">
              <small>Experiência touch</small>
              <strong>Estação de recarga</strong>
              <span>Simule pagamento, conexão do veículo, carregamento e emissão do recibo.</span>
            </span>
            <span className="mini-terminal" aria-hidden="true">
              <span className="mini-terminal__steps"><i /><i /><i /><i /></span>
              <span className="mini-terminal__screen">
                <b><Nfc size={25} /></b>
                <i />
                <i />
              </span>
            </span>
            <span className="mode-card__action">
              Acessar estação <ArrowRight size={18} />
            </span>
          </button>
        </div>

        <div className="gateway-note">
          <ShieldCheck size={17} />
          <span>
            <strong>Ambiente de demonstração.</strong> OCPP e MODBUS são simulados; nenhum pagamento real é processado.
          </span>
        </div>
      </section>

      <footer className="gateway-footer">
        <span>ChargeGrid Intelligence · Sprint 2</span>
        <span>Energia conectada. Operação inteligente.</span>
      </footer>
    </main>
  );
}

const navItems = [
  { id: "overview", label: "Visão geral", icon: Home },
  { id: "sessions", label: "Sessões", icon: BatteryCharging },
  { id: "protocols", label: "Protocolos", icon: Radio },
  { id: "reports", label: "Relatórios", icon: FileText },
];

const pageCopy = {
  overview: ["Visão geral", "Acompanhe os principais indicadores da operação."],
  sessions: ["Sessões de recarga", "Gerencie veículos conectados e o histórico recente."],
  site: ["Eletroposto", "Configure capacidade, tarifa e conectores."],
  protocols: ["Central de protocolos", "Inspecione eventos OCPP e MODBUS simulados."],
  reports: ["Relatórios", "Consolide os resultados técnicos da simulação."],
  help: ["Ajuda e demonstração", "Um roteiro rápido para apresentar a solução."],
};

function DashboardApp({ core, mutate, onExit }) {
  const [page, setPage] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("page");
    return [...navItems.map((item) => item.id), "site", "help"].includes(requested) ? requested : "overview";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [search, setSearch] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const selectedSession = selectedSessionId ? core.getSession(selectedSessionId) : null;
  const [title, description] = pageCopy[page];

  const navigate = (target) => {
    setPage(target);
    setSidebarOpen(false);
  };

  const openNewSession = () => {
    setNewSessionOpen(true);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />}
      <aside className={`app-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Brand />
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            <PanelLeftClose size={20} />
          </button>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">
          <span className="nav-label">Operação</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? "is-active" : ""} onClick={() => navigate(id)}>
              <Icon size={19} />
              <span>{label}</span>
              {id === "sessions" && core.activeSessions().length > 0 && (
                <em>{core.activeSessions().length}</em>
              )}
            </button>
          ))}
          <span className="nav-label nav-label--second">Suporte</span>
          <button className={page === "help" ? "is-active" : ""} onClick={() => navigate("help")}>
            <HelpCircle size={19} />
            <span>Ajuda</span>
          </button>
        </nav>

        <button className={`sidebar-site-shortcut ${page === "site" ? "is-active" : ""}`} onClick={() => navigate("site")}>
          <span><Building2 size={18} /></span>
          <p><strong>Eletroposto</strong><small>Capacidade, tarifa e conectores</small></p>
          <ChevronRight size={17} />
        </button>

        <div className="sidebar-health">
          <div className="sidebar-health__head">
            <span><Activity size={17} /> Saúde do sistema</span>
            <strong>100%</strong>
          </div>
          <div className="sidebar-health__bar"><span /></div>
          <small>Estação e protocolos operando normalmente.</small>
        </div>

        <button className="sidebar-switch" onClick={onExit}>
          <RefreshCw size={17} />
          Trocar ambiente
        </button>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={21} />
          </button>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              if (search.trim()) navigate("sessions");
            }}
          >
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar sessão, veículo ou conector..."
              aria-label="Buscar"
            />
            <kbd>⌘ K</kbd>
          </form>
          <div className="topbar-actions">
            <StatusPill tone="success" icon={Wifi}>Simulação ativa</StatusPill>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                onClick={() => setNotificationOpen((current) => !current)}
                aria-label="Notificações"
              >
                <Bell size={19} />
                {core.logs.length > 1 && <i />}
              </button>
              {notificationOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <strong>Atualizações recentes</strong>
                    <button onClick={() => setNotificationOpen(false)} aria-label="Fechar"><X size={16} /></button>
                  </div>
                  {core.logs.slice(-3).reverse().map((log) => (
                    <div className="notification-item" key={log.id}>
                      <span className="event-dot" />
                      <p>{log.message}<small>{log.time}</small></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="profile-button">
              <span>CG</span>
              <div><strong>Equipe 3</strong><small>Operador</small></div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <main className="app-main">
          <div className="page-heading">
            <div>
              <p className="page-kicker"><span className="live-dot" /> Centro operacional · CG São Paulo</p>
              <h1>{title}</h1>
              <span>{description}</span>
            </div>
            <div className="page-heading__actions">
              <button className="button button--secondary" onClick={() => navigate("reports")}>
                <Download size={17} /> Relatório
              </button>
              <button className="button button--primary" onClick={openNewSession}>
                <Zap size={17} /> Nova sessão
              </button>
            </div>
          </div>

          {page === "overview" && (
            <OverviewPage
              core={core}
              mutate={mutate}
              onNavigate={navigate}
              onNewSession={openNewSession}
              onInspect={setSelectedSessionId}
            />
          )}
          {page === "sessions" && (
            <SessionsPage
              core={core}
              search={search}
              setSearch={setSearch}
              onNewSession={openNewSession}
              onInspect={setSelectedSessionId}
            />
          )}
          {page === "site" && <SitePage core={core} mutate={mutate} />}
          {page === "protocols" && <ProtocolsPage core={core} mutate={mutate} />}
          {page === "reports" && <ReportsPage core={core} />}
          {page === "help" && <HelpPage core={core} mutate={mutate} onNavigate={navigate} />}
        </main>
      </div>

      {newSessionOpen && (
        <NewSessionModal
          core={core}
          onClose={() => setNewSessionOpen(false)}
          onSubmit={(payload) => {
            const created = mutate((engine) => engine.startSession(payload), "Sessão iniciada com sucesso.");
            if (created) {
              setNewSessionOpen(false);
              setPage("sessions");
            }
          }}
        />
      )}
      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => setSelectedSessionId(null)}
          onFinish={() => {
            const finished = mutate(
              (engine) => engine.finishSession(selectedSession.sessionId),
              `${selectedSession.sessionId} finalizada com sucesso.`,
            );
            if (finished) setSelectedSessionId(null);
          }}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone = "green", trend }) {
  return (
    <article className="kpi-card">
      <span className={`kpi-card__icon kpi-card__icon--${tone}`}><Icon size={20} /></span>
      <div className="kpi-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={trend === "warning" ? "text-warning" : ""}>{detail}</small>
      </div>
    </article>
  );
}

function OverviewPage({ core, mutate, onNavigate, onNewSession, onInspect }) {
  const metrics = core.metrics();
  const active = core.activeSessions();
  const recentLogs = core.logs.slice(-4).reverse();
  const allocationPercent = core.siteLimitKw > 0 ? Math.min(100, (metrics.allocatedKw / core.siteLimitKw) * 100) : 0;
  const requestedPercent = core.siteLimitKw > 0 ? Math.min(120, (metrics.requestedKw / core.siteLimitKw) * 100) : 0;
  const demandTone = metrics.demandRatio >= 1 ? "danger" : metrics.demandRatio >= 0.8 ? "warning" : "success";

  return (
    <div className="dashboard-stack">
      <section className="overview-banner">
        <div className="overview-banner__content">
          <StatusPill tone="success" icon={Sparkles}>Smart charging habilitado</StatusPill>
          <h2>Operação sob controle.</h2>
          <p>
            A ChargeGrid distribui energia automaticamente entre os conectores e protege o limite do eletroposto.
          </p>
          <div className="overview-banner__actions">
            <button className="button button--light" onClick={onNewSession}>Iniciar recarga <ArrowRight size={17} /></button>
            <button className="text-button text-button--light" onClick={() => onNavigate("protocols")}>Ver protocolos</button>
          </div>
        </div>
        <div className="energy-visual" aria-hidden="true">
          <div className="energy-visual__grid" />
          <div className="energy-visual__station"><Zap size={29} fill="currentColor" /></div>
          <div className="energy-visual__car"><Car size={62} strokeWidth={1.35} /></div>
          <svg viewBox="0 0 250 100" preserveAspectRatio="none">
            <path d="M0 78 C45 78 46 30 90 43 S148 87 185 45 S222 20 250 30" />
          </svg>
        </div>
      </section>

      <section className="kpi-grid" aria-label="Indicadores principais">
        <KpiCard
          label="Sessões ativas"
          value={metrics.activeCount}
          detail={`${metrics.finishedCount} finalizada${metrics.finishedCount === 1 ? "" : "s"}`}
          icon={BatteryCharging}
          tone="green"
        />
        <KpiCard
          label="Potência liberada"
          value={`${formatNumber(metrics.allocatedKw)} kW`}
          detail={`de ${formatNumber(core.siteLimitKw)} kW disponíveis`}
          icon={Gauge}
          tone="blue"
          trend={metrics.demandRatio >= 1 ? "warning" : undefined}
        />
        <KpiCard
          label="Energia entregue"
          value={`${formatNumber(metrics.energyKwh)} kWh`}
          detail="acumulado na simulação"
          icon={Zap}
          tone="purple"
        />
        <KpiCard
          label="Receita simulada"
          value={formatCurrency(metrics.revenue)}
          detail="tarifação dinâmica aplicada"
          icon={CircleDollarSign}
          tone="amber"
        />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-primary">
          <article className="panel demand-panel">
            <div className="panel-heading">
              <div><h3>Demanda do eletroposto</h3><p>Potência solicitada versus capacidade disponível</p></div>
              <StatusPill tone={demandTone} icon={Activity}>
                {metrics.demandRatio >= 1 ? "Balanceamento ativo" : "Operação estável"}
              </StatusPill>
            </div>
            <div className="demand-summary">
              <div><strong>{formatNumber(metrics.requestedKw)}</strong><span>kW solicitados</span></div>
              <ArrowRight size={20} />
              <div><strong>{formatNumber(metrics.allocatedKw)}</strong><span>kW liberados</span></div>
              <div className="demand-capacity"><span>Limite atual</span><strong>{formatNumber(core.siteLimitKw)} kW</strong></div>
            </div>
            <div className="demand-track" aria-label={`${requestedPercent.toFixed(0)}% de demanda`}>
              <span className={`demand-track__requested is-${demandTone}`} style={{ width: `${Math.min(100, requestedPercent)}%` }} />
              <span className="demand-track__allocated" style={{ width: `${allocationPercent}%` }} />
            </div>
            <div className="demand-legend">
              <span><i className="legend-requested" /> Solicitado</span>
              <span><i className="legend-allocated" /> Liberado</span>
              <em>{Math.round(metrics.demandRatio * 100)}% do limite</em>
            </div>
          </article>

          <article className="panel sessions-panel">
            <div className="panel-heading">
              <div><h3>Sessões em andamento</h3><p>Distribuição inteligente por conector</p></div>
              <button className="text-button" onClick={() => onNavigate("sessions")}>Ver todas <ArrowRight size={15} /></button>
            </div>
            {active.length ? (
              <div className="session-list">
                {active.slice(0, 4).map((session) => (
                  <button className="session-row" key={session.sessionId} onClick={() => onInspect(session.sessionId)}>
                    <span className="connector-avatar"><PlugZap size={18} /></span>
                    <span className="session-row__identity">
                      <strong>{session.vehicle}</strong>
                      <small>{session.sessionId} · Conector {session.connectorId} · {session.userType}</small>
                    </span>
                    <span className="session-row__power">
                      <strong>{formatNumber(session.allocatedKw)} kW</strong>
                      <small>de {formatNumber(session.requestedKw)} kW</small>
                    </span>
                    <span className="session-row__progress">
                      <i><b style={{ width: `${Math.min(100, (session.elapsedMinutes / session.plannedMinutes) * 100)}%` }} /></i>
                      <small>{session.elapsedMinutes}/{session.plannedMinutes} min</small>
                    </span>
                    <StatusPill tone={session.allocatedKw < session.requestedKw ? "warning" : "success"}>
                      {session.allocatedKw < session.requestedKw ? "Limitada" : "Carregando"}
                    </StatusPill>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma recarga em andamento"
                description="Inicie uma sessão manualmente ou carregue o cenário pronto para demonstração."
                action={<button className="button button--primary button--small" onClick={onNewSession}>Nova sessão</button>}
              />
            )}
          </article>
        </div>

        <aside className="dashboard-rail">
          <article className="panel configuration-card">
            <div className="panel-heading panel-heading--compact">
              <div><h3>Configuração atual</h3><p>CG São Paulo · CG-1024</p></div>
              <button className="icon-button" onClick={() => onNavigate("site")} aria-label="Editar configuração"><Settings2 size={17} /></button>
            </div>
            <dl className="configuration-list">
              <div><dt><Gauge size={17} /> Limite total</dt><dd>{formatNumber(core.siteLimitKw)} kW</dd></div>
              <div><dt><CircleDollarSign size={17} /> Tarifa base</dt><dd>{formatCurrency(core.baseTariff)}/kWh</dd></div>
              <div><dt><Clock3 size={17} /> Horário simulado</dt><dd>{String(core.simulatedHour).padStart(2, "0")}:00</dd></div>
              <div><dt><PlugZap size={17} /> Conectores</dt><dd>{6 - active.length} de 6 livres</dd></div>
            </dl>
          </article>

          <article className="panel quick-actions-card">
            <div className="panel-heading panel-heading--compact"><div><h3>Controles da demo</h3><p>Prepare a apresentação em segundos</p></div></div>
            <button
              className="quick-action"
              onClick={() => mutate((engine) => engine.createAutoScenario(), "Cenário automático preparado.")}
            >
              <span><Sparkles size={18} /></span><div><strong>Cenário automático</strong><small>Adiciona quatro veículos</small></div><ChevronRight size={17} />
            </button>
            <button
              className="quick-action"
              onClick={() => mutate((engine) => engine.advanceTime(15), "Simulação avançada em 15 minutos.")}
            >
              <span><Timer size={18} /></span><div><strong>Avançar 15 minutos</strong><small>Atualiza energia e custos</small></div><ChevronRight size={17} />
            </button>
          </article>

          <article className="panel activity-card">
            <div className="panel-heading panel-heading--compact">
              <div><h3>Atividade recente</h3><p>Eventos do sistema</p></div>
            </div>
            <div className="activity-feed">
              {recentLogs.map((log, index) => (
                <div key={log.id} className="activity-event">
                  <span className={index === 0 ? "is-current" : ""} />
                  <p>{log.message}<small>{log.time}</small></p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

function SessionsPage({ core, search, setSearch, onNewSession, onInspect }) {
  const [status, setStatus] = useState("Todas");
  const [profile, setProfile] = useState("Todos");
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return [...core.sessions]
      .reverse()
      .filter((session) => status === "Todas" || session.status === status)
      .filter((session) => profile === "Todos" || session.userType === profile)
      .filter((session) =>
        !normalized ||
        [session.sessionId, session.vehicle, String(session.connectorId), session.userType]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      );
  }, [core.sessions, profile, search, status]);

  return (
    <section className="panel data-panel">
      <div className="table-toolbar">
        <div className="table-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nas sessões" /></div>
        <div className="table-filters">
          <label><ListFilter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>Todas</option><option>Ativa</option><option>Finalizada</option></select></label>
          <label><UserRound size={16} /><select value={profile} onChange={(e) => setProfile(e.target.value)}><option>Todos</option><option>Comum</option><option>Assinante</option><option>Frota</option><option>Visitante</option></select></label>
        </div>
      </div>
      {filtered.length ? (
        <div className="responsive-table-wrap">
          <table className="sessions-table">
            <thead><tr><th>Sessão / veículo</th><th>Conector</th><th>Perfil</th><th>Status</th><th>Potência</th><th>Energia</th><th>Custo</th><th>Progresso</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {filtered.map((session) => (
                <tr key={session.sessionId} onClick={() => onInspect(session.sessionId)}>
                  <td data-label="Sessão"><span className="table-identity"><i><Car size={17} /></i><span><strong>{session.vehicle}</strong><small>{session.sessionId} · {formatDate(session.startTime, true)}</small></span></span></td>
                  <td data-label="Conector"><strong>#{session.connectorId}</strong></td>
                  <td data-label="Perfil">{session.userType}</td>
                  <td data-label="Status"><StatusPill tone={session.status === "Ativa" ? "success" : "neutral"}>{session.status}</StatusPill></td>
                  <td data-label="Potência"><span className="power-cell"><strong>{formatNumber(session.allocatedKw)} kW</strong><small>sol. {formatNumber(session.requestedKw)} kW</small></span></td>
                  <td data-label="Energia">{formatNumber(session.energyKwh)} kWh</td>
                  <td data-label="Custo">{formatCurrency(session.totalCost)}</td>
                  <td data-label="Progresso"><span className="table-progress"><i><b style={{ width: `${Math.min(100, (session.elapsedMinutes / session.plannedMinutes) * 100)}%` }} /></i><small>{session.elapsedMinutes}/{session.plannedMinutes} min</small></span></td>
                  <td><button className="icon-button" aria-label={`Detalhes da ${session.sessionId}`}><MoreHorizontal size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title={core.sessions.length ? "Nenhum resultado encontrado" : "Sua operação começa aqui"}
          description={core.sessions.length ? "Altere os filtros ou tente outro termo de busca." : "Cadastre a primeira sessão para acompanhar potência, energia e custos."}
          action={!core.sessions.length && <button className="button button--primary button--small" onClick={onNewSession}>Criar primeira sessão</button>}
        />
      )}
      <div className="table-footer"><span>{filtered.length} de {core.sessions.length} sessões</span><span>Atualização local em tempo real</span></div>
    </section>
  );
}

function SitePage({ core, mutate }) {
  const [limit, setLimit] = useState(String(core.siteLimitKw));
  const [tariff, setTariff] = useState(String(core.baseTariff).replace(".", ","));
  const [hour, setHour] = useState(String(core.simulatedHour));
  const activeByConnector = new Map(core.activeSessions().map((session) => [session.connectorId, session]));

  const apply = (event) => {
    event.preventDefault();
    mutate(
      (engine) =>
        engine.updateConfiguration({
          siteLimitKw: Number(limit.replace(",", ".")),
          baseTariff: Number(tariff.replace(",", ".")),
          simulatedHour: Number(hour),
        }),
      "Configuração do eletroposto atualizada.",
    );
  };

  return (
    <div className="site-layout">
      <section className="panel site-config-panel">
        <div className="panel-heading">
          <div><h3>Parâmetros operacionais</h3><p>As alterações recalculam todas as sessões ativas.</p></div>
          <StatusPill tone="info" icon={SlidersHorizontal}>Configuração global</StatusPill>
        </div>
        <form className="config-form" onSubmit={apply}>
          <label><span>Limite total do eletroposto</span><div className="input-with-unit"><input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" /><em>kW</em></div><small>Potência máxima compartilhada pelos conectores.</small></label>
          <label><span>Tarifa base</span><div className="input-with-unit"><em>R$</em><input value={tariff} onChange={(e) => setTariff(e.target.value)} inputMode="decimal" /><em>/ kWh</em></div><small>A tarifa dinâmica aplica ajustes sobre este valor.</small></label>
          <label><span>Horário simulado</span><div className="input-with-unit"><input value={hour} onChange={(e) => setHour(e.target.value)} inputMode="numeric" /><em>:00</em></div><small>Entre 18h e 21h há adicional de horário de pico.</small></label>
          <div className="config-preview">
            <Info size={18} />
            <p><strong>Prévia da configuração</strong><span>{limit || "0"} kW de capacidade · R$ {tariff || "0"}/kWh · {String(hour || "0").padStart(2, "0")}:00</span></p>
          </div>
          <button className="button button--primary" type="submit"><Check size={17} /> Aplicar configuração</button>
        </form>
      </section>

      <section className="panel connectors-panel">
        <div className="panel-heading"><div><h3>Conectores</h3><p>Disponibilidade e potência em tempo real</p></div><StatusPill tone="success">{6 - activeByConnector.size} disponíveis</StatusPill></div>
        <div className="connector-grid">
          {connectorCatalog.map((connector) => {
            const session = activeByConnector.get(connector.id);
            const limited = session && session.allocatedKw < session.requestedKw;
            return (
              <article className={`connector-card ${session ? "is-active" : ""}`} key={connector.id}>
                <div className="connector-card__head"><span><PlugZap size={19} /></span><StatusPill tone={!session ? "success" : limited ? "warning" : "info"}>{!session ? "Livre" : limited ? "Limitada" : "Carregando"}</StatusPill></div>
                <strong>Conector {connector.id}</strong>
                <p>{connector.type} · potência máxima {connector.hardwarePower} kW</p>
                {session ? <div className="connector-card__session"><small>{session.sessionId}</small><b>{formatNumber(session.allocatedKw)} kW</b><span>{session.vehicle}</span></div> : <div className="connector-card__empty"><span>Pronto para uso</span></div>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel rules-panel">
        <div className="panel-heading"><div><h3>Política de distribuição</h3><p>Prioridades e descontos aplicados pelo motor inteligente</p></div></div>
        <div className="rules-table">
          <div className="rules-row rules-row--head"><span>Perfil</span><span>Prioridade</span><span>Ajuste na tarifa</span></div>
          {Object.keys(USER_PRIORITY).map((profile) => (
            <div className="rules-row" key={profile}><strong>{profile}</strong><span>{USER_PRIORITY[profile].toFixed(2).replace(".", ",")}×</span><span className={USER_DISCOUNT[profile] < 0 ? "text-success" : ""}>{USER_DISCOUNT[profile] < 0 ? `${Math.abs(USER_DISCOUNT[profile] * 100)}% de desconto` : "Tarifa padrão"}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProtocolsPage({ core, mutate }) {
  const [protocol, setProtocol] = useState("OCPP");
  const messages = core.protocolMessages.filter((message) => message.protocol === protocol).slice().reverse();
  const [selectedId, setSelectedId] = useState(null);
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];

  return (
    <section className="panel protocol-panel">
      <div className="protocol-toolbar">
        <div className="segmented-control">
          <button className={protocol === "OCPP" ? "is-active" : ""} onClick={() => { setProtocol("OCPP"); setSelectedId(null); }}><Radio size={16} /> OCPP <em>{core.protocolMessages.filter((m) => m.protocol === "OCPP").length}</em></button>
          <button className={protocol === "MODBUS" ? "is-active" : ""} onClick={() => { setProtocol("MODBUS"); setSelectedId(null); }}><ServerCog size={16} /> MODBUS <em>{core.protocolMessages.filter((m) => m.protocol === "MODBUS").length}</em></button>
        </div>
        <div className="protocol-actions">
          <StatusPill tone="warning" icon={Info}>Integração simulada</StatusPill>
          <button className="button button--secondary button--small" onClick={() => mutate((engine) => engine.simulateProtocolExchange(), "Troca de protocolos simulada.")}><RefreshCw size={16} /> Simular troca</button>
        </div>
      </div>
      <div className="protocol-workspace">
        <div className="protocol-list">
          <div className="protocol-list__head"><strong>Eventos</strong><span>{messages.length} mensagens</span></div>
          {messages.length ? messages.map((message) => (
            <button key={message.id} className={selected?.id === message.id ? "is-active" : ""} onClick={() => setSelectedId(message.id)}>
              <span className={`protocol-icon protocol-icon--${protocol.toLowerCase()}`}>{protocol === "OCPP" ? <Radio size={17} /> : <ServerCog size={17} />}</span>
              <p><strong>{message.type}</strong><small>{message.sessionId || "Estação"} · {formatDate(message.timestamp, true)}</small></p>
              <ChevronRight size={16} />
            </button>
          )) : <EmptyState icon={Radio} title={`Nenhum evento ${protocol}`} description="Inicie uma sessão ou simule uma troca para gerar mensagens." />}
        </div>
        <div className="protocol-detail">
          {selected ? (
            <>
              <div className="protocol-detail__head"><div><StatusPill tone={protocol === "OCPP" ? "info" : "success"}>{protocol}</StatusPill><h3>{selected.title}</h3><p>{selected.timestamp}</p></div><button className="button button--ghost button--small" onClick={() => navigator.clipboard?.writeText(JSON.stringify(selected.payload, null, 2))}>Copiar JSON</button></div>
              <pre><code>{JSON.stringify(selected.payload, null, 2)}</code></pre>
            </>
          ) : <EmptyState icon={TerminalSquare} title="Selecione uma mensagem" description="Os dados estruturados aparecerão aqui." />}
        </div>
      </div>
    </section>
  );
}

function ReportsPage({ core }) {
  const metrics = core.metrics();
  const downloadReport = () => downloadFile("relatorio-chargegrid.txt", core.generateReport());
  const downloadJson = () => downloadFile("dados-chargegrid.json", JSON.stringify(core.toJSON(), null, 2), "application/json");
  return (
    <div className="reports-layout">
      <section className="report-hero">
        <div><StatusPill tone="success" icon={BadgeCheck}>Dados consolidados</StatusPill><h2>Relatório operacional</h2><p>Resumo técnico da simulação, pronto para apresentação ou auditoria.</p><div><button className="button button--light" onClick={downloadReport}><Download size={17} /> Baixar .txt</button><button className="text-button text-button--light" onClick={downloadJson}>Exportar JSON</button></div></div>
        <span className="report-hero__icon"><FileText size={55} /></span>
      </section>
      <section className="report-summary-grid">
        <div><span>Sessões</span><strong>{core.sessions.length}</strong><small>{metrics.activeCount} em andamento</small></div>
        <div><span>Demanda</span><strong>{Math.round(metrics.demandRatio * 100)}%</strong><small>{formatNumber(metrics.allocatedKw)} kW liberados</small></div>
        <div><span>Energia</span><strong>{formatNumber(metrics.energyKwh)} kWh</strong><small>total entregue</small></div>
        <div><span>Receita</span><strong>{formatCurrency(metrics.revenue)}</strong><small>valor simulado</small></div>
      </section>
      <section className="panel report-preview">
        <div className="panel-heading"><div><h3>Pré-visualização</h3><p>Conteúdo incluído na exportação em texto</p></div><StatusPill tone="neutral">TXT · UTF-8</StatusPill></div>
        <pre>{core.generateReport()}</pre>
      </section>
    </div>
  );
}

function HelpPage({ core, mutate, onNavigate }) {
  const steps = [
    [Sparkles, "Prepare o cenário", "Crie quatro sessões com perfis e potências diferentes."],
    [Gauge, "Mostre o balanceamento", "Compare a demanda solicitada com o limite de 60 kW."],
    [Timer, "Avance o tempo", "Gere energia, custos e medições em blocos de 15 minutos."],
    [Radio, "Abra os protocolos", "Apresente as mensagens OCPP e MODBUS em JSON."],
    [FileText, "Exporte o relatório", "Finalize com o resumo técnico consolidado."],
  ];
  return (
    <div className="help-layout">
      <section className="panel demo-guide">
        <div className="panel-heading"><div><h3>Roteiro recomendado</h3><p>Demonstre os critérios da Sprint 2 em poucos minutos.</p></div><StatusPill tone="info">5 etapas</StatusPill></div>
        <div className="demo-steps">
          {steps.map(([Icon, title, copy], index) => <div className="demo-step" key={title}><span>{index + 1}</span><i><Icon size={20} /></i><p><strong>{title}</strong><small>{copy}</small></p></div>)}
        </div>
        <div className="demo-guide__actions">
          <button className="button button--primary" onClick={() => mutate((engine) => engine.createAutoScenario(), "Cenário automático preparado.")}><Sparkles size={17} /> Preparar demonstração</button>
          <button className="button button--secondary" onClick={() => onNavigate("overview")}>Voltar à visão geral</button>
        </div>
      </section>
      <aside className="help-side">
        <section className="support-card"><span><Headphones size={25} /></span><div><small>Precisa de ajuda?</small><strong>Suporte ChargeGrid</strong><p>equipe3.1ccpq@gmail.com</p></div></section>
        <section className="panel system-info"><h3>Sobre a simulação</h3><p>O motor replica as regras de balanceamento, tarifação e telemetria do protótipo original.</p><dl><div><dt>Versão</dt><dd>3.0 web</dd></div><div><dt>Armazenamento</dt><dd>Local</dd></div><div><dt>Mensagens</dt><dd>{core.protocolMessages.length}</dd></div></dl></section>
      </aside>
      <section className="panel math-guide">
        <div className="panel-heading"><div><h3>Como os valores são calculados</h3><p>As fórmulas usadas pelo motor, sem esconder os fatores da tarifa.</p></div><StatusPill tone="info" icon={Info}>Cálculo transparente</StatusPill></div>
        <div className="math-formula-grid">
          <article><span><CircleDollarSign size={20} /></span><div><small>Tarifa dinâmica</small><strong>base × horário × demanda × perfil × potência</strong><p>Os ajustes são multiplicativos e o resultado é arredondado para 3 casas.</p></div></article>
          <article><span><Zap size={20} /></span><div><small>Energia entregue</small><strong>kW × horas = kWh</strong><p>22 kW durante 30 minutos equivalem, idealmente, a 11 kWh.</p></div></article>
          <article><span><WalletCards size={20} /></span><div><small>Custo da sessão</small><strong>kWh × R$/kWh</strong><p>Um teto financeiro é autorização máxima; se a bateria encher antes, cobra menos.</p></div></article>
          <article><span><Gauge size={20} /></span><div><small>Balanceamento</small><strong>peso = kW solicitado × prioridade</strong><p>O limite do eletroposto é dividido proporcionalmente, sem superar o pedido do carro.</p></div></article>
        </div>
        <div className="tariff-rule-chips"><span>Base R$ 0,805</span><span>Pico +20%</span><span>Demanda +8% ou +15%</span><span>Assinante −10%</span><span>Frota −5%</span><span>Acima de 11 kW +10%</span></div>
        <div className="math-guide-note"><Info size={18} /><p><strong>Perfis não são mensalidades.</strong><span>Comum, Visitante, Assinante e Frota controlam prioridade e desconto. Planos Free/Plus/Premium e cobrança mensal não fazem parte do motor atual. O Saldo ChargeGrid é crédito digital no app, não cartão físico.</span></p></div>
      </section>
    </div>
  );
}

function Modal({ title, eyebrow, children, onClose, size = "medium" }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header"><div>{eyebrow && <span>{eyebrow}</span>}<h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

function NewSessionModal({ core, onClose, onSubmit }) {
  const occupied = new Set(core.activeSessions().map((session) => session.connectorId));
  const firstAvailable = connectorCatalog.find((connector) => !occupied.has(connector.id))?.id ?? 1;
  const [form, setForm] = useState({ vehicle: "", connectorId: String(firstAvailable), userType: "Comum", requestedKw: "22", plannedMinutes: "60" });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Modal title="Iniciar nova sessão" eyebrow="Operação manual" onClose={onClose}>
      <form className="session-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, connectorId: Number(form.connectorId), requestedKw: Number(form.requestedKw.replace(",", ".")), plannedMinutes: Number(form.plannedMinutes) }); }}>
        <label className="field field--full"><span>Veículo ou identificação</span><div className="field-control"><Car size={17} /><input autoFocus value={form.vehicle} onChange={update("vehicle")} placeholder="Ex.: BYD Dolphin · Cliente 24" /></div><small>Se ficar vazio, o sistema gera um nome automaticamente.</small></label>
        <label className="field"><span>Conector</span><div className="field-control"><PlugZap size={17} /><select value={form.connectorId} onChange={update("connectorId")}>{connectorCatalog.map((connector) => <option key={connector.id} value={connector.id} disabled={occupied.has(connector.id)}>#{connector.id} · {connector.type}{occupied.has(connector.id) ? " (ocupado)" : ""}</option>)}</select></div></label>
        <label className="field"><span>Perfil</span><div className="field-control"><UserRound size={17} /><select value={form.userType} onChange={update("userType")}><option>Comum</option><option>Assinante</option><option>Frota</option><option>Visitante</option></select></div></label>
        <label className="field"><span>Potência solicitada</span><div className="field-control"><Zap size={17} /><select value={form.requestedKw} onChange={update("requestedKw")}><option value="7.4">7,4 kW</option><option value="11">11 kW</option><option value="22">22 kW</option><option value="30">30 kW</option><option value="50">50 kW</option></select></div></label>
        <label className="field"><span>Tempo planejado</span><div className="field-control"><Timer size={17} /><input type="number" min="1" value={form.plannedMinutes} onChange={update("plannedMinutes")} /><em>min</em></div></label>
        <div className="form-callout"><Sparkles size={18} /><p><strong>Controle inteligente automático</strong><span>A potência será recalculada considerando todas as sessões ativas.</span></p></div>
        <footer className="modal__footer"><button type="button" className="button button--secondary" onClick={onClose}>Cancelar</button><button className="button button--primary" type="submit"><Zap size={17} /> Iniciar sessão</button></footer>
      </form>
    </Modal>
  );
}

function SessionDetailsModal({ session, onClose, onFinish }) {
  const progress = Math.min(100, (session.elapsedMinutes / session.plannedMinutes) * 100);
  return (
    <Modal title={session.sessionId} eyebrow="Detalhes da sessão" onClose={onClose}>
      <div className="session-detail-hero"><span><Car size={26} /></span><div><h3>{session.vehicle}</h3><p>Conector {session.connectorId} · Perfil {session.userType}</p></div><StatusPill tone={session.status === "Ativa" ? "success" : "neutral"}>{session.status}</StatusPill></div>
      <div className="detail-metrics"><div><span>Potência atual</span><strong>{formatNumber(session.allocatedKw)} kW</strong><small>solicitado: {formatNumber(session.requestedKw)} kW</small></div><div><span>Energia</span><strong>{formatNumber(session.energyKwh)} kWh</strong><small>entregue até agora</small></div><div><span>Custo</span><strong>{formatCurrency(session.totalCost)}</strong><small>{formatCurrency(session.currentTariff)}/kWh</small></div></div>
      <div className="detail-progress"><div><span>Progresso da sessão</span><strong>{Math.round(progress)}%</strong></div><i><b style={{ width: `${progress}%` }} /></i><small>{session.elapsedMinutes} de {session.plannedMinutes} minutos</small></div>
      <div className={`control-callout ${session.allocatedKw < session.requestedKw ? "is-warning" : ""}`}><Gauge size={19} /><p><strong>Decisão do controle</strong><span>{session.controlReason}</span></p></div>
      <footer className="modal__footer"><button className="button button--secondary" onClick={onClose}>Fechar</button>{session.status === "Ativa" && <button className="button button--danger-ghost" onClick={onFinish}>Encerrar sessão</button>}</footer>
    </Modal>
  );
}

const stationSteps = [
  { id: 1, label: "Identificar veículo", icon: Cable },
  { id: 2, label: "Limite e pagamento", icon: CreditCard },
  { id: 3, label: "Carregando", icon: Zap },
  { id: 4, label: "Finalizar", icon: BadgeCheck },
];

function StationTerminal({ core, mutate, onExit, onOpenApp }) {
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [targetMode, setTargetMode] = useState("money");
  const [moneyDigits, setMoneyDigits] = useState("");
  const [timeDigits, setTimeDigits] = useState("60");
  const [powerDigits, setPowerDigits] = useState("7");
  const [spendingCapDigits, setSpendingCapDigits] = useState("");
  const [spendingCapEnabled, setSpendingCapEnabled] = useState(false);
  const [connectorId, setConnectorId] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState("idle");
  const [identifiedVehicle, setIdentifiedVehicle] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [walletAuthenticated, setWalletAuthenticated] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const session = sessionId ? core.getSession(sessionId) : null;
  const selectedConnector = connectorCatalog.find((item) => item.id === connectorId) ?? null;
  const customerProfile = paymentMethod === "wallet" ? "Assinante" : "Visitante";
  const targetAmountBrl = Number(moneyDigits || 0) / 100;
  const targetMinutes = Number(timeDigits || 0);
  const targetPowerKw = Number(powerDigits || 0);
  const spendingCapBrl = Number(spendingCapDigits || 0) / 100;
  const projectedTariff = core.calculateProjectedTariff({
    userType: customerProfile,
    requestedKw: 50,
  });
  const liveTariff = session?.currentTariff || projectedTariff.finalTariff;

  const connectorVehicleLimit = selectedConnector
    ? selectedConnector.type === "CCS2"
      ? DEMO_VEHICLE.maxDcKw
      : DEMO_VEHICLE.maxAcKw
    : 0;
  const effectivePowerKw = selectedConnector
    ? Math.min(selectedConnector.hardwarePower, connectorVehicleLimit)
    : 0;
  const requestedPowerKw = targetMode === "power"
    ? Math.min(effectivePowerKw, targetPowerKw || 0)
    : effectivePowerKw;
  const connectorTariff = selectedConnector
    ? core.calculateProjectedTariff({ userType: customerProfile, requestedKw: requestedPowerKw })
        .finalTariff
    : liveTariff;
  const energyToFullKwh = DEMO_VEHICLE.batteryCapacityKwh * ((100 - DEMO_VEHICLE.initialSoc) / 100);
  const minutesToFull = effectivePowerKw > 0 ? (energyToFullKwh / effectivePowerKw) * 60 : 0;
  const costToFull = energyToFullKwh * connectorTariff;
  const maximumAuthorizationCents = Math.max(1, Math.round(costToFull * 100));
  const maximumAuthorizationBrl = maximumAuthorizationCents / 100;
  const minimumAuthorizationCents = Math.min(500, maximumAuthorizationCents);
  const maximumTimeMinutes = Math.max(1, Math.ceil(minutesToFull));
  const moneyCents = Number(moneyDigits || 0);
  const spendingCapCents = Number(spendingCapDigits || 0);
  const optionalCapValid = !spendingCapEnabled || (
    spendingCapCents >= minimumAuthorizationCents &&
    spendingCapCents <= maximumAuthorizationCents
  );
  const targetValid = Boolean(selectedConnector && identifiedVehicle) && (
    targetMode === "money"
      ? moneyCents >= minimumAuthorizationCents && moneyCents <= maximumAuthorizationCents
      : targetMode === "time"
        ? targetMinutes >= Math.min(15, maximumTimeMinutes) && targetMinutes <= maximumTimeMinutes && optionalCapValid
        : targetPowerKw >= 1 && targetPowerKw <= effectivePowerKw && optionalCapValid
  );
  const paymentReady = targetValid && (paymentMethod !== "wallet" || walletAuthenticated);
  const requestedFinancialCap = targetMode === "money"
    ? targetAmountBrl
    : spendingCapEnabled
      ? spendingCapBrl
      : null;
  const authorizedCapBrl = requestedFinancialCap === null
    ? null
    : Math.min(requestedFinancialCap, maximumAuthorizationBrl);
  const targetEnergyKwh = targetMode === "money"
    ? Math.min(energyToFullKwh, authorizedCapBrl / connectorTariff)
    : targetMode === "time"
      ? Math.min(
          energyToFullKwh,
          requestedPowerKw * (targetMinutes / 60),
          authorizedCapBrl === null ? Number.POSITIVE_INFINITY : authorizedCapBrl / connectorTariff,
        )
      : Math.min(
          energyToFullKwh,
          authorizedCapBrl === null ? Number.POSITIVE_INFINITY : authorizedCapBrl / connectorTariff,
        );
  const previewMinutes = requestedPowerKw > 0 ? (targetEnergyKwh / requestedPowerKw) * 60 : 0;
  const previewCost = targetEnergyKwh * connectorTariff;
  const chargePreview = selectedConnector
    ? { effectivePowerKw, requestedPowerKw, tariff: connectorTariff, energyToFullKwh, minutesToFull, costToFull, maximumAuthorizationBrl, authorizedCapBrl, targetEnergyKwh, previewMinutes, previewCost }
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session && session.status !== "Ativa" && step === 3) setStep(4);
  }, [session, step]);

  const authorizePayment = () => {
    if (!paymentReady || paymentStatus !== "idle") return;
    setPaymentStatus("processing");
    window.setTimeout(() => {
      setPaymentStatus("approved");
      window.setTimeout(() => beginCharge(), 500);
    }, 900);
  };

  const handleTargetKey = (key, field = "primary") => {
    const setter = field === "cap"
      ? setSpendingCapDigits
      : targetMode === "money"
        ? setMoneyDigits
        : targetMode === "time"
          ? setTimeDigits
          : setPowerDigits;
    const maxLength = field === "cap" || targetMode === "money" ? 6 : 3;
    setter((current) => {
      if (key === "clear") return "";
      if (key === "backspace") return current.slice(0, -1);
      const next = `${current}${key}`.replace(/^0+(?=\d)/, "");
      return next.slice(0, maxLength);
    });
  };

  const selectConnector = (nextConnectorId) => {
    setConnectorId(nextConnectorId);
    setDetectionStatus("idle");
    setIdentifiedVehicle(null);
  };

  const handleConnectionAction = () => {
    if (!selectedConnector || !chargePreview) return;
    if (detectionStatus !== "detected") {
      setDetectionStatus("scanning");
      window.setTimeout(() => {
        setIdentifiedVehicle({ ...DEMO_VEHICLE, detectedAt: new Date().toISOString() });
        setDetectionStatus("detected");
      }, 950);
      return;
    }

    setMoneyDigits(String(maximumAuthorizationCents));
    setTimeDigits(String(Math.min(60, maximumTimeMinutes)));
    setPowerDigits(String(effectivePowerKw));
    setStep(2);
  };

  const beginCharge = () => {
    if (!selectedConnector || !chargePreview || !paymentReady) return;
    const created = mutate(
      (engine) => {
        const started = engine.startSession({
          vehicle: DEMO_VEHICLE.model,
          connectorId,
          connectorType: selectedConnector.type,
          connectorMaxKw: selectedConnector.hardwarePower,
          userType: customerProfile,
          requestedKw: chargePreview.requestedPowerKw,
          plannedMinutes: targetMode === "time" ? targetMinutes : Math.max(1, chargePreview.previewMinutes),
          targetMode,
          targetAmountBrl: chargePreview.authorizedCapBrl,
          targetMinutes: targetMode === "time" ? targetMinutes : null,
          targetPowerKw: targetMode === "power" ? targetPowerKw : null,
          batteryCapacityKwh: DEMO_VEHICLE.batteryCapacityKwh,
          initialSoc: DEMO_VEHICLE.initialSoc,
          targetSoc: 100,
          vehicleMaxPowerKw: connectorVehicleLimit,
          chargingEfficiency: 1,
        });
        engine.simulateProtocolExchange(started.sessionId);
        return started;
      },
      "BYD Dolphin identificado. Recarga iniciada.",
    );
    if (created) {
      setSessionId(created.sessionId);
      setStep(3);
    }
  };

  const advanceCharge = () => {
    mutate((engine) => engine.advanceTime(15), "Recarga avançada em 15 minutos.");
    const updated = core.getSession(sessionId);
    if (updated?.status !== "Ativa") setStep(4);
  };

  const finishCharge = () => {
    if (session?.status === "Ativa") mutate((engine) => engine.finishSession(sessionId), "Recarga finalizada.");
    setStep(4);
  };

  const resetFlow = () => {
    setStep(1);
    setPaymentStatus("idle");
    setPaymentMethod("card");
    setTargetMode("money");
    setMoneyDigits("");
    setTimeDigits("60");
    setPowerDigits("7");
    setSpendingCapDigits("");
    setSpendingCapEnabled(false);
    setConnectorId(null);
    setDetectionStatus("idle");
    setIdentifiedVehicle(null);
    setSessionId(null);
    setWalletAuthenticated(false);
  };

  return (
    <main className="station-environment">
      <div className="station-ambient station-ambient--left" />
      <div className="station-ambient station-ambient--right" />
      <header className="station-header">
        <Brand inverse />
        <div className="station-header__center"><StatusPill tone="success" icon={Wifi}>Estação online</StatusPill><span>CG-1024 · Av. Paulista</span></div>
        <div className="station-header__actions"><button onClick={() => setTechnicalOpen(true)}><Settings2 size={17} /> Painel técnico</button><button onClick={onExit}><RefreshCw size={17} /> Trocar ambiente</button></div>
      </header>

      <div className="terminal-bezel">
        <div className="terminal-screen">
          <aside className="station-stepper">
            <Brand inverse compact />
            <div className="station-stepper__divider" />
            <ol>
              {stationSteps.map(({ id, label, icon: Icon }) => (
                <li key={id} className={step === id ? "is-active" : step > id ? "is-done" : ""}>
                  <span>{step > id ? <Check size={18} /> : id}</span><Icon size={20} /><strong>{label}</strong>
                </li>
              ))}
            </ol>
            <div className="station-help"><HelpCircle size={24} /><p><span>Precisa de ajuda?</span><strong>0800 123 4567</strong></p></div>
            <div className="renewable-note"><Leaf size={18} /><span>Energia 100% renovável</span></div>
          </aside>

          <section className="station-content">
            <div className="station-content__meta"><span><Clock3 size={17} /> {clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><span>ID Estação: <strong>CG-1024</strong></span></div>
            {step === 1 && <ConnectStep core={core} connectorId={connectorId} onSelectConnector={selectConnector} onBack={onExit} onContinue={handleConnectionAction} detectionStatus={detectionStatus} vehicle={identifiedVehicle} preview={chargePreview} />}
            {step === 2 && (
              <PaymentStep
                tariff={connectorTariff}
                tariffBreakdown={core.calculateProjectedTariff({ userType: customerProfile, requestedKw: requestedPowerKw })}
                targetMode={targetMode}
                setTargetMode={setTargetMode}
                moneyDigits={moneyDigits}
                timeDigits={timeDigits}
                powerDigits={powerDigits}
                spendingCapDigits={spendingCapDigits}
                spendingCapEnabled={spendingCapEnabled}
                setSpendingCapEnabled={setSpendingCapEnabled}
                onSpendingCapChange={(value) => {
                  const amount = Number(String(value).replace(",", "."));
                  setSpendingCapDigits(Number.isFinite(amount) && amount >= 0 ? String(Math.round(amount * 100)) : "");
                }}
                onTargetKey={handleTargetKey}
                onUseMaximum={(field = "primary") => {
                  if (field === "cap") setSpendingCapDigits(String(maximumAuthorizationCents));
                  else setMoneyDigits(String(maximumAuthorizationCents));
                }}
                targetValid={targetValid}
                method={paymentMethod}
                setMethod={(nextMethod) => { setPaymentMethod(nextMethod); if (nextMethod !== "wallet") setWalletAuthenticated(false); }}
                walletAuthenticated={walletAuthenticated}
                onWalletAuthenticated={() => setWalletAuthenticated(true)}
                vehicle={identifiedVehicle}
                connector={selectedConnector}
                effectivePowerKw={effectivePowerKw}
                costToFull={maximumAuthorizationBrl}
                authorizedCapBrl={authorizedCapBrl}
                maximumTimeMinutes={maximumTimeMinutes}
                status={paymentStatus}
                onAuthorize={authorizePayment}
                onCancel={() => { setPaymentStatus("idle"); setStep(1); }}
              />
            )}
            {step === 3 && session && <ChargingStep session={session} core={core} onAdvance={advanceCharge} onFinish={finishCharge} onSimulateProtocol={() => mutate((engine) => engine.simulateProtocolExchange(session.sessionId), "Telemetria OCPP/MODBUS atualizada.")} />}
            {step === 4 && session && <ReceiptStep session={session} onNew={resetFlow} onApp={onOpenApp} />}
          </section>
        </div>
        <div className="terminal-hardware" aria-hidden="true">
          <div><PlugZap size={31} /><p><small>Conector selecionado</small><strong>{selectedConnector ? `${selectedConnector.type} · ${selectedConnector.hardwarePower} kW` : "Aguardando seleção"}</strong></p></div>
          <span className={paymentStatus === "processing" ? "is-reading" : ""}>{paymentMethod === "wallet" ? <Smartphone size={34} /> : <Nfc size={35} />}</span>
          <div><p><small>{step === 1 ? "Conecte o veículo" : paymentMethod === "wallet" ? "Identifique sua conta" : "Aproxime o cartão"}</small><strong>{step === 1 ? "Detecção segura" : paymentMethod === "wallet" ? "Saldo digital" : "Pagamento seguro"}</strong></p>{step === 1 ? <Car size={31} /> : paymentMethod === "wallet" ? <Smartphone size={31} /> : <CreditCard size={31} />}</div>
        </div>
      </div>

      {technicalOpen && <TechnicalDrawer core={core} mutate={mutate} onClose={() => setTechnicalOpen(false)} />}
    </main>
  );
}

function WalletLogin({ authenticated, onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const demoEmails = ["bella@demo.com", "joao@demo.com", "maria@demo.com"];
  const submit = (event) => {
    event.preventDefault();
    if (!demoEmails.includes(email.trim().toLowerCase()) || password !== "123456") {
      setError("Use um dos e-mails demonstrativos e a senha 123456.");
      return;
    }
    setError("");
    onAuthenticated();
  };
  if (authenticated) return <div className="wallet-authenticated"><span><Check size={19} /></span><p><strong>Conta identificada</strong><small>{email || "bella@demo.com"} · Assinante · saldo R$ 120,00</small></p></div>;
  return <form className="wallet-login" onSubmit={submit}>
    <div className="wallet-demo-box"><strong>Modo demonstração</strong><span>Use bella@demo.com, joao@demo.com ou maria@demo.com</span><small>Senha: 123456</small></div>
    <label><span>E-mail</span><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="username" /></label>
    <label><span>Senha</span><div><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Mostrar ou ocultar senha"><Eye size={17} /></button></div></label>
    {error && <p className="wallet-login-error">{error}</p>}
    <button className="wallet-login-submit" type="submit"><Smartphone size={17} /> Identificar conta</button>
  </form>;
}

function PaymentStep({ tariff, tariffBreakdown, targetMode, setTargetMode, moneyDigits, timeDigits, powerDigits, spendingCapDigits, spendingCapEnabled, setSpendingCapEnabled, onSpendingCapChange, onTargetKey, onUseMaximum, targetValid, method, setMethod, walletAuthenticated, onWalletAuthenticated, vehicle, connector, effectivePowerKw, costToFull, authorizedCapBrl, maximumTimeMinutes, status, onAuthorize, onCancel }) {
  const targetAmount = Number(moneyDigits || 0) / 100;
  const targetMinutes = Number(timeDigits || 0);
  const targetPower = Number(powerDigits || 0);
  const spendingCap = Number(spendingCapDigits || 0) / 100;
  const estimatedEnergy = tariff > 0 ? targetAmount / tariff : 0;
  const moneyExceedsVehicle = targetMode === "money" && targetAmount > costToFull;
  const timeExceedsVehicle = targetMode === "time" && targetMinutes > maximumTimeMinutes;
  const powerExceedsVehicle = targetMode === "power" && targetPower > effectivePowerKw;
  const capInvalid = spendingCapEnabled && (spendingCap < Math.min(5, costToFull) || spendingCap > costToFull);
  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"];
  return (
    <div className="station-step-content payment-step">
      <div className="station-title"><div><span>Etapa 2 de 4</span><h1>Defina o limite e pague</h1><p>{vehicle?.model} identificado no conector {connector?.id}. Escolha valor, tempo ou potência.</p></div><StatusPill tone="success" icon={Car}>Veículo identificado</StatusPill></div>
      <div className="payment-layout">
        <div className="rate-column">
          <span className="terminal-label">Tarifa dinâmica estimada <Info size={15} /></span>
          <div className="terminal-price"><strong>{formatCurrency(tariff)}</strong><span>/kWh</span></div>
          <p className="tariff-preview-note">Tarifa calculada para {formatNumber(targetMode === "power" ? targetPower : effectivePowerKw)} kW, conector {connector?.type} e perfil do pagamento.</p>
          <div className="tariff-factor-list">
            <div><span>Tarifa-base</span><strong>R$ {tariffBreakdown.baseTariff.toFixed(3).replace(".", ",")}</strong></div>
            {tariffBreakdown.factors.map((factor) => <div key={factor.id}><span>{factor.label}</span><strong className={factor.percent < 0 ? "is-discount" : ""}>{factor.percent > 0 ? "+" : ""}{number.format(factor.percent)}%</strong></div>)}
          </div>
          <div className="occupancy-fee"><span>Taxa de permanência <Info size={14} /></span><strong>Não aplicada nesta demonstração</strong></div>
        </div>

        <div className="target-panel">
          <span className="terminal-label">Como deseja limitar?</span>
          <div className="target-mode-selector target-mode-selector--three" role="tablist" aria-label="Tipo de limite da recarga">
            <button className={targetMode === "money" ? "is-active" : ""} onClick={() => setTargetMode("money")} disabled={status !== "idle"}><CircleDollarSign size={18} /> Por valor</button>
            <button className={targetMode === "time" ? "is-active" : ""} onClick={() => setTargetMode("time")} disabled={status !== "idle"}><Timer size={18} /> Por tempo</button>
            <button className={targetMode === "power" ? "is-active" : ""} onClick={() => setTargetMode("power")} disabled={status !== "idle"}><Gauge size={18} /> Por kW</button>
          </div>
          <div className="target-display">
            <span>{targetMode === "money" ? "Valor máximo autorizado" : targetMode === "time" ? "Tempo máximo de recarga" : "Potência máxima solicitada"}</span>
            <strong>{targetMode === "money" ? formatCurrency(targetAmount) : targetMode === "time" ? formatDuration(targetMinutes) : `${formatNumber(targetPower)} kW`}</strong>
            <small>{targetMode === "money" ? `Até ${formatNumber(estimatedEnergy)} kWh pela tarifa atual` : targetMode === "time" ? `Potência efetiva disponível: até ${formatNumber(effectivePowerKw)} kW` : `Disponível neste conjunto carro + estação: até ${formatNumber(effectivePowerKw)} kW`}</small>
          </div>
          <div className="vehicle-input-limits"><span>Limites calculados para este veículo</span><strong>{targetMode === "money" ? `Máximo ${formatCurrency(costToFull)}` : targetMode === "time" ? `Máximo ${formatDuration(maximumTimeMinutes)}` : `Máximo ${formatNumber(effectivePowerKw)} kW`}</strong>{targetMode === "money" && <button onClick={() => onUseMaximum()} disabled={status !== "idle"}>Usar máximo</button>}</div>
          <div className="numeric-keypad" aria-label="Teclado numérico">
            {keypadKeys.map((key) => <button key={key} onClick={() => onTargetKey(key)} aria-label={key === "clear" ? "Limpar" : key === "backspace" ? "Apagar último dígito" : `Número ${key}`} disabled={status !== "idle"}>{key === "clear" ? "C" : key === "backspace" ? "⌫" : key}</button>)}
          </div>
          {targetMode !== "money" && <div className={`optional-spending-cap ${spendingCapEnabled ? "is-enabled" : ""}`}><label><span><strong>Adicionar teto em reais</strong><small>Opcional · desliga a recarga também ao atingir esse valor.</small></span><input type="checkbox" checked={spendingCapEnabled} onChange={(event) => setSpendingCapEnabled(event.target.checked)} disabled={status !== "idle"} /><i /></label>{spendingCapEnabled && <div className="spending-cap"><span>Teto financeiro opcional</span><strong>{formatCurrency(spendingCap)}</strong><small>Máximo coerente com a bateria: {formatCurrency(costToFull)}.</small><label className="spending-cap-input"><span>R$</span><input type="number" min="0" max={costToFull} step="0.01" value={spendingCapDigits ? spendingCap.toFixed(2) : ""} onChange={(event) => onSpendingCapChange(event.target.value)} placeholder="0,00" inputMode="decimal" disabled={status !== "idle"} /></label><button className="spending-cap-maximum" onClick={() => onUseMaximum("cap")}>Usar máximo do veículo</button></div>}</div>}
          <div className="authorization-summary"><span>Autorização da sessão</span><strong>{authorizedCapBrl === null ? "Sem teto adicional" : formatCurrency(authorizedCapBrl)}</strong><small>{targetMode === "money" ? `O valor deve ficar entre ${formatCurrency(Math.min(5, costToFull))} e ${formatCurrency(costToFull)}. ` : spendingCapEnabled ? "O teto opcional é uma trava adicional. " : "A sessão será limitada pelo método escolhido e pela bateria. "}A cobrança final usa apenas a energia consumida.</small></div>
          <p className={`target-validation ${targetValid ? "is-valid" : ""}`}>{targetValid ? <><Check size={14} /> Limites compatíveis com carro e conector</> : <><Info size={14} /> {moneyExceedsVehicle ? `Este veículo completa a carga com no máximo ${formatCurrency(costToFull)}.` : timeExceedsVehicle ? `A bateria chega a 100% em até ${formatDuration(maximumTimeMinutes)} nesta potência.` : powerExceedsVehicle ? `O conjunto carro + conector aceita no máximo ${formatNumber(effectivePowerKw)} kW.` : capInvalid ? `O teto opcional deve ficar entre ${formatCurrency(Math.min(5, costToFull))} e ${formatCurrency(costToFull)}.` : targetMode === "money" ? `Informe de ${formatCurrency(Math.min(5, costToFull))} a ${formatCurrency(costToFull)}.` : targetMode === "time" ? `Informe de ${formatDuration(Math.min(15, maximumTimeMinutes))} a ${formatDuration(maximumTimeMinutes)}.` : `Use de 1 a ${formatNumber(effectivePowerKw)} kW.`}</>}</p>
        </div>

        <div className="payment-column">
          <div className="method-selector">
            <button className={method === "card" ? "is-active" : ""} onClick={() => setMethod("card")} disabled={status !== "idle"}><CreditCard size={19} /><span><strong>Cartão bancário</strong><small>Crédito ou débito · visitante</small></span><i>{method === "card" && <Check size={13} />}</i></button>
            <button className={method === "wallet" ? "is-active" : ""} onClick={() => setMethod("wallet")} disabled={status !== "idle"}><Smartphone size={19} /><span><strong>Saldo ChargeGrid</strong><small>Créditos digitais da conta</small></span><i>{method === "wallet" && <Check size={13} />}</i></button>
          </div>
          {method === "card" && <button className={`contactless-pad is-${status}`} onClick={onAuthorize} disabled={status !== "idle" || !targetValid}>
            {status === "idle" && method === "card" && <><span><Nfc size={44} /></span><strong>Aproxime ou insira seu cartão</strong><small>Toque aqui para simular a autorização bancária</small></>}
            {status === "processing" && <><span className="reader-pulse">{method === "wallet" ? <Smartphone size={40} /> : <Nfc size={42} />}</span><strong>Autorizando pagamento...</strong><small>{method === "wallet" ? "Validando os créditos digitais da conta" : "Mantenha o cartão próximo ao leitor"}</small></>}
            {status === "approved" && <><span className="approved-icon"><Check size={38} /></span><strong>Pagamento autorizado</strong><small>Preparando o próximo passo</small></>}
          </button>}
          {method === "card" ? <div className="accepted-cards"><span>Aceitamos</span><strong>VISA</strong><strong className="mastercard-mark"><i /><i /></strong><strong>elo</strong><strong>AMEX</strong></div> : <><WalletLogin authenticated={walletAuthenticated} onAuthenticated={onWalletAuthenticated} /><div className="wallet-explainer"><Info size={16} /><p><strong>Não é um cartão físico.</strong><span>É saldo digital da conta autenticada. O desconto vem do perfil Assinante, não do meio de pagamento.</span></p></div></>}
        </div>
      </div>
      <div className="station-renewable"><Leaf size={23} /><p><strong>Energia 100% renovável</strong><span>Ao carregar aqui, você ajuda a reduzir emissões de CO₂.</span></p></div>
      <footer className="station-footer-actions"><button className="station-button station-button--secondary" onClick={onCancel}><ArrowLeft size={20} /> Voltar ao veículo</button><button className="station-button station-button--primary" onClick={onAuthorize} disabled={status !== "idle" || !targetValid || (method === "wallet" && !walletAuthenticated)}>{status === "processing" ? "Autorizando..." : status === "approved" ? "Autorizado" : method === "wallet" ? walletAuthenticated ? "Usar saldo e iniciar" : "Identifique sua conta" : "Pagar e iniciar"}<ArrowRight size={20} /></button></footer>
    </div>
  );
}

function ConnectStep({ core, connectorId, onSelectConnector, onBack, onContinue, detectionStatus, vehicle, preview }) {
  const occupied = new Set(core.activeSessions().map((session) => session.connectorId));
  const selected = connectorCatalog.find((connector) => connector.id === connectorId);
  const isAcLimited = selected?.type === "Tipo 2" && selected.hardwarePower > DEMO_VEHICLE.maxAcKw;
  return (
    <div className="station-step-content connect-step">
      <div className="station-title"><div><span>Etapa 1 de 4</span><h1>Conecte e identifique o veículo</h1><p>Primeiro lemos o carro e a bateria; depois você escolhe os limites e o pagamento.</p></div><StatusPill tone={vehicle ? "success" : "neutral"} icon={vehicle ? BadgeCheck : Cable}>{vehicle ? "Identificação concluída" : "Aguardando conexão"}</StatusPill></div>
      <div className="connect-layout">
        <div className="connector-choice-grid">
          {connectorCatalog.map((connector) => {
            const unavailable = occupied.has(connector.id);
            return (
              <button key={connector.id} disabled={unavailable || detectionStatus === "scanning"} className={connectorId === connector.id ? "is-selected" : ""} onClick={() => onSelectConnector(connector.id)}>
                <span className="connector-number">{connector.id}</span><div><strong>{connector.type}</strong><small>Potência máxima: até {connector.hardwarePower} kW</small></div><StatusPill tone={unavailable ? "neutral" : "success"}>{unavailable ? "Em uso" : "Livre"}</StatusPill>{connectorId === connector.id && <i><Check size={14} /></i>}
              </button>
            );
          })}
        </div>
        {!vehicle && <div className="connect-illustration">
          <div className="connect-glow" />
          <span className="station-pedestal"><Zap size={31} fill="currentColor" /></span>
          <svg viewBox="0 0 320 150" aria-hidden="true"><path className="car-body" d="M45 100 67 64c7-11 17-17 31-18l94-5c19-1 37 7 49 21l22 27 20 6c10 3 16 10 16 21v14H34v-13c0-8 4-14 11-17Z"/><path className="car-window" d="M87 62c4-6 10-9 18-10l74-4c15-1 28 5 38 15l13 17H76l11-18Z"/><circle cx="84" cy="127" r="18"/><circle cx="245" cy="127" r="18"/><path className="cable-line" d="M285 104c31-3 20-59 6-70"/></svg>
          <div className={`connection-state ${connectorId ? "is-ready" : ""}`}><span>{detectionStatus === "scanning" ? <Radio size={21} /> : connectorId ? <PlugZap size={21} /> : <Cable size={21} />}</span><p><strong>{detectionStatus === "scanning" ? "Lendo dados do veículo..." : connectorId ? `Conector ${connectorId} selecionado` : "Selecione um conector"}</strong><small>{detectionStatus === "scanning" ? "Handshake simulado em andamento" : connectorId ? "Conecte o cabo e inicie a identificação." : "Mostraremos as instruções de conexão."}</small></p></div>
        </div>}
        {vehicle && preview && <div className="vehicle-detected-card">
          <header><span><Car size={25} /></span><div><small>Veículo reconhecido pela simulação</small><h2>{vehicle.model}</h2></div><StatusPill tone="success">Leitura simulada</StatusPill></header>
          <div className="vehicle-soc-row"><div className="vehicle-soc"><span>Estado de carga (SOC)</span><strong>{vehicle.initialSoc}%</strong><small>Faltam {100 - vehicle.initialSoc} pontos percentuais</small><i><b style={{ width: `${vehicle.initialSoc}%` }} /></i></div><div><span>Capacidade total</span><strong>{formatNumber(vehicle.batteryCapacityKwh)} kWh</strong><small>Bateria a 100%</small></div></div>
          <div className="vehicle-limit-grid"><div><span>Estação selecionada</span><strong>até {formatNumber(selected?.hardwarePower)} kW</strong><small>{selected?.type} · limite do equipamento</small></div><div><span>Potência efetiva</span><strong>{formatNumber(preview.effectivePowerKw)} kW</strong><small>menor limite entre carro e estação</small></div><div><span>Energia necessária</span><strong>{formatNumber(preview.energyToFullKwh)} kWh</strong><small>de {vehicle.initialSoc}% a 100%, sem perdas</small></div><div><span>Tempo ideal estimado</span><strong>{formatDuration(preview.minutesToFull)}</strong><small>pode variar durante a recarga</small></div></div>
          {isAcLimited && <div className="vehicle-limit-note"><Info size={18} /><p><strong>Por que 11 e 22 kW dão o mesmo tempo?</strong><small>Este BYD Dolphin demonstrativo aceita até {formatNumber(vehicle.maxAcKw)} kW em AC. Assim, ambos os conectores Tipo 2 ficam limitados pelo carro a {formatNumber(preview.effectivePowerKw)} kW.</small></p></div>}
          <div className="vehicle-projection"><span><BatteryCharging size={20} /></span><p><strong>Para completar até 100%</strong><small>Até {formatDuration(preview.minutesToFull)} e {formatCurrency(preview.costToFull)}, se a potência permanecer disponível.</small></p></div>
        </div>}
      </div>
      <div className="connector-education"><article><strong><Gauge size={18} /> kW é potência</strong><span>É a velocidade da recarga. Em condição ideal, 22 kW por 30 min fornecem 11 kWh.</span></article><article><strong><PlugZap size={18} /> Tipo 2 · AC</strong><span>A estação entrega corrente alternada; o carregador interno do carro a converte em DC para a bateria.</span></article><article><strong><Zap size={18} /> CCS2 · DC</strong><span>A estação faz a conversão e entrega corrente contínua à bateria; costuma permitir maior potência.</span></article></div>
      <footer className="station-footer-actions"><button className="station-button station-button--secondary" onClick={onBack}><ArrowLeft size={20} /> Voltar</button><button className="station-button station-button--primary" disabled={!connectorId || detectionStatus === "scanning"} onClick={onContinue}>{detectionStatus === "scanning" ? "Identificando..." : detectionStatus === "detected" ? "Continuar para limites" : "Identificar veículo"} <ArrowRight size={20} /></button></footer>
    </div>
  );
}

function StationProtocolPanel({ messages, onSimulate }) {
  return <section className="station-protocol-panel">
    <header><div><span><Radio size={18} /></span><p><strong>Telemetria simulada</strong><small>OCPP-like + MODBUS-like · sem comunicação real</small></p></div><button onClick={onSimulate}><RefreshCw size={15} /> Atualizar</button></header>
    <div className="station-protocol-list">
      {messages.length ? messages.map((message) => <article key={message.id}>
        <span className={`protocol-mini-badge is-${message.protocol.toLowerCase()}`}>{message.protocol}</span>
        <p><strong>{message.type}</strong><small>{new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {message.sessionId}</small></p>
        <details><summary>JSON</summary><pre>{JSON.stringify(message.payload, null, 2)}</pre></details>
      </article>) : <p className="protocol-empty">Aguardando a primeira troca de mensagens.</p>}
    </div>
  </section>;
}

function ChargingStep({ session, core, onAdvance, onFinish, onSimulateProtocol }) {
  const batterySoc = Number.isFinite(session.currentSoc) ? session.currentSoc : 0;
  const batteryProgress = Number.isFinite(session.currentSoc) && Number.isFinite(session.initialSoc)
    ? ((session.currentSoc - session.initialSoc) / (session.targetSoc - session.initialSoc)) * 100
    : 0;
  const targetTotal = session.targetMode === "time" ? session.targetMinutes : session.targetAmountBrl;
  const targetCurrent = session.targetMode === "time" ? session.elapsedMinutes : session.totalCost;
  const progress = session.targetMode === "power"
    ? Math.min(100, Math.max(0, batteryProgress))
    : Math.min(100, targetTotal > 0 ? (targetCurrent / targetTotal) * 100 : 0);
  const limited = session.allocatedKw < session.requestedKw;
  const protocolMessages = core.protocolMessages.filter((message) => message.sessionId === session.sessionId).slice(-6).reverse();
  const remainingTarget = session.targetMode === "time"
    ? Math.max(0, session.targetMinutes - session.elapsedMinutes)
    : Number.isFinite(session.targetAmountBrl)
      ? Math.max(0, session.targetAmountBrl - session.totalCost)
      : null;
  return (
    <div className="station-step-content charging-step">
      <div className="station-title"><div><span>Etapa 3 de 4</span><h1>{session.vehicle} está carregando</h1><p>A bateria, o limite escolhido e os protocolos são atualizados em conjunto.</p></div><StatusPill tone="success" icon={BatteryCharging}>Recarga ativa</StatusPill></div>
      <div className="charging-layout">
        <div className="charge-ring-card">
          <div className="charge-ring" style={{ "--progress": `${batterySoc * 3.6}deg` }}><div><BatteryCharging size={30} /><strong>{Math.round(batterySoc)}%</strong><span>da bateria</span></div></div>
          <p><span>{session.sessionId} · VEÍCULO IDENTIFICADO</span><strong>{session.vehicle}</strong><small>Conector {session.connectorId} · {session.connectorType} · perfil {session.userType}</small></p>
        </div>
        <div className="live-metrics-grid">
          <div className="live-metric live-metric--primary"><span><Gauge size={18} /> Potência atual</span><strong>{formatNumber(session.allocatedKw)} <em>kW</em></strong><small>Solicitada: {formatNumber(session.requestedKw)} kW</small></div>
          <div className="live-metric"><span><Zap size={18} /> Energia entregue</span><strong>{formatNumber(session.energyKwh)} <em>kWh</em></strong><small>Atualizada a cada avanço</small></div>
          <div className="live-metric"><span><Clock3 size={18} /> Tempo decorrido</span><strong>{formatDuration(session.elapsedMinutes)}</strong><small>{session.targetMode === "time" ? `limite: ${formatDuration(session.targetMinutes)}` : `estimativa inicial: ${formatDuration(session.plannedMinutes)}`}</small></div>
          <div className="live-metric"><span><WalletCards size={18} /> Custo até agora</span><strong>{formatCurrency(session.totalCost)}</strong><small>{formatCurrency(session.currentTariff)}/kWh · {Number.isFinite(session.targetAmountBrl) ? `teto ${formatCurrency(session.targetAmountBrl)}` : "sem teto adicional"}</small></div>
        </div>
      </div>
      <div className={`smart-control-banner ${limited ? "is-limited" : ""}`}><span>{limited ? <Activity size={21} /> : <ShieldCheck size={21} />}</span><p><strong>{limited ? "Potência ajustada pela rede" : "Potência disponível para o veículo"}</strong><small>{limited ? `${session.controlReason}. O limite total atual é ${formatNumber(core.siteLimitKw)} kW.` : `A entrega respeita o menor limite entre estação (${formatNumber(session.connectorMaxKw)} kW), carro (${formatNumber(session.vehicleMaxPowerKw)} kW) e rede.`}</small></p><StatusPill tone={limited ? "warning" : "success"}>{limited ? "Smart charging" : "Estável"}</StatusPill></div>
      <div className="charging-lower-grid">
        <section className="charge-target-card"><header><div><span><Car size={18} /></span><p><strong>Limite inteligente da sessão</strong><small>Encerra por {session.targetMode === "money" ? "valor" : session.targetMode === "time" ? "tempo" : "carga completa"}{Number.isFinite(session.targetAmountBrl) && session.targetMode !== "money" ? ", teto opcional" : ""}, bateria a 100% ou ação manual.</small></p></div><StatusPill tone="neutral">{session.targetMode === "money" ? "Por valor" : session.targetMode === "time" ? "Por tempo" : "Por potência"}</StatusPill></header><div className="charge-timeline"><div><span>Início</span><strong>{formatDate(session.startTime, true)}</strong></div><i><b style={{ width: `${progress}%` }} /></i><div><span>{session.targetMode === "power" ? "Carga concluída" : "Meta usada"}</span><strong>{Math.round(progress)}%</strong></div></div><div className="charge-target-stats"><div><span>{session.targetMode === "time" ? "Tempo restante" : session.targetMode === "power" ? "Potência escolhida" : "Saldo do teto"}</span><strong>{session.targetMode === "time" ? formatDuration(remainingTarget) : session.targetMode === "power" ? `${formatNumber(session.targetPowerKw)} kW` : formatCurrency(remainingTarget)}</strong></div><div><span>Bateria alvo</span><strong>{Math.round(batterySoc)}% → {session.targetSoc}%</strong></div><div><span>Energia até 100%</span><strong>{formatNumber(Math.max(0, session.batteryCapacityKwh * ((session.targetSoc - batterySoc) / 100)))} kWh</strong></div></div></section>
        <StationProtocolPanel messages={protocolMessages} onSimulate={onSimulateProtocol} />
      </div>
      <footer className="station-footer-actions"><button className="station-button station-button--danger" onClick={onFinish}>Encerrar recarga</button><button className="station-button station-button--primary" onClick={onAdvance}><Timer size={20} /> Avançar 15 min <small>controle da demo</small></button></footer>
    </div>
  );
}

function ReceiptStep({ session, onNew, onApp }) {
  const downloadReceipt = () => downloadFile(`recibo-${session.sessionId}.txt`, [`RECIBO CHARGEGRID INTELLIGENCE`, `Sessão: ${session.sessionId}`, `Veículo: ${session.vehicle}`, `Conector: ${session.connectorId} · ${session.connectorType ?? "não informado"}`, `Energia: ${number.format(session.energyKwh)} kWh`, `Duração: ${formatDuration(session.elapsedMinutes)}`, `Tarifa: R$ ${number.format(session.currentTariff)}/kWh`, `Total: ${formatCurrency(session.totalCost)}`, `Motivo: ${session.controlReason}`].join("\n"));
  const completionMessage = {
    battery_full: "A bateria atingiu 100% antes do teto autorizado. Foi cobrada somente a energia entregue.",
    money_target: "A recarga encerrou ao atingir o valor máximo autorizado.",
    spending_cap: "A recarga encerrou ao atingir o teto financeiro opcional.",
    time_target: "A recarga encerrou ao atingir o tempo escolhido.",
    manual: "A recarga foi encerrada manualmente no terminal.",
  }[session.completionReason] ?? "A sessão foi finalizada com segurança.";
  return (
    <div className="station-step-content receipt-step">
      <div className="receipt-success"><span><Check size={38} /></span><StatusPill tone="success">Recarga concluída</StatusPill><h1>Obrigado por carregar com a gente.</h1><p>O cabo já pode ser removido com segurança.</p></div>
      <div className="receipt-card">
        <div className="receipt-card__head"><Brand compact /><span><ReceiptText size={20} /> {session.sessionId}</span></div>
        <div className="receipt-total"><span>Total efetivamente consumido</span><strong>{formatCurrency(session.totalCost)}</strong></div>
        <div className="receipt-grid"><div><span>Energia entregue</span><strong>{formatNumber(session.energyKwh)} kWh</strong></div><div><span>Duração</span><strong>{formatDuration(session.elapsedMinutes)}</strong></div><div><span>Tarifa aplicada</span><strong>{formatCurrency(session.currentTariff)}/kWh</strong></div><div><span>Bateria final</span><strong>{Number.isFinite(session.currentSoc) ? `${Math.round(session.currentSoc)}%` : "—"}</strong></div></div>
        <div className="receipt-completion"><BadgeCheck size={19} /><p><strong>Limite respeitado</strong><span>{completionMessage}</span></p></div>
        <div className="receipt-green"><Leaf size={19} /><p><strong>Energia limpa em movimento</strong><span>Esta sessão utilizou energia de fonte 100% renovável.</span></p></div>
      </div>
      <footer className="station-footer-actions"><button className="station-button station-button--secondary" onClick={downloadReceipt}><Download size={20} /> Baixar recibo</button><button className="station-button station-button--primary" onClick={onNew}>Nova recarga <ArrowRight size={20} /></button></footer>
      <button className="receipt-app-link" onClick={onApp}><Smartphone size={17} /> Acompanhar no Aplicativo ChargeGrid</button>
    </div>
  );
}

function TechnicalDrawer({ core, mutate, onClose }) {
  const [tab, setTab] = useState("summary");
  const metrics = core.metrics();
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="technical-drawer" role="dialog" aria-modal="true" aria-labelledby="technical-title">
        <header><div><span>Painel reservado</span><h2 id="technical-title">Operação técnica</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></header>
        <div className="drawer-tabs"><button className={tab === "summary" ? "is-active" : ""} onClick={() => setTab("summary")}>Resumo</button><button className={tab === "sessions" ? "is-active" : ""} onClick={() => setTab("sessions")}>Sessões</button><button className={tab === "events" ? "is-active" : ""} onClick={() => setTab("events")}>Eventos</button></div>
        <div className="drawer-body">
          {tab === "summary" && <><div className="drawer-metrics"><div><span>Ativas</span><strong>{metrics.activeCount}</strong></div><div><span>Demanda</span><strong>{Math.round(metrics.demandRatio * 100)}%</strong></div><div><span>Liberado</span><strong>{formatNumber(metrics.allocatedKw)} kW</strong></div><div><span>Energia</span><strong>{formatNumber(metrics.energyKwh)} kWh</strong></div></div><div className="drawer-actions"><h3>Controles da demonstração</h3><button onClick={() => mutate((engine) => engine.createAutoScenario(), "Cenário automático preparado.")}><Sparkles size={18} /><span><strong>Cenário automático</strong><small>Cria as quatro sessões da Sprint 2</small></span><ChevronRight size={17} /></button><button onClick={() => mutate((engine) => engine.advanceTime(15), "Simulação avançada em 15 minutos.")}><Timer size={18} /><span><strong>Avançar 15 minutos</strong><small>Atualiza energia, custo e medição</small></span><ChevronRight size={17} /></button><button onClick={() => mutate((engine) => engine.simulateProtocolExchange(), "Troca OCPP/MODBUS simulada.")}><Radio size={18} /><span><strong>Simular protocolos</strong><small>Gera mensagens para sessões ativas</small></span><ChevronRight size={17} /></button><button onClick={() => downloadFile("relatorio-chargegrid.txt", core.generateReport())}><Download size={18} /><span><strong>Exportar relatório</strong><small>Baixar resumo operacional em .txt</small></span><ChevronRight size={17} /></button></div><div className="drawer-disclaimer"><Info size={17} /><p><strong>Ambiente simulado</strong><span>Nenhum comando é enviado a carregadores reais.</span></p></div></>}
          {tab === "sessions" && <div className="drawer-session-list">{core.sessions.length ? [...core.sessions].reverse().map((session) => <article key={session.sessionId}><span className={`drawer-session-icon ${session.status === "Ativa" ? "is-active" : ""}`}><PlugZap size={17} /></span><p><strong>{session.sessionId} · Conector {session.connectorId}</strong><small>{session.vehicle}</small></p><div><strong>{formatNumber(session.energyKwh)} kWh</strong><StatusPill tone={session.status === "Ativa" ? "success" : "neutral"}>{session.status}</StatusPill></div>{session.status === "Ativa" && <button className="icon-button" onClick={() => mutate((engine) => engine.finishSession(session.sessionId), `${session.sessionId} finalizada.`)} aria-label="Finalizar sessão"><X size={17} /></button>}</article>) : <EmptyState title="Nenhuma sessão" description="Inicie uma recarga ou carregue o cenário automático." />}</div>}
          {tab === "events" && <div className="drawer-event-list">{core.logs.slice(-30).reverse().map((log, index) => <div key={log.id}><span className={index === 0 ? "is-current" : ""} /><p>{log.message}<small>{log.time}</small></p></div>)}</div>}
        </div>
      </aside>
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(onClose, 3800);
    return () => window.clearTimeout(timeout);
  }, [onClose, toast]);
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.type}`} role="status">
      <span>{toast.type === "error" ? <X size={18} /> : <Check size={18} />}</span>
      <p><strong>{toast.type === "error" ? "Não foi possível concluir" : "Tudo certo"}</strong><small>{toast.message}</small></p>
      <button onClick={onClose} aria-label="Fechar"><X size={16} /></button>
    </div>
  );
}

export default function App() {
  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = readStoredCore();
  const core = coreRef.current;
  const [, setRevision] = useState(0);
  const [mode, setMode] = useState(() => {
    const preview = new URLSearchParams(window.location.search).get("preview");
    return preview === "app" || preview === "station" ? preview : null;
  });
  const [toast, setToast] = useState(null);

  const persist = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(core.toJSON()));
    } catch {
      // A aplicação continua funcional caso o navegador bloqueie o armazenamento local.
    }
  }, [core]);

  const mutate = useCallback(
    (operation, successMessage = null) => {
      try {
        const result = operation(core);
        persist();
        setRevision((current) => current + 1);
        if (successMessage) setToast({ type: "success", message: successMessage, id: Date.now() });
        return result;
      } catch (error) {
        setToast({ type: "error", message: error.message || "Revise os dados e tente novamente.", id: Date.now() });
        return null;
      }
    },
    [core, persist],
  );

  return (
    <>
      {!mode && <ModeSelector onSelect={setMode} />}
      {mode === "app" && <DashboardApp core={core} mutate={mutate} onExit={() => setMode(null)} />}
      {mode === "station" && (
        <StationTerminal
          core={core}
          mutate={mutate}
          onExit={() => setMode(null)}
          onOpenApp={() => setMode("app")}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
