import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, auth, type AuthUser } from '@appdeploy/client';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cloud,
  Copy,
  Download,
  Eraser,
  Home,
  Link2,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import AdminPanel from './AdminPanel';
import BusinessSetupForm from './BusinessSetupForm';
import { businessTypeOptions, defaultBusinessSlogan, suggestedServices, type BusinessSetupValue, type BusinessType } from './businessProfiles';
import './giro.css';

type Tab = 'hoje' | 'agenda' | 'caixa' | 'clientes' | 'ordens' | 'equipe' | 'integracoes' | 'admin';
type AppointmentStatus = 'agendado' | 'concluido' | 'cancelado' | 'faltou';
type OrderStatus = 'orcamento' | 'andamento' | 'pronto' | 'entregue';
type CashType = 'entrada' | 'saida';
type Plan = 'trial' | 'pro' | 'negocio' | 'past_due';

type Client = { id: string; name: string; phone: string; notes: string };
type Service = { id: string; name: string; minutes: number; priceCents: number };
type Professional = { id: string; name: string; phone: string; active: boolean };
type Appointment = {
  id: string;
  clientId: string;
  serviceId: string;
  professionalId?: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  note: string;
};
type CashEntry = {
  id: string;
  type: CashType;
  valueCents: number;
  at: string;
  description: string;
  appointmentId?: string;
};
type Order = {
  id: string;
  clientId: string;
  title: string;
  details: string;
  status: OrderStatus;
  valueCents: number;
};
type GiroState = {
  version: 2;
  business: {
    name: string;
    slogan: string;
    type: BusinessType;
    customType?: string;
    responsibleName?: string;
    phone?: string;
    city?: string;
    state?: string;
    teamSize?: number;
    pixKey?: string;
    pixMerchant?: string;
    pixCity?: string;
  };
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  appointments: Appointment[];
  cash: CashEntry[];
  orders: Order[];
};
type LegacyState = Omit<GiroState, 'version' | 'professionals'> & {
  version?: number;
  professionals?: Professional[];
};
type CloudBusiness = {
  id: string;
  state: GiroState;
  plan: Plan;
  desiredPlan?: 'pro' | 'negocio';
  billingStatus?: string;
  updatedAt: string;
};
type Backup = { id: string; businessId: string; state: GiroState; createdAt: string; kind: string };
type AdminProfile = { role: 'ceo_admin'; title: string; name: string; developer: string; email: string };
type ModalName = 'schedule' | 'cash' | 'client' | 'service' | 'order' | 'professional' | 'settings' | 'newBusiness' | null;

const LOCAL_KEY = 'giro-v2';
const LEGACY_KEY = 'giro-v1';
const CEO_EMAIL = 'silvafalcaolins@gmail.com';
const DEVELOPER_NAME = 'Carlos Alisson Silva Falcão Lins';
const orderStatuses: OrderStatus[] = ['orcamento', 'andamento', 'pronto', 'entregue'];
const orderLabels: Record<OrderStatus, string> = {
  orcamento: 'Orçamento',
  andamento: 'Em andamento',
  pronto: 'Pronto',
  entregue: 'Entregue',
};
const planLabels: Record<Plan, string> = {
  trial: 'Teste Pro',
  pro: 'Pro',
  negocio: 'Negócio',
  past_due: 'Pagamento pendente',
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function dateFromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(key: string, amount: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}
function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function parseMoney(value: string) {
  const clean = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',') && clean.includes('.')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-11);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}
