import { createHash, randomBytes } from 'node:crypto';
import {
  db,
  error,
  json,
  requireAdminEmailAllowlist,
  requireAuth,
  router,
  secrets,
  type AuthUser,
  type RouterMiddleware,
} from '@appdeploy/sdk';

type Plan = 'trial' | 'pro' | 'negocio' | 'past_due';
type AccountStatus = 'active' | 'blocked';
type BusinessRecord = {
  state: Record<string, unknown>;
  plan: Plan;
  desiredPlan?: 'pro' | 'negocio';
  billingStatus?: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  lastAutoBackupAt?: string;
};
type BackupRecord = {
  businessId: string;
  state: Record<string, unknown>;
  createdAt: string;
  kind: 'auto' | 'manual';
};
type BillingBody = { businessId?: string; plan?: string; name?: string; cpfCnpj?: string; email?: string };
type AsaasList<T> = { data?: T[]; totalCount?: number; hasMore?: boolean };
type AsaasCustomer = { id: string };
type AsaasSubscription = {
  id: string;
  customer?: string;
  value?: number;
  cycle?: string;
  status?: string;
  billingType?: string;
  nextDueDate?: string;
  description?: string;
  externalReference?: string;
};
type AsaasPayment = {
  id: string;
  customer?: string;
  subscription?: string;
  billingType?: string;
  value?: number;
  netValue?: number;
  status?: string;
  dueDate?: string;
  paymentDate?: string;
  description?: string;
  externalReference?: string;
};
type AsaasPix = { payload?: string; encodedImage?: string; expirationDate?: string };
type WebhookAuthRecord = { tokenHash: string; webhookId: string; url: string; updatedAt: string };
type AccountRecord = {
  userId: string;
  email: string;
  name: string;
  status: AccountStatus;
  createdAt: string;
  lastSeenAt: string;
  blockedAt?: string;
  blockedReason?: string;
};
type AccessRecord = {
  status: AccountStatus;
  updatedAt: string;
  blockedAt?: string;
  blockedReason?: string;
};
type BusinessIndexRecord = {
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  businessId: string;
  businessName: string;
  businessType: string;
  businessTypeLabel: string;
  responsibleName?: string;
  city?: string;
  state?: string;
  teamSize?: number;
  plan: Plan;
  billingStatus?: string;
  createdAt: string;
  updatedAt: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
};
type AuditRecord = {
  actorEmail: string;
  action: string;
  targetUserId?: string;
  targetBusinessId?: string;
  details?: string;
  at: string;
};

const businessTable = (userId: string) => `giro-businesses:${userId}`;
const backupTable = (userId: string) => `giro-backups:${userId}`;
const accountRefTable = (userId: string) => `giro-account-ref:${userId}`;
const accessTable = (userId: string) => `giro-access:${userId}`;
const businessIndexRefTable = (userId: string, businessId: string) => `giro-business-index-ref:${userId}:${businessId}`;
const ACCOUNTS_TABLE = 'giro-accounts';
const BUSINESS_INDEX_TABLE = 'giro-business-index';
const ADMIN_AUDIT_TABLE = 'giro-admin-audit';
const WEBHOOK_AUTH_TABLE = 'giro-asaas-webhook-auth';
const DAY = 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL = 15 * 60 * 1000;
const prices = { pro: 39.9, negocio: 79.9 } as const;
const ADMIN_EMAILS = ['silvafalcaolins@gmail.com'];
const CEO_NAME = 'Carlos Alisson Silva Falcão Lins';

