import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import {
  BadgeDollarSign,
  Ban,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

type Plan = 'trial' | 'pro' | 'negocio' | 'past_due';
type AdminProfile = { title: string; name: string; email: string };
type Metrics = {
  totalAccounts: number;
  activeAccounts: number;
  blockedAccounts: number;
  newAccounts7d: number;
  totalBusinesses: number;
  mrrCents: number;
  trial: number;
  pro: number;
  negocio: number;
  past_due: number;
};
type Account = {
  id: string;
  userId: string;
  email: string;
  name: string;
  status: 'active' | 'blocked';
  createdAt: string;
  lastSeenAt: string;
  blockedReason?: string;
  businessCount: number;
  plans: Plan[];
  isAdmin: boolean;
};
type Business = {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  businessId: string;
  businessName: string;
  businessType?: string;
  businessTypeLabel?: string;
  responsibleName?: string;
  city?: string;
  state?: string;
  teamSize?: number;
  plan: Plan;
  billingStatus?: string;
  createdAt: string;
  updatedAt: string;
  asaasSubscriptionId?: string;
};
type Payment = {
  id: string;
  value: number;
  netValue: number;
  status: string;
  dueDate?: string;
  paymentDate?: string;
  description?: string;
  billingType?: string;
  externalReference?: string;
};
type Subscription = {
  id: string;
  value: number;
  status: string;
  cycle?: string;
  nextDueDate?: string;
  description?: string;
  billingType?: string;
  externalReference?: string;
};
type Finance = {
  configured: boolean;
  payments: Payment[];
  subscriptions: Subscription[];
  summary: {
    receivedCents: number;
    pendingCents: number;
    overdueCents: number;
    receivedCount: number;
    pendingCount: number;
    overdueCount: number;
  };
  totals?: { payments: number; subscriptions: number };
};
type AuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  targetUserId?: string;
  targetBusinessId?: string;
  details?: string;
  at: string;
};
type SegmentMetric = { type: string; label: string; count: number };
type Section = 'overview' | 'accounts' | 'businesses' | 'finance' | 'audit';

const planLabels: Record<Plan, string> = {
  trial: 'Teste',
  pro: 'Pro',
  negocio: 'Negócio',
  past_due: 'Pendente',
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function moneyValue(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}
function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: value.length > 10 ? 'short' : undefined }).format(date);
}