function whatsappUrl(phone: string, message: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function nowGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function normalizeText(value: string, max: number) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max) || 'GIRO';
}
function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}
function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function pixPayload(key: string, amountCents: number, merchant: string, city: string) {
  const account = emv('00', 'BR.GOV.BCB.PIX') + emv('01', key.trim());
  const amount = (amountCents / 100).toFixed(2);
  let payload = '000201' + emv('26', account) + '52040000' + '5303986' + emv('54', amount) + '5802BR' + emv('59', normalizeText(merchant, 25)) + emv('60', normalizeText(city, 15)) + emv('62', emv('05', '***')) + '6304';
  payload += crc16(payload);
  return payload;
}
function logoMark(size = 38) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="17" fill="#1d5c4e" />
      <path d="M46 20.5c-3.8-4-8.7-6-14.6-6C21 14.5 13 22 13 32s8 17.5 18.4 17.5c7.4 0 13.7-3.7 17-9.6V31H31v7h9.6c-2.1 3-5.2 4.6-9.2 4.6-6.2 0-10.8-4.5-10.8-10.6 0-6 4.6-10.6 10.8-10.6 3.8 0 6.7 1.2 9.1 3.7L46 20.5Z" fill="#fffdf8" />
      <path d="M50.5 16.8v10.8l-9.6-4.9 9.6-5.9Z" fill="#d9c8a8" />
    </svg>
  );
}
function blankState(name = 'Meu negócio', profile?: Partial<BusinessSetupValue>): GiroState {
  const type = profile?.type ?? 'outro';
  const responsibleName = profile?.responsibleName?.trim();
  const professional = { id: 'p-principal', name: responsibleName || 'Profissional principal', phone: profile?.phone?.trim() ?? '', active: true };
  return {
    version: 2,
    business: {
      name,
      slogan: defaultBusinessSlogan(type),
      type,
      customType: profile?.customType?.trim() || undefined,
      responsibleName,
      phone: profile?.phone?.trim() || undefined,
      city: profile?.city?.trim() || undefined,
      state: profile?.state?.trim().toUpperCase() || undefined,
      teamSize: profile?.teamSize && profile.teamSize > 0 ? Math.round(profile.teamSize) : 1,
      pixMerchant: name,
      pixCity: profile?.city?.trim().toUpperCase() || 'PORTO ALEGRE',
    },
    clients: [],
    services: suggestedServices(type),
    professionals: [professional],
    appointments: [],
    cash: [],
    orders: [],
  };
}
function exampleState(): GiroState {
  const state = blankState('Estúdio Luna', { name: 'Estúdio Luna', type: 'salao', responsibleName: 'Luna Ferreira', phone: '51999991111', city: 'Porto Alegre', state: 'RS', teamSize: 2 });
  const today = toDateKey(new Date());
  const yesterday = addDays(today, -1);
  state.business = { ...state.business, name: 'Estúdio Luna', slogan: 'Cabelo, estética e bem-estar', type: 'salao', responsibleName: 'Luna Ferreira', phone: '51999991111', city: 'Porto Alegre', state: 'RS', teamSize: 2, pixMerchant: 'ESTUDIO LUNA', pixCity: 'PORTO ALEGRE' };
  state.professionals = [
    { id: 'p-luna', name: 'Luna Ferreira', phone: '51999991111', active: true },
    { id: 'p-bia', name: 'Bia Martins', phone: '51999992222', active: true },
  ];
  state.clients = [
    { id: 'c-ana', name: 'Ana Beatriz Souza', phone: '51999990001', notes: 'Prefere atendimento pela manhã.' },
    { id: 'c-carlos', name: 'Carlos Mendes', phone: '51999990002', notes: '' },
    { id: 'c-juliana', name: 'Juliana Rocha', phone: '51999990003', notes: 'Gosta de esmaltes claros.' },
    { id: 'c-pedro', name: 'Pedro Nogueira', phone: '51999990004', notes: '' },
    { id: 'c-marina', name: 'Marina Alves', phone: '51999990005', notes: 'Noiva. Casamento em novembro.' },
  ];
  state.services = [
    { id: 's-corte-f', name: 'Corte feminino', minutes: 75, priceCents: 12000 },
    { id: 's-corte-m', name: 'Corte masculino', minutes: 45, priceCents: 6500 },
    { id: 's-coloracao', name: 'Coloração', minutes: 150, priceCents: 28000 },
    { id: 's-manicure', name: 'Manicure', minutes: 60, priceCents: 5500 },
    { id: 's-escova', name: 'Escova', minutes: 50, priceCents: 7000 },
    { id: 's-barba', name: 'Barba', minutes: 30, priceCents: 4500 },
  ];
  state.appointments = [
    { id: 'a-yesterday', clientId: 'c-carlos', serviceId: 's-corte-m', professionalId: 'p-luna', date: yesterday, time: '15:00', duration: 45, status: 'concluido', note: '' },
    { id: 'a-carlos', clientId: 'c-carlos', serviceId: 's-corte-m', professionalId: 'p-luna', date: today, time: '09:00', duration: 45, status: 'agendado', note: '' },
    { id: 'a-ana', clientId: 'c-ana', serviceId: 's-coloracao', professionalId: 'p-luna', date: today, time: '10:30', duration: 150, status: 'agendado', note: 'Retoque de raiz' },
    { id: 'a-juliana', clientId: 'c-juliana', serviceId: 's-manicure', professionalId: 'p-bia', date: today, time: '14:00', duration: 60, status: 'agendado', note: '' },
    { id: 'a-pedro', clientId: 'c-pedro', serviceId: 's-barba', professionalId: 'p-luna', date: today, time: '16:30', duration: 30, status: 'agendado', note: '' },
  ];
  state.cash = [
    { id: 'cash-cut', type: 'entrada', valueCents: 6500, at: `${yesterday}T15:45:00`, description: 'Corte masculino — Carlos Mendes', appointmentId: 'a-yesterday' },
    { id: 'cash-clean', type: 'saida', valueCents: 7850, at: `${today}T08:10:00`, description: 'Produtos de limpeza' },
    { id: 'cash-bride', type: 'entrada', valueCents: 10000, at: `${today}T08:35:00`, description: 'Sinal do pacote noiva' },
    { id: 'cash-coffee', type: 'saida', valueCents: 2350, at: `${today}T08:45:00`, description: 'Café da manhã' },
  ];
  state.orders = [
    { id: 'o-bride', clientId: 'c-marina', title: 'Pacote noiva', details: 'Teste de cabelo, preparação e produção no dia.', status: 'andamento', valueCents: 89000 },
    { id: 'o-mechas', clientId: 'c-ana', title: 'Mechas', details: 'Avaliar comprimento e quantidade de produto.', status: 'orcamento', valueCents: 42000 },
    { id: 'o-brow', clientId: 'c-juliana', title: 'Sobrancelha', details: 'Design + finalização.', status: 'pronto', valueCents: 6000 },
    { id: 'o-monthly', clientId: 'c-pedro', title: 'Pacote mensal', details: 'Quatro serviços concluídos.', status: 'entregue', valueCents: 24000 },
  ];
  return state;
}
function normalizeState(value: LegacyState): GiroState {
  const professionals = value.professionals?.length ? value.professionals : [{ id: 'p-principal', name: 'Profissional principal', phone: '', active: true }];
  return {
    ...value,
    version: 2,
    professionals,
    business: { ...value.business, type: value.business.type ?? 'outro', teamSize: value.business.teamSize ?? Math.max(1, professionals.length), pixMerchant: value.business.pixMerchant ?? value.business.name, pixCity: value.business.pixCity ?? value.business.city?.toUpperCase() ?? 'PORTO ALEGRE' },
    appointments: value.appointments.map(item => ({ ...item, professionalId: item.professionalId ?? professionals[0]?.id })),
  };
}
function readLocal(): GiroState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw) as LegacyState);
  } catch {
    return null;
  }
}
function downloadJson(state: GiroState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `giro-backup-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
function downloadCalendar(appointment: Appointment, client: Client | undefined, service: Service | undefined, business: string) {
  const start = `${appointment.date.replace(/-/g, '')}T${appointment.time.replace(':', '')}00`;
  const endDate = new Date(`${appointment.date}T${appointment.time}:00`);
  endDate.setMinutes(endDate.getMinutes() + appointment.duration);
  const end = `${toDateKey(endDate).replace(/-/g, '')}T${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}00`;
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Giro//PT-BR', 'BEGIN:VEVENT', `UID:${appointment.id}@giro`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${service?.name ?? 'Atendimento'} - ${client?.name ?? 'Cliente'}`, `DESCRIPTION:${business}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `giro-${appointment.date}-${appointment.time.replace(':', '')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>{children}</section></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Empty({ text }: { text: string }) {
  return <div className="empty-state"><div className="brand-mark muted">{logoMark(34)}</div><p>{text}</p></div>;
}

export default function Giro() {
  const [state, setState] = useState<GiroState | null>(() => readLocal());
  const [setupMode, setSetupMode] = useState<'none' | 'local' | 'cloud'>('none');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [businesses, setBusinesses] = useState<CloudBusiness[]>([]);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [tab, setTab] = useState<Tab>('hoje');
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [cashFilter, setCashFilter] = useState<'tudo' | CashType>('tudo');
  const [clientQuery, setClientQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus>('orcamento');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [backups, setBackups] = useState<Backup[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState({ asaasApi: false, asaasWebhook: false });
  const [billingResult, setBillingResult] = useState<{ payload?: string; message?: string } | null>(null);
  const [webhookMessage, setWebhookMessage] = useState('');
  const [pixAppointment, setPixAppointment] = useState<Appointment | null>(null);

  const currentRecord = businesses.find(item => item.id === currentBusinessId);

  const loadCloud = async (signedUser: AuthUser, seed?: GiroState | null) => {
    setCloudLoading(true);
    setCloudError('');
    try {
      const result = await api.get('/api/businesses');
      let records = result.data.businesses as CloudBusiness[];
      let verifiedAdmin: AdminProfile | null = null;
      if (signedUser.email?.toLowerCase() === CEO_EMAIL) {
        try {
          const adminResult = await api.get('/api/admin/me');
          verifiedAdmin = adminResult.data as AdminProfile;
        } catch {
          verifiedAdmin = null;
        }
      }
      if (!records.length && !seed) {
        setUser(signedUser);
        setAdminProfile(verifiedAdmin);
        setBusinesses([]);
        setCurrentBusinessId(null);
        setState(null);
        setSetupMode('cloud');
        return;
      }
      if (!records.length && seed) {
        const created = await api.post('/api/businesses', { state: seed });
        records = [created.data.business as CloudBusiness];
      }
      setUser(signedUser);
      setAdminProfile(verifiedAdmin);
      setBusinesses(records);
      setCurrentBusinessId(records[0].id);
      setState(normalizeState(records[0].state));
      setSetupMode('none');
    } catch (error) {
      const details = JSON.stringify(error);
      setCloudError(details.includes('account_blocked') ? 'Sua conta está bloqueada pelo administrador do Giro. Entre em contato para solicitar a liberação.' : 'Não foi possível carregar a nuvem agora. Seus dados locais continuam seguros.');
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      if (!auth.isSignedIn()) return;
      const signed = await auth.getUser();
      if (signed) await loadCloud(signed, readLocal());
    };
    void restoreSession();
  }, []);

  useEffect(() => {
    if (tab !== 'integracoes' || !user || !currentBusinessId) return;
    const refreshIntegrations = async () => {
      try {
        const [backupResult, statusResult] = await Promise.all([
          api.get(`/api/businesses/${currentBusinessId}/backups`),
          api.get('/api/integrations/status'),
        ]);
        setBackups(backupResult.data.backups as Backup[]);
        let status = statusResult.data as { asaasApi: boolean; asaasWebhook: boolean };
        if (status.asaasApi && !status.asaasWebhook) {
          setWebhookMessage('Finalizando conexão segura com o Asaas…');
          try {
            const result = await api.post('/api/integrations/asaas/webhook', { origin: window.location.origin });
            status = { ...status, asaasWebhook: true };
            setWebhookMessage(result.data.message ?? 'Confirmação automática ativada.');
          } catch {
            setWebhookMessage('A API está conectada. Use “Ativar confirmação automática” para tentar novamente.');
          }
        }
        setIntegrationStatus(status);
      } catch {
        setCloudError('Não foi possível atualizar as integrações.');
      }
    };
    void refreshIntegrations();
  }, [tab, user, currentBusinessId]);

  const signIn = async () => {
    setCloudError('');
    try {
      const result = await auth.signIn();
      await loadCloud(result.user, state ?? readLocal());
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'popup_closed') setCloudError(code === 'popup_blocked' ? 'Permita pop-ups para entrar no Giro.' : 'Não foi possível entrar. Tente novamente.');
    }
  };
  const signOut = async () => {
    await auth.signOut();
    setUser(null);
    setAdminProfile(null);
    setBusinesses([]);
    setCurrentBusinessId(null);
    setState(readLocal());
    setSetupMode('none');
    setTab('hoje');
  };
  const save = async (next: GiroState) => {
    setState(next);
    if (!user || !currentBusinessId) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      return;
    }
    setSyncing(true);
    setCloudError('');
    try {
      const result = await api.put(`/api/businesses/${currentBusinessId}`, { state: next });
      const updated = result.data.business as CloudBusiness;
      setBusinesses(items => items.map(item => item.id === updated.id ? updated : item));
    } catch {
      setCloudError('Alteração feita na tela, mas a sincronização falhou. Tente novamente antes de sair.');
    } finally {
      setSyncing(false);
    }
  };
  const switchBusiness = (id: string) => {
    const record = businesses.find(item => item.id === id);
    if (!record) return;
    setCurrentBusinessId(id);
    setState(normalizeState(record.state));
    setTab('hoje');
  };
  const closeModal = () => {
    setModal(null);
    setEditingClientId(null);
    setFormError('');
  };
  const createInitialBusiness = async (profile: BusinessSetupValue) => {
    const next = blankState(profile.name, profile);
    if (setupMode === 'cloud' && user) {
      setCloudLoading(true);
      setCloudError('');
      try {
        const created = await api.post('/api/businesses', { state: next });
        const business = created.data.business as CloudBusiness;
        setBusinesses([business]);
        setCurrentBusinessId(business.id);
        setState(normalizeState(business.state));
        setSetupMode('none');
      } catch {
        setCloudError('Não foi possível criar seu negócio na nuvem. Tente novamente.');
      } finally {
        setCloudLoading(false);
      }
      return;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    setState(next);
    setSetupMode('none');
  };

  if (cloudLoading) return <main className="welcome-shell"><div className="brand-mark large">{logoMark(58)}</div><p className="eyebrow">Giro Cloud</p><h1>Organizando seu negócio.</h1><p className="welcome-copy">Carregando agenda, caixa, clientes e equipe com segurança.</p></main>;

  if (!state) {
    if (setupMode !== 'none') return <main className="welcome-shell setup-welcome"><div className="brand-mark large">{logoMark(58)}</div><p className="eyebrow">Configure seu Giro</p><h1>Conte um pouco sobre o negócio.</h1><p className="welcome-copy">O segmento personaliza os primeiros serviços e ajuda o Giro a começar com uma estrutura mais útil para sua operação.</p><div className="business-setup-card"><BusinessSetupForm submitLabel={setupMode === 'cloud' ? 'Criar meu Giro na nuvem' : 'Começar meu Giro'} onSubmit={createInitialBusiness} onCancel={setupMode === 'cloud' ? () => void signOut() : () => setSetupMode('none')} /></div>{cloudError && <p className="form-error setup-error">{cloudError}</p>}</main>;
    return <main className="welcome-shell"><div className="brand-mark large">{logoMark(58)}</div><p className="eyebrow">Agenda, caixa e clientes</p><h1>Seu pequeno negócio em movimento.</h1><p className="welcome-copy">Use como aplicativo no celular, sincronize entre aparelhos e acompanhe o dia sem virar um ERP complicado.</p><div className="welcome-actions"><button className="primary-button" type="button" onClick={signIn}><LogIn size={18} /> Entrar e sincronizar</button><button className="secondary-button" type="button" onClick={() => { const next = exampleState(); localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); setState(next); }}>Conhecer o Estúdio Luna</button><button className="secondary-button" type="button" onClick={() => setSetupMode('local')}>Usar só neste aparelho</button></div><p className="welcome-note">Conta em nuvem é opcional. O modo local continua disponível.</p>{cloudError && <p className="form-error">{cloudError}</p>}</main>;
  }

  const today = toDateKey(new Date());
  const clientsById = new Map(state.clients.map(client => [client.id, client]));
  const servicesById = new Map(state.services.map(service => [service.id, service]));
  const prosById = new Map(state.professionals.map(pro => [pro.id, pro]));
  const resolveClient = (id: string) => clientsById.get(id)?.name ?? 'Cliente removido';
  const sumType = (entries: CashEntry[], type: CashType) => entries.filter(entry => entry.type === type).reduce((sum, entry) => sum + entry.valueCents, 0);
  const todayCash = state.cash.filter(entry => entry.at.slice(0, 10) === today);
  const monthCash = state.cash.filter(entry => entry.at.slice(0, 7) === today.slice(0, 7));
  const entriesToday = sumType(todayCash, 'entrada');
  const exitsToday = sumType(todayCash, 'saida');
  const appointmentsToday = state.appointments.filter(item => item.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const openOrders = state.orders.filter(order => order.status !== 'entregue').length;
  const sevenDays = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  const chartData = sevenDays.map(day => {
    const entries = state.cash.filter(entry => entry.at.slice(0, 10) === day);
    return { day, net: sumType(entries, 'entrada') - sumType(entries, 'saida') };
  });
  const chartMax = Math.max(1, ...chartData.map(item => Math.abs(item.net)));
  const selectedAppointments = state.appointments.filter(item => item.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const visibleCash = state.cash.filter(entry => cashFilter === 'tudo' || entry.type === cashFilter).sort((a, b) => b.at.localeCompare(a.at));
  const visibleClients = state.clients.filter(client => `${client.name} ${client.phone}`.toLowerCase().includes(clientQuery.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const clientVisits = (clientId: string) => state.appointments.filter(item => item.clientId === clientId && item.status === 'concluido').length;

  const updateAppointment = (id: string, status: AppointmentStatus) => {
    const appointment = state.appointments.find(item => item.id === id);
    if (!appointment) return;
    let cash = state.cash;
    if (status === 'concluido' && !cash.some(entry => entry.appointmentId === id)) {
      const service = servicesById.get(appointment.serviceId);
      if (service) cash = [...cash, { id: uid('cash'), type: 'entrada', valueCents: service.priceCents, at: new Date().toISOString(), description: `${service.name} — ${resolveClient(appointment.clientId)}`, appointmentId: id }];
    }
    void save({ ...state, cash, appointments: state.appointments.map(item => item.id === id ? { ...item, status } : item) });
  };
  const openWhatsApp = (appointment: Appointment) => {
    const client = clientsById.get(appointment.clientId);
    const service = servicesById.get(appointment.serviceId);
    if (!client || !service || !client.phone) return;
    window.open(whatsappUrl(client.phone, `Oi ${firstName(client.name)}, aqui é do ${state.business.name}. Confirmando seu horário de ${service.name} às ${appointment.time}.`), '_blank', 'noopener,noreferrer');
  };
  const appointmentCard = (appointment: Appointment) => {
    const client = clientsById.get(appointment.clientId);
    const service = servicesById.get(appointment.serviceId);
    const pro = appointment.professionalId ? prosById.get(appointment.professionalId) : undefined;
    return <article className={`appointment-card status-${appointment.status}`} key={appointment.id}><div className="appointment-time"><strong>{appointment.time}</strong><span>{appointment.duration} min</span></div><div className="appointment-body"><div className="appointment-topline"><div><h3>{client?.name ?? 'Cliente removido'}</h3><p>{service?.name ?? 'Serviço removido'} · {service ? formatMoney(service.priceCents) : '—'}</p><small className="pro-line">{pro?.name ?? 'Sem profissional'}</small></div><span className={`status-chip ${appointment.status}`}>{appointment.status}</span></div>{appointment.note && <p className="note-text">{appointment.note}</p>}<div className="card-actions">{appointment.status === 'agendado' && <><button className="small-button primary" type="button" onClick={() => updateAppointment(appointment.id, 'concluido')}><Check size={16} />Concluir</button><button className="small-button" type="button" onClick={() => openWhatsApp(appointment)}><MessageCircle size={16} />WhatsApp</button><button className="small-button" type="button" onClick={() => downloadCalendar(appointment, client, service, state.business.name)}><CalendarDays size={16} />Calendário</button><button className="small-button" type="button" onClick={() => updateAppointment(appointment.id, 'faltou')}>Faltou</button><button className="small-button danger" type="button" onClick={() => updateAppointment(appointment.id, 'cancelado')}><X size={16} />Cancelar</button></>}{service && state.business.pixKey && appointment.status !== 'cancelado' && <button className="small-button" type="button" onClick={() => setPixAppointment(appointment)}><BadgeDollarSign size={16} />Cobrar Pix</button>}</div></div></article>;
  };
  const moveOrder = (id: string, direction: -1 | 1) => void save({ ...state, orders: state.orders.map(order => { if (order.id !== id) return order; const index = orderStatuses.indexOf(order.status); return { ...order, status: orderStatuses[Math.max(0, Math.min(orderStatuses.length - 1, index + direction))] }; }) });
  const orderCard = (order: Order) => <article className="order-card" key={order.id}><div className="order-card-top"><span className={`order-dot ${order.status}`} /><span>{orderLabels[order.status]}</span></div><h3>{order.title}</h3><p className="order-client">{resolveClient(order.clientId)}</p>{order.details && <p className="order-details">{order.details}</p>}<strong className="order-value">{formatMoney(order.valueCents)}</strong><div className="card-actions compact">{order.status !== 'orcamento' && <button className="icon-button soft" type="button" onClick={() => moveOrder(order.id, -1)} aria-label="Voltar"><ChevronLeft size={18} /></button>}{order.status !== 'entregue' && <button className="small-button primary" type="button" onClick={() => moveOrder(order.id, 1)}>Avançar<ChevronRight size={16} /></button>}<button className="icon-button soft danger-text" type="button" onClick={() => void save({ ...state, orders: state.orders.filter(item => item.id !== order.id) })} aria-label="Excluir ordem"><Trash2 size={17} /></button></div></article>;

  const navItems: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'hoje', label: 'Hoje', icon: <Home size={20} /> },
    { id: 'agenda', label: 'Agenda', icon: <CalendarDays size={20} /> },
    { id: 'caixa', label: 'Caixa', icon: <WalletCards size={20} /> },
    { id: 'clientes', label: 'Clientes', icon: <Users size={20} /> },
    { id: 'ordens', label: 'Ordens', icon: <ClipboardList size={20} /> },
    { id: 'equipe', label: 'Equipe', icon: <BriefcaseBusiness size={20} /> },
    { id: 'integracoes', label: 'Conexões', icon: <Link2 size={20} /> },
  ];
  if (adminProfile) navItems.push({ id: 'admin', label: 'Painel CEO', icon: <ShieldCheck size={20} /> });
  const dayStrip = Array.from({ length: 14 }, (_, index) => addDays(today, index - 1));

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="brand-mark">{logoMark(38)}</div><div><strong>Giro</strong><span>{state.business.name}</span></div></div>
      {user && <div className="workspace-box"><span>Negócio</span><select value={currentBusinessId ?? ''} onChange={event => switchBusiness(event.target.value)}>{businesses.map(item => <option key={item.id} value={item.id}>{item.state.business.name}</option>)}</select><button type="button" onClick={() => setModal('newBusiness')}><Plus size={15} /> Novo negócio</button></div>}
      <nav>{navItems.map(item => <button className={tab === item.id ? 'nav-item active' : 'nav-item'} type="button" key={item.id} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
      <div className="sidebar-foot">{user ? <>{adminProfile && <div className="admin-card"><span className="admin-role">CEO • ADM</span><strong>{adminProfile.name}</strong><small>{adminProfile.email}</small></div>}<div className="cloud-pill"><Cloud size={15} />{syncing ? 'Sincronizando…' : 'Nuvem ativa'}</div><button className="nav-item" type="button" onClick={signOut}><LogOut size={20} /><span>Sair</span></button></> : <button className="nav-item cloud-cta" type="button" onClick={signIn}><Cloud size={20} /><span>Ativar nuvem</span></button>}<button className="nav-item" type="button" onClick={() => setModal('settings')}><Settings size={20} /><span>Ajustes</span></button></div>
    </aside>
    <main className="main-panel">
      <header className="mobile-header"><div className="sidebar-brand"><div className="brand-mark">{logoMark(35)}</div><div><strong>Giro</strong><span>{state.business.name}</span></div></div><div className="mobile-actions">{user ? <Cloud size={18} /> : <button className="icon-button" type="button" onClick={signIn} aria-label="Ativar nuvem"><LogIn size={19} /></button>}<button className="icon-button" type="button" onClick={() => setModal('settings')} aria-label="Ajustes"><Settings size={20} /></button></div></header>
      {cloudError && <div className="sync-alert">{cloudError}</div>}
      {!user && <div className="local-banner"><span><Cloud size={17} /> Dados somente neste aparelho</span><button type="button" onClick={signIn}>Entrar e sincronizar</button></div>}

      {tab === 'hoje' && <section className="page"><div className="page-head hero-head"><div><p className="eyebrow">{nowGreeting()}, {state.business.name}</p><h1>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</h1><p>{state.business.slogan}</p></div><div className="page-actions"><button className="secondary-button compact-button" type="button" onClick={() => setModal('cash')}><Plus size={17} />Lançar no caixa</button><button className="primary-button compact-button" type="button" onClick={() => setModal('schedule')}><Plus size={17} />Novo horário</button></div></div><div className="stats-grid four"><div className="stat-card"><span>Entradas hoje</span><strong>{formatMoney(entriesToday)}</strong><small>Recebido</small></div><div className="stat-card"><span>Saídas hoje</span><strong className="negative">{formatMoney(exitsToday)}</strong><small>Despesas</small></div><div className="stat-card"><span>Ordens abertas</span><strong>{openOrders}</strong><small>Em movimento</small></div><div className="stat-card"><span>Plano</span><strong className="plan-stat">{user ? planLabels[currentRecord?.plan ?? 'trial'] : 'Local'}</strong><small>{user ? 'sincronizado' : 'sem conta'}</small></div></div><div className="content-grid"><section className="panel-card"><div className="section-head"><div><p className="eyebrow">Últimos 7 dias</p><h2>Giro do caixa</h2></div><span className="soft-badge">entrada − saída</span></div><div className="chart">{chartData.map(item => <div className="chart-col" key={item.day}><div className={`chart-bar ${item.net < 0 ? 'negative-bar' : ''}`} style={{ height: Math.max(8, Math.round((Math.abs(item.net) / chartMax) * 110)) }} title={`${item.day}: ${formatMoney(item.net)}`} /><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dateFromKey(item.day)).replace('.', '')}</span></div>)}</div></section><section className="panel-card today-agenda"><div className="section-head"><div><p className="eyebrow">Agenda</p><h2>Hoje</h2></div><button className="text-button" type="button" onClick={() => setTab('agenda')}>Ver agenda</button></div><div className="stack-list">{appointmentsToday.length ? appointmentsToday.map(appointmentCard) : <Empty text="Nenhum horário para hoje." />}</div></section></div></section>}

      {tab === 'agenda' && <section className="page"><div className="page-head"><div><p className="eyebrow">14 dias</p><h1>Agenda</h1><p>Horários por profissional, com bloqueio de conflito.</p></div><button className="primary-button compact-button" type="button" onClick={() => setModal('schedule')}><Plus size={17} />Novo horário</button></div><div className="day-strip">{dayStrip.map(day => { const date = dateFromKey(day); return <button className={selectedDate === day ? 'day-pill active' : 'day-pill'} type="button" key={day} onClick={() => setSelectedDate(day)}><span>{day === today ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '')}</span><strong>{date.getDate()}</strong></button>; })}</div><div className="agenda-layout"><section className="panel-card"><div className="section-head"><div><p className="eyebrow">Horários</p><h2>{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(dateFromKey(selectedDate))}</h2></div><span className="soft-badge">{selectedAppointments.length} atendimento(s)</span></div><div className="stack-list">{selectedAppointments.length ? selectedAppointments.map(appointmentCard) : <Empty text="Nenhum horário neste dia." />}</div></section><section className="panel-card services-card"><div className="section-head"><div><p className="eyebrow">Tabela</p><h2>Serviços</h2></div><button className="text-button" type="button" onClick={() => setModal('service')}><Plus size={16} />Adicionar</button></div><div className="service-table">{state.services.map(service => <div className="service-row" key={service.id}><div><strong>{service.name}</strong><span>{service.minutes} min</span></div><strong>{formatMoney(service.priceCents)}</strong></div>)}</div></section></div></section>}

      {tab === 'caixa' && <section className="page"><div className="page-head"><div><p className="eyebrow">Saldo do dia</p><h1>{formatMoney(entriesToday - exitsToday)}</h1><p>{user ? 'Sincronizado na nuvem.' : 'Registrado neste aparelho.'}</p></div><button className="primary-button compact-button" type="button" onClick={() => setModal('cash')}><Plus size={17} />Lançar no caixa</button></div><div className="stats-grid four"><div className="stat-card"><span>Entradas hoje</span><strong>{formatMoney(entriesToday)}</strong></div><div className="stat-card"><span>Saídas hoje</span><strong className="negative">{formatMoney(exitsToday)}</strong></div><div className="stat-card"><span>Entradas no mês</span><strong>{formatMoney(sumType(monthCash, 'entrada'))}</strong></div><div className="stat-card"><span>Saídas no mês</span><strong className="negative">{formatMoney(sumType(monthCash, 'saida'))}</strong></div></div><section className="panel-card"><div className="section-head"><div><p className="eyebrow">Movimentações</p><h2>Caixa</h2></div><div className="segmented">{(['tudo', 'entrada', 'saida'] as const).map(filter => <button className={cashFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setCashFilter(filter)}>{filter === 'tudo' ? 'Tudo' : filter === 'entrada' ? 'Entradas' : 'Saídas'}</button>)}</div></div><div className="cash-list">{visibleCash.length ? visibleCash.map(entry => <div className="cash-row" key={entry.id}><div className={`cash-sign ${entry.type}`}>{entry.type === 'entrada' ? '+' : '−'}</div><div className="cash-main"><strong>{entry.description}</strong><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.at))}</span></div><strong className={entry.type === 'saida' ? 'negative' : 'positive'}>{entry.type === 'saida' ? '−' : '+'}{formatMoney(entry.valueCents)}</strong><button className="icon-button soft danger-text" type="button" onClick={() => void save({ ...state, cash: state.cash.filter(item => item.id !== entry.id) })} aria-label="Excluir lançamento"><Trash2 size={17} /></button></div>) : <Empty text="Nenhum lançamento encontrado." />}</div></section></section>}

      {tab === 'clientes' && <section className="page"><div className="page-head"><div><p className="eyebrow">Relacionamento</p><h1>Clientes</h1><p>Telefone, visitas e preferências.</p></div><button className="primary-button compact-button" type="button" onClick={() => setModal('client')}><Plus size={17} />Novo cliente</button></div><div className="search-box"><Search size={18} /><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder="Buscar por nome ou telefone" /></div><div className="clients-grid">{visibleClients.length ? visibleClients.map(client => <article className="client-card" key={client.id}><div className="client-top"><div className="avatar">{client.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')}</div><div><h3>{client.name}</h3><p>{client.phone ? formatPhone(client.phone) : 'Sem telefone'}</p></div></div><div className="client-meta"><span><strong>{clientVisits(client.id)}</strong> visitas concluídas</span>{client.notes && <p>{client.notes}</p>}</div><div className="card-actions">{client.phone && <button className="small-button" type="button" onClick={() => window.open(whatsappUrl(client.phone, `Oi ${firstName(client.name)}!`), '_blank', 'noopener,noreferrer')}><MessageCircle size={16} />WhatsApp</button>}<button className="small-button" type="button" onClick={() => { setEditingClientId(client.id); setModal('client'); }}>Editar</button><button className="icon-button soft danger-text" type="button" onClick={() => void save({ ...state, clients: state.clients.filter(item => item.id !== client.id) })} aria-label="Excluir cliente"><Trash2 size={17} /></button></div></article>) : <Empty text="Nenhum cliente encontrado." />}</div></section>}

      {tab === 'ordens' && <section className="page"><div className="page-head"><div><p className="eyebrow">Trabalhos em andamento</p><h1>Ordens</h1><p>Pacotes, orçamentos e serviços de vários dias.</p></div><button className="primary-button compact-button" type="button" onClick={() => setModal('order')}><Plus size={17} />Nova ordem</button></div><div className="mobile-order-filter segmented">{orderStatuses.map(status => <button className={orderFilter === status ? 'active' : ''} type="button" key={status} onClick={() => setOrderFilter(status)}>{orderLabels[status]}</button>)}</div><div className="order-board">{orderStatuses.map(status => <section className="order-column" key={status}><div className="order-column-head"><span>{orderLabels[status]}</span><strong>{state.orders.filter(order => order.status === status).length}</strong></div><div className="order-stack">{state.orders.filter(order => order.status === status).map(orderCard)}</div></section>)}</div><div className="mobile-order-list">{state.orders.filter(order => order.status === orderFilter).map(orderCard)}</div></section>}

      {tab === 'equipe' && <section className="page"><div className="page-head"><div><p className="eyebrow">Vários profissionais</p><h1>Equipe</h1><p>Organize quem atende e associe cada horário a uma pessoa.</p></div><button className="primary-button compact-button" type="button" onClick={() => setModal('professional')}><UserRoundPlus size={17} />Novo profissional</button></div><div className="team-grid">{state.professionals.map(pro => <article className="client-card" key={pro.id}><div className="client-top"><div className="avatar">{pro.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')}</div><div><h3>{pro.name}</h3><p>{pro.phone ? formatPhone(pro.phone) : 'Sem telefone'}</p></div></div><div className="client-meta"><span className={`integration-state ${pro.active ? 'ok' : 'off'}`}>{pro.active ? 'Ativo na agenda' : 'Inativo'}</span></div><div className="card-actions"><button className="small-button" type="button" onClick={() => void save({ ...state, professionals: state.professionals.map(item => item.id === pro.id ? { ...item, active: !item.active } : item) })}>{pro.active ? 'Desativar' : 'Ativar'}</button>{state.professionals.length > 1 && <button className="icon-button soft danger-text" type="button" onClick={() => void save({ ...state, professionals: state.professionals.filter(item => item.id !== pro.id) })} aria-label="Excluir profissional"><Trash2 size={17} /></button>}</div></article>)}</div></section>}

      {tab === 'admin' && adminProfile && <AdminPanel profile={adminProfile} />}

      {tab === 'integracoes' && <section className="page"><div className="page-head"><div><p className="eyebrow">Giro conectado</p><h1>Conexões e planos</h1><p>WhatsApp, calendário, backups e cobrança do próprio Giro.</p></div>{user && <span className="cloud-pill light"><ShieldCheck size={16} />Conta protegida</span>}</div><div className="integration-grid"><article className="integration-card"><MessageCircle size={23} /><div><h3>WhatsApp</h3><p>Confirmação de horários e contato com clientes.</p></div><span className="integration-state ok">Ativo</span></article><article className="integration-card"><CalendarDays size={23} /><div><h3>Google/Apple Calendar</h3><p>Baixe o horário em .ics e adicione ao calendário.</p></div><span className="integration-state ok">Ativo</span></article><article className="integration-card"><Cloud size={23} /><div><h3>Giro Cloud</h3><p>Mesmos dados no computador e celular.</p></div><span className={`integration-state ${user ? 'ok' : 'off'}`}>{user ? 'Ativo' : 'Entrar'}</span></article><article className="integration-card"><BadgeDollarSign size={23} /><div><h3>Asaas</h3><p>Mensalidades Pro e Negócio via Pix recorrente.</p></div><span className={`integration-state ${integrationStatus.asaasApi ? 'ok' : 'off'}`}>{integrationStatus.asaasApi ? (integrationStatus.asaasWebhook ? 'Conectado e automático' : 'API conectada') : 'Aguardando chave'}</span>{user && integrationStatus.asaasApi && <button className="small-button" type="button" onClick={async () => { setWebhookMessage(integrationStatus.asaasWebhook ? 'Revalidando integração…' : 'Ativando confirmação automática…'); try { const result = await api.post('/api/integrations/asaas/webhook', { origin: window.location.origin }); setIntegrationStatus(current => ({ ...current, asaasWebhook: true })); setWebhookMessage(result.data.message ?? 'Confirmação automática ativada.'); } catch { setWebhookMessage('Não foi possível ativar o webhook do Asaas.'); } }}><RefreshCw size={15} />{integrationStatus.asaasWebhook ? 'Revalidar integração' : 'Ativar confirmação automática'}</button>}{webhookMessage && <small className="integration-message">{webhookMessage}</small>}</article></div><div className="integrations-layout"><section className="panel-card"><div className="section-head"><div><p className="eyebrow">Proteção</p><h2>Backup</h2></div><button className="text-button" type="button" onClick={() => downloadJson(state)}><Download size={16} />Baixar JSON</button></div>{user && currentBusinessId ? <><div className="backup-actions"><button className="secondary-button" type="button" onClick={async () => { await api.post(`/api/businesses/${currentBusinessId}/backups`, {}); const result = await api.get(`/api/businesses/${currentBusinessId}/backups`); setBackups(result.data.backups as Backup[]); }}><Save size={17} />Criar ponto de restauração</button><small>Além do salvamento contínuo, o Giro cria backup automático diário antes de alterações.</small></div><div className="backup-list">{backups.slice(0, 5).map(backup => <div className="backup-row" key={backup.id}><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(backup.createdAt))} · {backup.kind === 'auto' ? 'automático' : 'manual'}</span><button type="button" onClick={async () => { const result = await api.post(`/api/businesses/${currentBusinessId}/restore`, { backupId: backup.id }); const restored = result.data.business as CloudBusiness; setBusinesses(items => items.map(item => item.id === restored.id ? restored : item)); setState(restored.state); }}>Restaurar</button></div>)}</div></> : <p className="muted-copy">Entre no Giro para criar backups na nuvem. O download JSON funciona também no modo local.</p>}</section><section className="panel-card"><div className="section-head"><div><p className="eyebrow">Planos pagos</p><h2>Giro comercial</h2></div><span className="soft-badge">{user ? planLabels[currentRecord?.plan ?? 'trial'] : 'Conta necessária'}</span></div><div className="plans"><div className="plan-card"><strong>Pro</strong><span>R$ 39,90/mês</span><small>Nuvem, backups, vários profissionais e múltiplos negócios.</small></div><div className="plan-card featured"><strong>Negócio</strong><span>R$ 79,90/mês</span><small>Base Pro + prioridade para integrações e expansão da operação.</small></div></div>{user && currentBusinessId ? <form className="billing-form" onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setBillingResult({ message: 'Gerando cobrança segura…' }); try { const result = await api.post('/api/billing/subscribe', { businessId: currentBusinessId, plan: String(data.get('plan')), name: String(data.get('name')), cpfCnpj: String(data.get('cpfCnpj')), email: String(data.get('email')) }); setBillingResult(result.data as { payload?: string; message?: string }); } catch { setBillingResult({ message: 'Não foi possível iniciar a assinatura. Verifique a integração Asaas.' }); } }}><div className="two-col"><Field label="Plano"><select name="plan" defaultValue="pro"><option value="pro">Pro — R$ 39,90</option><option value="negocio">Negócio — R$ 79,90</option></select></Field><Field label="CPF/CNPJ"><input name="cpfCnpj" placeholder="Somente números" required /></Field></div><Field label="Nome do pagador"><input name="name" defaultValue={user.name ?? ''} required /></Field><Field label="E-mail"><input name="email" type="email" defaultValue={user.email ?? ''} required /></Field><button className="primary-button full" type="submit" disabled={!integrationStatus.asaasApi}>Assinar com Pix</button>{billingResult?.message && <p className="muted-copy">{billingResult.message}</p>}{billingResult?.payload && <div className="pix-box"><textarea readOnly value={billingResult.payload} rows={4} /><button className="secondary-button full" type="button" onClick={() => void navigator.clipboard.writeText(billingResult.payload ?? '')}><Copy size={16} />Copiar Pix Copia e Cola</button></div>}</form> : <button className="primary-button full" type="button" onClick={signIn}>Entrar para escolher um plano</button>}</section></div></section>}
    </main>
    <nav className="bottom-nav">{navItems.map(item => <button className={tab === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>

    {modal === 'schedule' && <Modal title="Novo horário" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const clientId = String(data.get('clientId') ?? ''); const serviceId = String(data.get('serviceId') ?? ''); const professionalId = String(data.get('professionalId') ?? ''); const date = String(data.get('date') ?? selectedDate); const time = String(data.get('time') ?? ''); const service = servicesById.get(serviceId); if (!clientId || !service || !professionalId || !date || !time) { setFormError('Preencha cliente, serviço, profissional, data e horário.'); return; } const start = minutesOf(time); const end = start + service.minutes; const conflict = state.appointments.some(item => item.date === date && item.professionalId === professionalId && item.status === 'agendado' && start < minutesOf(item.time) + item.duration && end > minutesOf(item.time)); if (conflict) { setFormError('Este profissional já tem um atendimento nesse intervalo.'); return; } void save({ ...state, appointments: [...state.appointments, { id: uid('a'), clientId, serviceId, professionalId, date, time, duration: service.minutes, status: 'agendado', note: String(data.get('note') ?? '') }] }); setSelectedDate(date); closeModal(); }}><Field label="Cliente"><select name="clientId" defaultValue="" required><option value="" disabled>Selecione</option>{state.clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></Field><Field label="Serviço"><select name="serviceId" defaultValue="" required><option value="" disabled>Selecione</option>{state.services.map(service => <option value={service.id} key={service.id}>{service.name} · {formatMoney(service.priceCents)}</option>)}</select></Field><Field label="Profissional"><select name="professionalId" defaultValue={state.professionals.find(pro => pro.active)?.id ?? ''} required>{state.professionals.filter(pro => pro.active).map(pro => <option value={pro.id} key={pro.id}>{pro.name}</option>)}</select></Field><div className="two-col"><Field label="Data"><input name="date" type="date" defaultValue={selectedDate} required /></Field><Field label="Horário"><input name="time" type="time" required /></Field></div><Field label="Observação"><textarea name="note" rows={3} placeholder="Opcional" /></Field>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Salvar horário</button></form></Modal>}

    {modal === 'cash' && <Modal title="Lançar no caixa" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const description = String(data.get('description') ?? '').trim(); const valueCents = parseMoney(String(data.get('value') ?? '')); const type = String(data.get('type')) as CashType; if (!description || valueCents <= 0) { setFormError('Informe uma descrição e um valor maior que zero.'); return; } void save({ ...state, cash: [...state.cash, { id: uid('cash'), type, valueCents, at: new Date().toISOString(), description }] }); closeModal(); }}><Field label="Tipo"><select name="type" defaultValue="entrada"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></Field><Field label="Descrição"><input name="description" placeholder="Ex.: Sinal do pacote" required /></Field><Field label="Valor"><input name="value" inputMode="decimal" placeholder="0,00" required /></Field>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Registrar lançamento</button></form></Modal>}

    {modal === 'client' && (() => { const current = editingClientId ? state.clients.find(client => client.id === editingClientId) : undefined; return <Modal title={current ? 'Editar cliente' : 'Novo cliente'} onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim(); if (!name) { setFormError('O nome do cliente é obrigatório.'); return; } const next: Client = { id: current?.id ?? uid('c'), name, phone: String(data.get('phone') ?? '').trim(), notes: String(data.get('notes') ?? '').trim() }; void save({ ...state, clients: current ? state.clients.map(client => client.id === current.id ? next : client) : [...state.clients, next] }); closeModal(); }}><Field label="Nome"><input name="name" defaultValue={current?.name ?? ''} placeholder="Nome completo" /></Field><Field label="Telefone"><input name="phone" defaultValue={current?.phone ?? ''} inputMode="tel" placeholder="(51) 99999-9999" /></Field><Field label="Notas"><textarea name="notes" defaultValue={current?.notes ?? ''} rows={4} placeholder="Preferências, observações..." /></Field>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">{current ? 'Salvar alterações' : 'Cadastrar cliente'}</button></form></Modal>; })()}

    {modal === 'service' && <Modal title="Adicionar serviço" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim(); const minutes = Number(data.get('minutes')); const priceCents = parseMoney(String(data.get('price') ?? '')); if (!name || !Number.isFinite(minutes) || minutes <= 0 || priceCents <= 0) { setFormError('Preencha nome, duração e preço válidos.'); return; } void save({ ...state, services: [...state.services, { id: uid('s'), name, minutes, priceCents }] }); closeModal(); }}><Field label="Nome"><input name="name" placeholder="Ex.: Escova" required /></Field><div className="two-col"><Field label="Duração (min)"><input name="minutes" type="number" min="1" defaultValue="60" required /></Field><Field label="Preço"><input name="price" inputMode="decimal" placeholder="100,00" required /></Field></div>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Adicionar serviço</button></form></Modal>}

    {modal === 'order' && <Modal title="Nova ordem" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const title = String(data.get('title') ?? '').trim(); const clientId = String(data.get('clientId') ?? ''); const valueCents = parseMoney(String(data.get('value') ?? '')); if (!title || !clientId || valueCents <= 0) { setFormError('Informe cliente, título e valor.'); return; } void save({ ...state, orders: [...state.orders, { id: uid('o'), clientId, title, details: String(data.get('details') ?? '').trim(), status: 'orcamento', valueCents }] }); closeModal(); }}><Field label="Cliente"><select name="clientId" defaultValue="" required><option value="" disabled>Selecione</option>{state.clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></Field><Field label="Título"><input name="title" placeholder="Ex.: Pacote noiva" required /></Field><Field label="Detalhes"><textarea name="details" rows={3} /></Field><Field label="Valor"><input name="value" inputMode="decimal" placeholder="0,00" required /></Field>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Criar ordem</button></form></Modal>}

    {modal === 'professional' && <Modal title="Novo profissional" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim(); if (!name) { setFormError('Informe o nome do profissional.'); return; } void save({ ...state, professionals: [...state.professionals, { id: uid('p'), name, phone: String(data.get('phone') ?? '').trim(), active: true }] }); closeModal(); }}><Field label="Nome"><input name="name" required /></Field><Field label="Telefone"><input name="phone" inputMode="tel" /></Field>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Adicionar à equipe</button></form></Modal>}

    {modal === 'newBusiness' && <Modal title="Novo negócio" onClose={closeModal}><BusinessSetupForm submitLabel="Criar negócio" onSubmit={async profile => { const created = await api.post('/api/businesses', { state: blankState(profile.name, profile) }); const business = created.data.business as CloudBusiness; setBusinesses(items => [...items, business]); setCurrentBusinessId(business.id); setState(normalizeState(business.state)); closeModal(); }} /></Modal>}

    {modal === 'settings' && <Modal title="Ajustes" onClose={closeModal}><form className="form-grid" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('businessName') ?? '').trim(); const type = String(data.get('businessType') ?? 'outro') as BusinessType; const customType = String(data.get('customType') ?? '').trim(); const teamSize = Math.max(1, Number(data.get('teamSize')) || 1); if (!name) { setFormError('O nome do negócio é obrigatório.'); return; } if (type === 'outro' && !customType) { setFormError('Descreva o tipo do negócio ao escolher Outro.'); return; } void save({ ...state, business: { ...state.business, name, type, customType: type === 'outro' ? customType : undefined, responsibleName: String(data.get('responsibleName') ?? '').trim(), phone: String(data.get('businessPhone') ?? '').trim(), city: String(data.get('businessCity') ?? '').trim(), state: String(data.get('businessState') ?? '').trim().toUpperCase(), teamSize, slogan: String(data.get('slogan') ?? '').trim(), pixKey: String(data.get('pixKey') ?? '').trim(), pixMerchant: String(data.get('pixMerchant') ?? '').trim(), pixCity: String(data.get('pixCity') ?? '').trim() } }); closeModal(); }}><Field label="Nome do negócio"><input name="businessName" defaultValue={state.business.name} required /></Field><div className="two-col"><Field label="Tipo de negócio"><select name="businessType" defaultValue={state.business.type}>{businessTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label="Segmento personalizado (se Outro)"><input name="customType" defaultValue={state.business.customType ?? ''} placeholder="Ex.: Escola de idiomas" /></Field></div><div className="two-col"><Field label="Responsável"><input name="responsibleName" defaultValue={state.business.responsibleName ?? ''} /></Field><Field label="Telefone / WhatsApp"><input name="businessPhone" defaultValue={state.business.phone ?? ''} inputMode="tel" /></Field></div><div className="business-location-grid"><Field label="Cidade"><input name="businessCity" defaultValue={state.business.city ?? ''} /></Field><Field label="UF"><input name="businessState" defaultValue={state.business.state ?? ''} maxLength={2} /></Field><Field label="Profissionais"><input name="teamSize" type="number" min="1" max="100" defaultValue={state.business.teamSize ?? 1} /></Field></div><p className="business-type-help">Alterar o segmento aqui não apaga nem substitui os serviços que você já cadastrou.</p><Field label="Slogan"><input name="slogan" defaultValue={state.business.slogan} /></Field><div className="settings-divider" /><p className="eyebrow">Pix do seu negócio</p><Field label="Chave Pix"><input name="pixKey" defaultValue={state.business.pixKey ?? ''} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" /></Field><div className="two-col"><Field label="Nome do recebedor"><input name="pixMerchant" defaultValue={state.business.pixMerchant ?? state.business.name} /></Field><Field label="Cidade"><input name="pixCity" defaultValue={state.business.pixCity ?? 'PORTO ALEGRE'} /></Field></div>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full" type="submit">Salvar ajustes</button></form><div className="settings-divider" /><div className="settings-actions"><button className="secondary-button full" type="button" onClick={() => { void save(exampleState()); closeModal(); }}><RotateCcw size={18} />Restaurar Estúdio Luna</button><button className="danger-button full" type="button" onClick={() => { void save(blankState(state.business.name, state.business)); closeModal(); }}><Eraser size={18} />Esvaziar operação</button></div><div className="about-box"><strong>Giro</strong><p>Agenda, caixa e clientes para o pequeno negócio.</p><p className="developer-credit"><b>Desenvolvedor</b> {DEVELOPER_NAME}</p>{adminProfile && <p className="developer-credit"><b>CEO • Administrador</b> {adminProfile.name}</p>}<span>{user ? 'Conta + nuvem + backup · giro-v2' : 'Modo local · giro-v2'}</span></div></Modal>}

    {pixAppointment && (() => { const service = servicesById.get(pixAppointment.serviceId); const payload = state.business.pixKey && service ? pixPayload(state.business.pixKey, service.priceCents, state.business.pixMerchant ?? state.business.name, state.business.pixCity ?? 'BRASIL') : ''; return <Modal title="Cobrar no Pix" onClose={() => setPixAppointment(null)}><div className="pix-charge"><div className="pix-amount"><span>{service?.name}</span><strong>{service ? formatMoney(service.priceCents) : '—'}</strong></div><p>Pix Copia e Cola gerado com a chave cadastrada do seu negócio.</p><textarea readOnly rows={5} value={payload} /><button className="primary-button full" type="button" onClick={() => void navigator.clipboard.writeText(payload)}><Copy size={17} />Copiar código Pix</button><small>O Giro gera o código, mas não consulta o banco para confirmar o pagamento.</small></div></Modal>; })()}
  </div>;
}