function isAdminEmail(email?: string) {
  return ADMIN_EMAILS.includes((email ?? '').toLowerCase());
}
const BUSINESS_TYPE_LABELS: Record<string, string> = { salao: 'Salão de beleza', barbearia: 'Barbearia', estetica: 'Estética', manicure: 'Manicure / Pedicure', spa: 'Spa / Bem-estar', clinica: 'Clínica / Consultório', oficina: 'Oficina automotiva', assistencia: 'Assistência técnica', atelie: 'Ateliê / Costura / Personalização', pet_shop: 'Pet shop / Banho e tosa', fotografia: 'Fotografia / Produção', servicos_residenciais: 'Serviços residenciais / Manutenção', academia: 'Academia / Personal', alimentacao: 'Alimentação / Encomendas', outro: 'Outro' };
function businessName(record: BusinessRecord) {
  const state = record.state as { business?: { name?: string } };
  return state.business?.name?.trim() || 'Negócio';
}
function businessProfile(record: BusinessRecord) {
  const state = record.state as { business?: { type?: string; customType?: string; responsibleName?: string; city?: string; state?: string; teamSize?: number } };
  const business = state.business ?? {};
  const businessType = business.type?.trim() || 'outro';
  const customType = business.customType?.trim();
  return {
    businessType,
    businessTypeLabel: businessType === 'outro' && customType ? customType : BUSINESS_TYPE_LABELS[businessType] ?? customType ?? 'Outro',
    responsibleName: business.responsibleName?.trim() || undefined,
    city: business.city?.trim() || undefined,
    state: business.state?.trim().toUpperCase() || undefined,
    teamSize: Number.isFinite(business.teamSize) && Number(business.teamSize) > 0 ? Math.round(Number(business.teamSize)) : undefined,
  };
}
async function readBusiness(userId: string, id: string) {
  const [record] = await db.get<BusinessRecord>(businessTable(userId), [id]);
  return record;
}
async function readAccess(userId: string) {
  const { items } = await db.list<AccessRecord>(accessTable(userId), { limit: 1 });
  return items[0];
}
async function ensureAccess(userId: string) {
  const current = await readAccess(userId);
  if (current) return current;
  const record: AccessRecord = { status: 'active', updatedAt: new Date().toISOString() };
  await db.add(accessTable(userId), [record]);
  return { id: '', ...record };
}
async function writeAccess(userId: string, status: AccountStatus, reason?: string) {
  const current = await readAccess(userId);
  const now = new Date().toISOString();
  const record: AccessRecord = {
    status,
    updatedAt: now,
    blockedAt: status === 'blocked' ? now : undefined,
    blockedReason: status === 'blocked' ? reason?.trim().slice(0, 240) || 'Bloqueado pelo administrador' : undefined,
  };
  if (current?.id) {
    const [ok] = await db.update(accessTable(userId), [{ id: current.id, record }]);
    if (!ok) throw new Error('access_update_failed');
  } else {
    const [id] = await db.add(accessTable(userId), [record]);
    if (!id) throw new Error('access_create_failed');
  }
  return record;
}
async function readAccountRef(userId: string) {
  const { items } = await db.list<{ indexId: string }>(accountRefTable(userId), { limit: 1 });
  return items[0];
}
async function readGlobalAccount(userId: string) {
  const ref = await readAccountRef(userId);
  if (!ref?.indexId) return null;
  const [record] = await db.get<AccountRecord>(ACCOUNTS_TABLE, [ref.indexId]);
  return record ? { id: ref.indexId, ...record } : null;
}
async function touchAccount(user: AuthUser) {
  const now = new Date().toISOString();
  const access = await ensureAccess(user.userId);
  const ref = await readAccountRef(user.userId);
  const nextBase: AccountRecord = {
    userId: user.userId,
    email: user.email ?? '',
    name: user.name ?? user.email ?? 'Usuário Giro',
    status: access.status,
    createdAt: now,
    lastSeenAt: now,
    blockedAt: access.blockedAt,
    blockedReason: access.blockedReason,
  };
  if (!ref?.indexId) {
    const [indexId] = await db.add(ACCOUNTS_TABLE, [nextBase]);
    if (!indexId) throw new Error('account_index_create_failed');
    await db.add(accountRefTable(user.userId), [{ indexId }]);
    return { id: indexId, ...nextBase };
  }
  const [current] = await db.get<AccountRecord>(ACCOUNTS_TABLE, [ref.indexId]);
  if (!current) return null;
  const stale = Date.now() - new Date(current.lastSeenAt).getTime() > TOUCH_INTERVAL;
  const changed = current.email !== nextBase.email || current.name !== nextBase.name || current.status !== access.status || current.blockedReason !== access.blockedReason;
  if (stale || changed) {
    const next: AccountRecord = { ...current, ...nextBase, createdAt: current.createdAt };
    await db.update(ACCOUNTS_TABLE, [{ id: ref.indexId, record: next }]);
    return { id: ref.indexId, ...next };
  }
  return { id: ref.indexId, ...current };
}
function accountGuard(): RouterMiddleware {
  return async ctx => {
    if (!ctx.user) return error('unauthorized', 401);
    await touchAccount(ctx.user);
    if (isAdminEmail(ctx.user.email)) return;
    const access = await ensureAccess(ctx.user.userId);
    if (access.status === 'blocked') return error('account_blocked', 403);
  };
}
async function readBusinessIndexRef(userId: string, businessId: string) {
  const { items } = await db.list<{ indexId: string }>(businessIndexRefTable(userId, businessId), { limit: 1 });
  return items[0];
}
async function ensureBusinessIndex(owner: Pick<AuthUser, 'userId' | 'email' | 'name'>, businessId: string, record: BusinessRecord) {
  const ref = await readBusinessIndexRef(owner.userId, businessId);
  const profile = businessProfile(record);
  const next: BusinessIndexRecord = {
    ownerUserId: owner.userId,
    ownerEmail: owner.email ?? '',
    ownerName: owner.name ?? owner.email ?? 'Usuário Giro',
    businessId,
    businessName: businessName(record),
    ...profile,
    plan: record.plan,
    billingStatus: record.billingStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    asaasCustomerId: record.asaasCustomerId,
    asaasSubscriptionId: record.asaasSubscriptionId,
  };
  if (!ref?.indexId) {
    const [indexId] = await db.add(BUSINESS_INDEX_TABLE, [next]);
    if (!indexId) throw new Error('business_index_create_failed');
    await db.add(businessIndexRefTable(owner.userId, businessId), [{ indexId }]);
    return;
  }
  const [current] = await db.get<BusinessIndexRecord>(BUSINESS_INDEX_TABLE, [ref.indexId]);
  if (!current || current.updatedAt !== next.updatedAt || current.plan !== next.plan || current.billingStatus !== next.billingStatus || current.businessName !== next.businessName || current.businessType !== next.businessType || current.businessTypeLabel !== next.businessTypeLabel || current.responsibleName !== next.responsibleName || current.city !== next.city || current.state !== next.state || current.teamSize !== next.teamSize || current.ownerEmail !== next.ownerEmail) {
    await db.update(BUSINESS_INDEX_TABLE, [{ id: ref.indexId, record: next }]);
  }
}
async function ensureBusinessIndexByUserId(userId: string, businessId: string, record: BusinessRecord) {
  const account = await readGlobalAccount(userId);
  await ensureBusinessIndex({ userId, email: account?.email, name: account?.name }, businessId, record);
}
async function removeBusinessIndex(userId: string, businessId: string) {
  const ref = await readBusinessIndexRef(userId, businessId);
  if (!ref?.indexId) return;
  await db.delete(BUSINESS_INDEX_TABLE, [ref.indexId]);
  if (ref.id) await db.delete(businessIndexRefTable(userId, businessId), [ref.id]);
}
async function audit(actorEmail: string, action: string, targetUserId?: string, targetBusinessId?: string, details?: string) {
  const record: AuditRecord = { actorEmail, action, targetUserId, targetBusinessId, details: details?.slice(0, 500), at: new Date().toISOString() };
  await db.add(ADMIN_AUDIT_TABLE, [record]);
}
async function updateGlobalAccountStatus(userId: string, access: AccessRecord) {
  const ref = await readAccountRef(userId);
  if (!ref?.indexId) return null;
  const [current] = await db.get<AccountRecord>(ACCOUNTS_TABLE, [ref.indexId]);
  if (!current) return null;
  const next: AccountRecord = {
    ...current,
    status: access.status,
    blockedAt: access.blockedAt,
    blockedReason: access.blockedReason,
  };
  await db.update(ACCOUNTS_TABLE, [{ id: ref.indexId, record: next }]);
  return { id: ref.indexId, ...next };
}
async function asaasConfig() {
  const names = await secrets.listSecretNames();
  if (!names.includes('ASAAS_API_KEY')) return null;
  const key = await secrets.readSecret('ASAAS_API_KEY');
  const base = key.startsWith('$aact_prod_') ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  return { key, base };
}
function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
async function readWebhookAuth() {
  const { items } = await db.list<WebhookAuthRecord>(WEBHOOK_AUTH_TABLE, { limit: 1 });
  return items[0];
}
async function saveWebhookAuth(record: WebhookAuthRecord) {
  const current = await readWebhookAuth();
  if (current) {
    const [ok] = await db.update(WEBHOOK_AUTH_TABLE, [{ id: current.id, record }]);
    if (!ok) throw new Error('webhook_auth_update_failed');
    return current.id;
  }
  const [id] = await db.add(WEBHOOK_AUTH_TABLE, [record]);
  if (!id) throw new Error('webhook_auth_create_failed');
  return id;
}
async function asaasRequest(path: string, init?: RequestInit) {
  const config = await asaasConfig();
  if (!config) throw new Error('asaas_not_configured');
  const response = await fetch(`${config.base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Giro/3.0',
      access_token: config.key,
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`asaas_${response.status}:${JSON.stringify(data)}`);
  return data as Record<string, unknown>;
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/admin/me': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ctx => json({ role: 'ceo_admin', title: 'CEO • Administrador', name: CEO_NAME, developer: CEO_NAME, email: ctx.user!.email }),
  ],

  'GET /api/admin/overview': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      const [{ items: accounts }, { items: businesses }] = await Promise.all([
        db.list<AccountRecord>(ACCOUNTS_TABLE, { limit: 200 }),
        db.list<BusinessIndexRecord>(BUSINESS_INDEX_TABLE, { limit: 500 }),
      ]);
      const activeAccounts = accounts.filter(item => item.status === 'active').length;
      const blockedAccounts = accounts.filter(item => item.status === 'blocked').length;
      const newAccounts7d = accounts.filter(item => Date.now() - new Date(item.createdAt).getTime() <= 7 * DAY).length;
      const planCounts = { trial: 0, pro: 0, negocio: 0, past_due: 0 };
      let mrrCents = 0;
      const segmentMap = new Map<string, { type: string; label: string; count: number }>();
      for (const item of businesses) {
        planCounts[item.plan] += 1;
        if (item.plan === 'pro') mrrCents += 3990;
        if (item.plan === 'negocio') mrrCents += 7990;
        const type = item.businessType || 'outro';
        const label = item.businessTypeLabel || BUSINESS_TYPE_LABELS[type] || 'Outro';
        const key = `${type}:${label}`;
        const current = segmentMap.get(key);
        segmentMap.set(key, { type, label, count: (current?.count ?? 0) + 1 });
      }
      const segments = Array.from(segmentMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
      return json({
        metrics: {
          totalAccounts: accounts.length,
          activeAccounts,
          blockedAccounts,
          newAccounts7d,
          totalBusinesses: businesses.length,
          mrrCents,
          ...planCounts,
        },
        segments,
      });
    },
  ],

  'GET /api/admin/accounts': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      const [{ items: accounts }, { items: businesses }] = await Promise.all([
        db.list<AccountRecord>(ACCOUNTS_TABLE, { limit: 200 }),
        db.list<BusinessIndexRecord>(BUSINESS_INDEX_TABLE, { limit: 500 }),
      ]);
      const result = accounts.map(account => {
        const owned = businesses.filter(item => item.ownerUserId === account.userId);
        return {
          ...account,
          businessCount: owned.length,
          plans: owned.map(item => item.plan),
          isAdmin: isAdminEmail(account.email),
        };
      }).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
      return json({ accounts: result });
    },
  ],

  'PUT /api/admin/accounts/:userId/status': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ctx => {
      const body = ctx.body as { status?: AccountStatus; reason?: string };
      if (body.status !== 'active' && body.status !== 'blocked') return error('invalid_status', 400);
      const account = await readGlobalAccount(ctx.params.userId);
      if (!account) return error('account_not_found', 404);
      if (isAdminEmail(account.email) && body.status === 'blocked') return error('cannot_block_ceo', 400);
      const access = await writeAccess(ctx.params.userId, body.status, body.reason);
      const updated = await updateGlobalAccountStatus(ctx.params.userId, access);
      await audit(ctx.user!.email ?? 'admin', body.status === 'blocked' ? 'account_blocked' : 'account_unblocked', ctx.params.userId, undefined, body.reason);
      return json({ account: updated });
    },
  ],

  'GET /api/admin/businesses': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      const { items } = await db.list<BusinessIndexRecord>(BUSINESS_INDEX_TABLE, { limit: 500 });
      return json({ businesses: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    },
  ],

  'PUT /api/admin/businesses/:ownerUserId/:businessId/plan': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ctx => {
      const body = ctx.body as { plan?: Plan };
      if (!body.plan || !['trial', 'pro', 'negocio', 'past_due'].includes(body.plan)) return error('invalid_plan', 400);
      const existing = await readBusiness(ctx.params.ownerUserId, ctx.params.businessId);
      if (!existing) return error('business_not_found', 404);
      const now = new Date().toISOString();
      const billingStatus = body.plan === 'trial' ? 'trial' : body.plan === 'past_due' ? 'past_due' : 'active';
      const next: BusinessRecord = {
        ...existing,
        plan: body.plan,
        billingStatus,
        desiredPlan: body.plan === 'pro' || body.plan === 'negocio' ? body.plan : existing.desiredPlan,
        updatedAt: now,
      };
      const [ok] = await db.update(businessTable(ctx.params.ownerUserId), [{ id: ctx.params.businessId, record: next }]);
      if (!ok) return error('plan_update_failed', 500);
      await ensureBusinessIndexByUserId(ctx.params.ownerUserId, ctx.params.businessId, next);
      await audit(ctx.user!.email ?? 'admin', 'plan_changed', ctx.params.ownerUserId, ctx.params.businessId, `Plano alterado para ${body.plan}`);
      return json({ business: { id: ctx.params.businessId, ...next } });
    },
  ],

  'GET /api/admin/finance': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      const config = await asaasConfig();
      if (!config) return json({ configured: false, payments: [], subscriptions: [], summary: { receivedCents: 0, pendingCents: 0, overdueCents: 0, receivedCount: 0, pendingCount: 0, overdueCount: 0 } });
      const [paymentRaw, subscriptionRaw] = await Promise.all([
        asaasRequest('/payments?offset=0&limit=100'),
        asaasRequest('/subscriptions?offset=0&limit=100'),
      ]);
      const paymentList = paymentRaw as AsaasList<AsaasPayment>;
      const subscriptionList = subscriptionRaw as AsaasList<AsaasSubscription>;
      const payments = (paymentList.data ?? []).map(item => ({
        id: item.id,
        customer: item.customer,
        subscription: item.subscription,
        billingType: item.billingType,
        value: item.value ?? 0,
        netValue: item.netValue ?? 0,
        status: item.status ?? 'UNKNOWN',
        dueDate: item.dueDate,
        paymentDate: item.paymentDate,
        description: item.description,
        externalReference: item.externalReference,
      }));
      const subscriptions = (subscriptionList.data ?? []).map(item => ({
        id: item.id,
        customer: item.customer,
        value: item.value ?? 0,
        cycle: item.cycle,
        status: item.status ?? 'UNKNOWN',
        billingType: item.billingType,
        nextDueDate: item.nextDueDate,
        description: item.description,
        externalReference: item.externalReference,
      }));
      let receivedCents = 0;
      let pendingCents = 0;
      let overdueCents = 0;
      let receivedCount = 0;
      let pendingCount = 0;
      let overdueCount = 0;
      for (const payment of payments) {
        const cents = Math.round(payment.value * 100);
        if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
          receivedCents += cents;
          receivedCount += 1;
        } else if (payment.status === 'OVERDUE') {
          overdueCents += cents;
          overdueCount += 1;
        } else if (!['REFUNDED', 'DELETED'].includes(payment.status)) {
          pendingCents += cents;
          pendingCount += 1;
        }
      }
      return json({
        configured: true,
        payments,
        subscriptions,
        summary: { receivedCents, pendingCents, overdueCents, receivedCount, pendingCount, overdueCount },
        totals: { payments: paymentList.totalCount ?? payments.length, subscriptions: subscriptionList.totalCount ?? subscriptions.length },
      });
    },
  ],

  'GET /api/admin/audit': [
    requireAuth(),
    accountGuard(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      const { items } = await db.list<AuditRecord>(ADMIN_AUDIT_TABLE, { limit: 100 });
      return json({ events: items.sort((a, b) => b.at.localeCompare(a.at)) });
    },
  ],

  'GET /api/businesses': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const { items } = await db.list<BusinessRecord>(businessTable(ctx.user!.userId), { limit: 20 });
      await Promise.all(items.map(item => ensureBusinessIndex(ctx.user!, item.id, item)));
      return json({ businesses: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    },
  ],

  'POST /api/businesses': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const body = ctx.body as { state?: Record<string, unknown> };
      if (!body.state) return error('state_required', 400);
      const now = new Date().toISOString();
      const record: BusinessRecord = { state: body.state, plan: 'trial', billingStatus: 'trial', createdAt: now, updatedAt: now };
      const [id] = await db.add(businessTable(ctx.user!.userId), [record]);
      if (!id) return error('create_failed', 500);
      await ensureBusinessIndex(ctx.user!, id, record);
      return json({ business: { id, ...record } }, 201);
    },
  ],

  'PUT /api/businesses/:id': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const existing = await readBusiness(ctx.user!.userId, ctx.params.id);
      if (!existing) return error('not_found', 404);
      const body = ctx.body as { state?: Record<string, unknown> };
      if (!body.state) return error('state_required', 400);
      const now = new Date().toISOString();
      const last = existing.lastAutoBackupAt ? new Date(existing.lastAutoBackupAt).getTime() : 0;
      let lastAutoBackupAt = existing.lastAutoBackupAt;
      if (Date.now() - last > DAY) {
        await db.add(backupTable(ctx.user!.userId), [{ businessId: ctx.params.id, state: existing.state, createdAt: now, kind: 'auto' } satisfies BackupRecord]);
        lastAutoBackupAt = now;
      }
      const next: BusinessRecord = { ...existing, state: body.state, updatedAt: now, lastAutoBackupAt };
      const [ok] = await db.update(businessTable(ctx.user!.userId), [{ id: ctx.params.id, record: next }]);
      if (!ok) return error('update_failed', 500);
      await ensureBusinessIndex(ctx.user!, ctx.params.id, next);
      return json({ business: { id: ctx.params.id, ...next } });
    },
  ],

  'DELETE /api/businesses/:id': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const existing = await readBusiness(ctx.user!.userId, ctx.params.id);
      if (!existing) return error('not_found', 404);
      const [ok] = await db.delete(businessTable(ctx.user!.userId), [ctx.params.id]);
      if (!ok) return error('delete_failed', 500);
      await removeBusinessIndex(ctx.user!.userId, ctx.params.id);
      return json({ deleted: true });
    },
  ],

  'POST /api/businesses/:id/backups': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const existing = await readBusiness(ctx.user!.userId, ctx.params.id);
      if (!existing) return error('not_found', 404);
      const backup: BackupRecord = { businessId: ctx.params.id, state: existing.state, createdAt: new Date().toISOString(), kind: 'manual' };
      const [id] = await db.add(backupTable(ctx.user!.userId), [backup]);
      return id ? json({ backup: { id, ...backup } }, 201) : error('backup_failed', 500);
    },
  ],

  'GET /api/businesses/:id/backups': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const existing = await readBusiness(ctx.user!.userId, ctx.params.id);
      if (!existing) return error('not_found', 404);
      const { items } = await db.list<BackupRecord>(backupTable(ctx.user!.userId), { limit: 30, filter: { businessId: ctx.params.id } });
      return json({ backups: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10) });
    },
  ],

  'POST /api/businesses/:id/restore': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const body = ctx.body as { backupId?: string };
      if (!body.backupId) return error('backup_id_required', 400);
      const existing = await readBusiness(ctx.user!.userId, ctx.params.id);
      if (!existing) return error('not_found', 404);
      const [backup] = await db.get<BackupRecord>(backupTable(ctx.user!.userId), [body.backupId]);
      if (!backup || backup.businessId !== ctx.params.id) return error('backup_not_found', 404);
      const next: BusinessRecord = { ...existing, state: backup.state, updatedAt: new Date().toISOString() };
      const [ok] = await db.update(businessTable(ctx.user!.userId), [{ id: ctx.params.id, record: next }]);
      if (!ok) return error('restore_failed', 500);
      await ensureBusinessIndex(ctx.user!, ctx.params.id, next);
      return json({ business: { id: ctx.params.id, ...next } });
    },
  ],

  'GET /api/integrations/status': [
    requireAuth(),
    accountGuard(),
    async () => {
      const names = await secrets.listSecretNames();
      const webhook = await readWebhookAuth();
      return json({ asaasApi: names.includes('ASAAS_API_KEY'), asaasWebhook: Boolean(webhook?.webhookId && webhook?.tokenHash) });
    },
  ],

  'POST /api/integrations/asaas/webhook': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const body = ctx.body as { origin?: string };
      if (!body.origin || !/^https:\/\/[^/]+/i.test(body.origin)) return error('invalid_origin', 400);
      if (!ctx.user!.email) return error('email_scope_required', 400);
      const names = await secrets.listSecretNames();
      if (!names.includes('ASAAS_API_KEY')) return error('asaas_not_configured', 503);
      const authToken = `giro_wh_${randomBytes(36).toString('base64url')}`;
      const url = `${body.origin.replace(/\/$/, '')}/api/webhooks/asaas`;
      const events = ['PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED'];
      const listed = await asaasRequest('/webhooks?offset=0&limit=100') as AsaasList<{ id: string; url?: string; name?: string }>;
      const existing = listed.data?.find(item => item.url === url || item.name === 'Giro pagamentos');
      let webhookId = existing?.id ?? '';
      if (existing?.id) {
        await asaasRequest(`/webhooks/${encodeURIComponent(existing.id)}`, { method: 'PUT', body: JSON.stringify({ name: 'Giro pagamentos', url, email: ctx.user!.email, enabled: true, interrupted: false, apiVersion: 3, authToken, sendType: 'SEQUENTIALLY', events }) });
      } else {
        const created = await asaasRequest('/webhooks', { method: 'POST', body: JSON.stringify({ name: 'Giro pagamentos', url, email: ctx.user!.email, enabled: true, interrupted: false, apiVersion: 3, authToken, sendType: 'SEQUENTIALLY', events }) }) as { id?: string };
        webhookId = created.id ?? '';
      }
      if (!webhookId) return error('asaas_webhook_failed', 502);
      await saveWebhookAuth({ tokenHash: sha256(authToken), webhookId, url, updatedAt: new Date().toISOString() });
      return json({ message: existing?.id ? 'Confirmação automática revalidada no Asaas.' : 'Confirmação automática ativada no Asaas.', webhookId, url });
    },
  ],

  'POST /api/billing/subscribe': [
    requireAuth(),
    accountGuard(),
    async ctx => {
      const body = ctx.body as BillingBody;
      if (!body.businessId || (body.plan !== 'pro' && body.plan !== 'negocio') || !body.name || !body.cpfCnpj || !body.email) return error('invalid_billing_data', 400);
      const business = await readBusiness(ctx.user!.userId, body.businessId);
      if (!business) return error('business_not_found', 404);
      const config = await asaasConfig();
      if (!config) return error('asaas_not_configured', 503);
      const reference = `giro:${ctx.user!.userId}`;
      const listed = await asaasRequest(`/customers?externalReference=${encodeURIComponent(reference)}&limit=1`) as AsaasList<AsaasCustomer>;
      let customerId = listed.data?.[0]?.id;
      if (!customerId) {
        const created = await asaasRequest('/customers', { method: 'POST', body: JSON.stringify({ name: body.name, cpfCnpj: body.cpfCnpj.replace(/\D/g, ''), email: body.email, externalReference: reference, notificationDisabled: false }) }) as unknown as AsaasCustomer;
        customerId = created.id;
      }
      if (!customerId) return error('asaas_customer_failed', 502);
      const subscription = await asaasRequest('/subscriptions', { method: 'POST', body: JSON.stringify({ customer: customerId, billingType: 'PIX', value: prices[body.plan], nextDueDate: new Date().toISOString().slice(0, 10), cycle: 'MONTHLY', description: `Giro ${body.plan === 'pro' ? 'Pro' : 'Negócio'}`, externalReference: `giro:${ctx.user!.userId}:${body.businessId}:${body.plan}` }) }) as unknown as AsaasSubscription;
      if (!subscription.id) return error('asaas_subscription_failed', 502);
      await db.add(`giro-billing:${subscription.id}`, [{ userId: ctx.user!.userId, businessId: body.businessId }]);
      const payments = await asaasRequest(`/subscriptions/${encodeURIComponent(subscription.id)}/payments`) as AsaasList<AsaasPayment>;
      const paymentId = payments.data?.[0]?.id;
      let pix: AsaasPix = {};
      if (paymentId) pix = await asaasRequest(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`) as unknown as AsaasPix;
      const next: BusinessRecord = { ...business, desiredPlan: body.plan, plan: 'past_due', billingStatus: 'awaiting_payment', asaasCustomerId: customerId, asaasSubscriptionId: subscription.id, updatedAt: new Date().toISOString() };
      await db.update(businessTable(ctx.user!.userId), [{ id: body.businessId, record: next }]);
      await ensureBusinessIndex(ctx.user!, body.businessId, next);
      return json({ message: pix.payload ? 'Assinatura criada. Pague o primeiro Pix para ativar o plano.' : 'Assinatura criada. A cobrança Pix será gerada pelo Asaas.', payload: pix.payload, expirationDate: pix.expirationDate, subscriptionId: subscription.id });
    },
  ],

  'POST /api/webhooks/asaas': [
    async ctx => {
      const webhook = await readWebhookAuth();
      if (!webhook) return error('webhook_not_configured', 503);
      const headers = (ctx.event.headers ?? {}) as Record<string, string | undefined>;
      const received = headers['asaas-access-token'] ?? headers['Asaas-Access-Token'];
      if (!received || sha256(received) !== webhook.tokenHash) return error('unauthorized', 401);
      const body = ctx.body as { id?: string; event?: string; payment?: { subscription?: string } };
      if (!body.id) return error('event_id_required', 400);
      const { items: seen } = await db.list(`giro-asaas-event:${body.id}`, { limit: 1 });
      if (seen.length) return json({ ok: true, duplicate: true });
      await db.add(`giro-asaas-event:${body.id}`, [{ receivedAt: new Date().toISOString() }]);
      const subscriptionId = body.payment?.subscription;
      if (!subscriptionId) return json({ ok: true });
      const { items: links } = await db.list<{ userId: string; businessId: string }>(`giro-billing:${subscriptionId}`, { limit: 1 });
      const link = links[0];
      if (!link) return json({ ok: true });
      const business = await readBusiness(link.userId, link.businessId);
      if (!business) return json({ ok: true });
      const success = body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED';
      const overdue = body.event === 'PAYMENT_OVERDUE' || body.event === 'PAYMENT_REFUNDED';
      if (success || overdue) {
        const next: BusinessRecord = { ...business, plan: success ? business.desiredPlan ?? 'pro' : 'past_due', billingStatus: success ? 'active' : 'past_due', updatedAt: new Date().toISOString() };
        await db.update(businessTable(link.userId), [{ id: link.businessId, record: next }]);
        await ensureBusinessIndexByUserId(link.userId, link.businessId, next);
      }
      return json({ ok: true });
    },
  ],
});