export default function AdminPanel({ profile }: { profile: AdminProfile }) {
  const [section, setSection] = useState<Section>('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [segments, setSegments] = useState<SegmentMetric[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [overviewResult, accountsResult, businessesResult, financeResult, auditResult] = await Promise.all([
        api.get('/api/admin/overview'),
        api.get('/api/admin/accounts'),
        api.get('/api/admin/businesses'),
        api.get('/api/admin/finance'),
        api.get('/api/admin/audit'),
      ]);
      setMetrics(overviewResult.data.metrics as Metrics);
      setSegments((overviewResult.data.segments ?? []) as SegmentMetric[]);
      setAccounts(accountsResult.data.accounts as Account[]);
      setBusinesses(businessesResult.data.businesses as Business[]);
      setFinance(financeResult.data as Finance);
      setAudit(auditResult.data.events as AuditEvent[]);
    } catch {
      setErrorMessage('Não foi possível carregar o painel administrativo. Atualize e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredAccounts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter(item => `${item.name} ${item.email}`.toLowerCase().includes(term));
  }, [accounts, query]);
  const filteredBusinesses = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return businesses;
    return businesses.filter(item => `${item.businessName} ${item.businessTypeLabel ?? ''} ${item.responsibleName ?? ''} ${item.city ?? ''} ${item.state ?? ''} ${item.ownerName} ${item.ownerEmail}`.toLowerCase().includes(term));
  }, [businesses, query]);

  const updateAccount = async (account: Account) => {
    const nextStatus = account.status === 'blocked' ? 'active' : 'blocked';
    let reason = '';
    if (nextStatus === 'blocked') {
      const answer = window.prompt(`Motivo do bloqueio de ${account.name || account.email}:`, 'Acesso suspenso pelo administrador');
      if (answer === null) return;
      reason = answer;
    } else if (!window.confirm(`Liberar novamente a conta de ${account.name || account.email}?`)) {
      return;
    }
    setActionMessage(nextStatus === 'blocked' ? 'Bloqueando conta…' : 'Liberando conta…');
    try {
      await api.put(`/api/admin/accounts/${encodeURIComponent(account.userId)}/status`, { status: nextStatus, reason });
      setActionMessage(nextStatus === 'blocked' ? 'Conta bloqueada. O acesso à nuvem foi interrompido.' : 'Conta liberada com sucesso.');
      await loadAll();
    } catch {
      setActionMessage('Não foi possível alterar o status desta conta.');
    }
  };

  const updatePlan = async (business: Business, plan: Plan) => {
    setActionMessage(`Atualizando ${business.businessName}…`);
    try {
      await api.put(`/api/admin/businesses/${encodeURIComponent(business.ownerUserId)}/${encodeURIComponent(business.businessId)}/plan`, { plan });
      setActionMessage(`Plano de ${business.businessName} alterado para ${planLabels[plan]}.`);
      await loadAll();
    } catch {
      setActionMessage('Não foi possível atualizar o plano.');
    }
  };

  const nav: { id: Section; label: string }[] = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'accounts', label: 'Contas' },
    { id: 'businesses', label: 'Empresas' },
    { id: 'finance', label: 'Asaas' },
    { id: 'audit', label: 'Auditoria' },
  ];

  return (
    <section className="page admin-page">
      <div className="page-head admin-head">
        <div>
          <p className="eyebrow">Área restrita do CEO</p>
          <h1>Painel Administrativo</h1>
          <p>{profile.name} · {profile.email}</p>
        </div>
        <button className="secondary-button compact-button" type="button" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw size={17} />
          {loading ? 'Atualizando…' : 'Atualizar dados'}
        </button>
      </div>

      <div className="admin-security-banner">
        <ShieldCheck size={20} />
        <div><strong>Acesso protegido no servidor</strong><span>Usuários comuns não recebem rotas administrativas, dados globais ou controles de bloqueio.</span></div>
      </div>
      {errorMessage && <div className="sync-alert admin-alert">{errorMessage}</div>}
      {actionMessage && <div className="admin-action-message">{actionMessage}</div>}

      <div className="admin-tabs">
        {nav.map(item => <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); setQuery(''); }}>{item.label}</button>)}
      </div>

      {section === 'overview' && (
        <>
          <div className="admin-metrics-grid">
            <article className="admin-metric"><Users size={20} /><span>Contas</span><strong>{metrics?.totalAccounts ?? 0}</strong><small>{metrics?.activeAccounts ?? 0} ativas · {metrics?.blockedAccounts ?? 0} bloqueadas</small></article>
            <article className="admin-metric"><Building2 size={20} /><span>Empresas</span><strong>{metrics?.totalBusinesses ?? 0}</strong><small>{metrics?.newAccounts7d ?? 0} novas contas em 7 dias</small></article>
            <article className="admin-metric"><CircleDollarSign size={20} /><span>MRR estimado</span><strong>{money(metrics?.mrrCents ?? 0)}</strong><small>Com base nos planos ativos do Giro</small></article>
            <article className="admin-metric"><CheckCircle2 size={20} /><span>Pro</span><strong>{metrics?.pro ?? 0}</strong><small>Empresas no plano Pro</small></article>
            <article className="admin-metric"><BadgeDollarSign size={20} /><span>Negócio</span><strong>{metrics?.negocio ?? 0}</strong><small>Empresas no plano Negócio</small></article>
            <article className="admin-metric warning"><Ban size={20} /><span>Pendências</span><strong>{metrics?.past_due ?? 0}</strong><small>{metrics?.trial ?? 0} em teste</small></article>
          </div>
          <div className="admin-overview-grid">
            <article className="panel-card">
              <div className="section-head"><div><p className="eyebrow">Contas recentes</p><h2>Últimos acessos</h2></div></div>
              <div className="admin-compact-list">{accounts.slice(0, 6).map(account => <div key={account.userId}><span className={`admin-status-dot ${account.status}`} /><div><strong>{account.name}</strong><small>{account.email}</small></div><time>{formatDate(account.lastSeenAt)}</time></div>)}</div>
            </article>
            <article className="panel-card">
              <div className="section-head"><div><p className="eyebrow">Financeiro</p><h2>Asaas agora</h2></div></div>
              {finance?.configured ? <div className="admin-finance-mini"><div><span>Recebido</span><strong>{money(finance.summary.receivedCents)}</strong></div><div><span>Pendente</span><strong>{money(finance.summary.pendingCents)}</strong></div><div><span>Vencido</span><strong className="negative">{money(finance.summary.overdueCents)}</strong></div></div> : <p className="muted-copy">Integração Asaas ainda não disponível para o painel.</p>}
            </article>
            <article className="panel-card admin-segment-card">
              <div className="section-head"><div><p className="eyebrow">Mercado</p><h2>Segmentos</h2></div><span className="soft-badge">{segments.length}</span></div>
              <div className="admin-segment-list">{segments.length ? segments.map(segment => <div key={`${segment.type}-${segment.label}`}><span>{segment.label}</span><strong>{segment.count}</strong></div>) : <p className="muted-copy">Os segmentos aparecerão conforme os negócios forem cadastrados ou atualizados.</p>}</div>
            </article>
          </div>
        </>
      )}

      {section === 'accounts' && (
        <section className="panel-card admin-panel-card">
          <div className="admin-toolbar"><div><p className="eyebrow">Clientes do Giro</p><h2>Contas cadastradas</h2></div><label className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail" /></label></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Conta</th><th>Status</th><th>Empresas</th><th>Planos</th><th>Último acesso</th><th>Ação</th></tr></thead><tbody>{filteredAccounts.map(account => <tr key={account.userId}><td><strong>{account.name}</strong><small>{account.email}</small></td><td><span className={`admin-status ${account.status}`}>{account.isAdmin ? 'CEO / ADM' : account.status === 'active' ? 'Ativa' : 'Bloqueada'}</span>{account.blockedReason && <small>{account.blockedReason}</small>}</td><td>{account.businessCount}</td><td><div className="admin-plan-list">{account.plans.length ? account.plans.map((plan, index) => <span key={`${account.userId}-${plan}-${index}`}>{planLabels[plan]}</span>) : <span>—</span>}</div></td><td>{formatDate(account.lastSeenAt)}</td><td>{account.isAdmin ? <span className="admin-protected">Protegida</span> : <button className={account.status === 'blocked' ? 'small-button primary' : 'small-button danger'} type="button" onClick={() => void updateAccount(account)}>{account.status === 'blocked' ? 'Liberar' : 'Bloquear'}</button>}</td></tr>)}</tbody></table></div>
          {!filteredAccounts.length && <p className="admin-empty">Nenhuma conta encontrada.</p>}
        </section>
      )}

      {section === 'businesses' && (
        <section className="panel-card admin-panel-card">
          <div className="admin-toolbar"><div><p className="eyebrow">Operação</p><h2>Empresas cadastradas</h2></div><label className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar empresa ou proprietário" /></label></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Empresa</th><th>Segmento</th><th>Proprietário</th><th>Plano</th><th>Cobrança</th><th>Atualização</th><th>Assinatura</th></tr></thead><tbody>{filteredBusinesses.map(business => <tr key={`${business.ownerUserId}-${business.businessId}`}><td><strong>{business.businessName}</strong><small>{business.responsibleName ? `Responsável: ${business.responsibleName}` : business.businessId}</small></td><td><strong>{business.businessTypeLabel ?? 'Outro'}</strong><small>{business.city ? `${business.city}${business.state ? `/${business.state}` : ''}` : 'Local não informado'}{business.teamSize ? ` · ${business.teamSize} prof.` : ''}</small></td><td><strong>{business.ownerName}</strong><small>{business.ownerEmail}</small></td><td><select className="admin-plan-select" value={business.plan} onChange={event => void updatePlan(business, event.target.value as Plan)}><option value="trial">Teste</option><option value="pro">Pro</option><option value="negocio">Negócio</option><option value="past_due">Pendente</option></select></td><td><span className={`admin-status ${business.billingStatus === 'active' ? 'active' : business.billingStatus === 'past_due' ? 'blocked' : 'neutral'}`}>{business.billingStatus ?? '—'}</span></td><td>{formatDate(business.updatedAt)}</td><td>{business.asaasSubscriptionId ? <code className="admin-code">{business.asaasSubscriptionId}</code> : '—'}</td></tr>)}</tbody></table></div>
          {!filteredBusinesses.length && <p className="admin-empty">Nenhuma empresa encontrada.</p>}
          <p className="admin-note">A alteração de plano acima muda o acesso no Giro. Assinaturas financeiras do Asaas continuam visíveis na aba Asaas para conferência.</p>
        </section>
      )}

      {section === 'finance' && (
        <div className="admin-finance-stack">
          <div className="admin-metrics-grid finance-metrics">
            <article className="admin-metric"><CircleDollarSign size={20} /><span>Recebido</span><strong>{money(finance?.summary.receivedCents ?? 0)}</strong><small>{finance?.summary.receivedCount ?? 0} pagamento(s)</small></article>
            <article className="admin-metric"><BadgeDollarSign size={20} /><span>Pendente</span><strong>{money(finance?.summary.pendingCents ?? 0)}</strong><small>{finance?.summary.pendingCount ?? 0} pagamento(s)</small></article>
            <article className="admin-metric warning"><Ban size={20} /><span>Vencido</span><strong>{money(finance?.summary.overdueCents ?? 0)}</strong><small>{finance?.summary.overdueCount ?? 0} pagamento(s)</small></article>
          </div>
          {!finance?.configured ? <section className="panel-card"><p className="muted-copy">A integração Asaas não está configurada.</p></section> : <>
            <section className="panel-card admin-panel-card"><div className="section-head"><div><p className="eyebrow">Asaas</p><h2>Assinaturas</h2></div><span className="soft-badge">{finance.totals?.subscriptions ?? finance.subscriptions.length} total</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Assinatura</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Ciclo</th><th>Próximo vencimento</th></tr></thead><tbody>{finance.subscriptions.map(item => <tr key={item.id}><td><code className="admin-code">{item.id}</code></td><td>{item.description ?? 'Giro'}</td><td>{moneyValue(item.value)}</td><td><span className="admin-status neutral">{item.status}</span></td><td>{item.cycle ?? '—'}</td><td>{formatDate(item.nextDueDate)}</td></tr>)}</tbody></table></div></section>
            <section className="panel-card admin-panel-card"><div className="section-head"><div><p className="eyebrow">Asaas</p><h2>Pagamentos recentes</h2></div><span className="soft-badge">{finance.totals?.payments ?? finance.payments.length} total</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pagamento</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th></tr></thead><tbody>{finance.payments.map(item => <tr key={item.id}><td><code className="admin-code">{item.id}</code></td><td>{item.description ?? item.billingType ?? 'Cobrança'}</td><td>{moneyValue(item.value)}</td><td><span className={`admin-status ${item.status === 'RECEIVED' || item.status === 'CONFIRMED' ? 'active' : item.status === 'OVERDUE' ? 'blocked' : 'neutral'}`}>{item.status}</span></td><td>{formatDate(item.dueDate)}</td><td>{formatDate(item.paymentDate)}</td></tr>)}</tbody></table></div></section>
          </>}
        </div>
      )}

      {section === 'audit' && (
        <section className="panel-card admin-panel-card">
          <div className="section-head"><div><p className="eyebrow">Segurança</p><h2>Atividade administrativa</h2></div><span className="soft-badge">Últimos {audit.length}</span></div>
          <div className="admin-audit-list">{audit.map(event => <article key={event.id}><span className="admin-audit-icon"><ShieldCheck size={16} /></span><div><strong>{event.action}</strong><p>{event.details ?? 'Ação administrativa registrada.'}</p><small>{event.actorEmail}{event.targetUserId ? ` · usuário ${event.targetUserId}` : ''}{event.targetBusinessId ? ` · negócio ${event.targetBusinessId}` : ''}</small></div><time>{formatDate(event.at)}</time></article>)}</div>
          {!audit.length && <p className="admin-empty">Nenhuma ação administrativa registrada ainda.</p>}
        </section>
      )}
    </section>
  );
}