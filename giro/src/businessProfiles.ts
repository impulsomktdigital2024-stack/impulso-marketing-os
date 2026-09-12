export type BusinessType = 'salao' | 'barbearia' | 'estetica' | 'manicure' | 'spa' | 'clinica' | 'oficina' | 'assistencia' | 'atelie' | 'pet_shop' | 'fotografia' | 'servicos_residenciais' | 'academia' | 'alimentacao' | 'outro';

export type BusinessSetupValue = {
  name: string;
  type: BusinessType;
  customType?: string;
  responsibleName: string;
  phone: string;
  city: string;
  state: string;
  teamSize: number;
};

type PresetService = { name: string; minutes: number; priceCents: number };
type BusinessPreset = { label: string; slogan: string; services: PresetService[] };

export const businessTypeOptions: Array<{ value: BusinessType; label: string }> = [
  { value: 'salao', label: 'Salão de beleza' },
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'estetica', label: 'Estética' },
  { value: 'manicure', label: 'Manicure / Pedicure' },
  { value: 'spa', label: 'Spa / Bem-estar' },
  { value: 'clinica', label: 'Clínica / Consultório' },
  { value: 'oficina', label: 'Oficina automotiva' },
  { value: 'assistencia', label: 'Assistência técnica' },
  { value: 'atelie', label: 'Ateliê / Costura / Personalização' },
  { value: 'pet_shop', label: 'Pet shop / Banho e tosa' },
  { value: 'fotografia', label: 'Fotografia / Produção' },
  { value: 'servicos_residenciais', label: 'Serviços residenciais / Manutenção' },
  { value: 'academia', label: 'Academia / Personal' },
  { value: 'alimentacao', label: 'Alimentação / Encomendas' },
  { value: 'outro', label: 'Outro' },
];

const presets: Record<BusinessType, BusinessPreset> = {
  salao: { label: 'Salão de beleza', slogan: 'Beleza, agenda e relacionamento em movimento', services: [{ name: 'Corte feminino', minutes: 75, priceCents: 12000 }, { name: 'Escova', minutes: 50, priceCents: 7000 }, { name: 'Coloração', minutes: 150, priceCents: 28000 }] },
  barbearia: { label: 'Barbearia', slogan: 'Agenda cheia, atendimento rápido e caixa organizado', services: [{ name: 'Corte masculino', minutes: 45, priceCents: 6500 }, { name: 'Barba', minutes: 30, priceCents: 4500 }, { name: 'Cabelo + barba', minutes: 70, priceCents: 10000 }] },
  estetica: { label: 'Estética', slogan: 'Atendimentos, clientes e caixa no mesmo fluxo', services: [{ name: 'Limpeza de pele', minutes: 75, priceCents: 15000 }, { name: 'Drenagem', minutes: 60, priceCents: 14000 }, { name: 'Massagem', minutes: 60, priceCents: 16000 }] },
  manicure: { label: 'Manicure / Pedicure', slogan: 'Horários e clientes organizados sem complicação', services: [{ name: 'Manicure', minutes: 60, priceCents: 5500 }, { name: 'Pedicure', minutes: 60, priceCents: 6500 }, { name: 'Mão + pé', minutes: 100, priceCents: 11000 }] },
  spa: { label: 'Spa / Bem-estar', slogan: 'Bem-estar para o cliente e organização para o negócio', services: [{ name: 'Massagem relaxante', minutes: 60, priceCents: 18000 }, { name: 'Drenagem', minutes: 60, priceCents: 16000 }, { name: 'Day spa', minutes: 180, priceCents: 45000 }] },
  clinica: { label: 'Clínica / Consultório', slogan: 'Agenda e relacionamento organizados no dia a dia', services: [{ name: 'Consulta', minutes: 60, priceCents: 18000 }, { name: 'Avaliação', minutes: 45, priceCents: 12000 }, { name: 'Retorno', minutes: 30, priceCents: 10000 }] },
  oficina: { label: 'Oficina automotiva', slogan: 'Serviços, ordens e caixa girando juntos', services: [{ name: 'Diagnóstico', minutes: 60, priceCents: 12000 }, { name: 'Troca de óleo', minutes: 60, priceCents: 18000 }, { name: 'Revisão', minutes: 120, priceCents: 35000 }] },
  assistencia: { label: 'Assistência técnica', slogan: 'Chamados, serviços e clientes sob controle', services: [{ name: 'Diagnóstico técnico', minutes: 45, priceCents: 8000 }, { name: 'Manutenção', minutes: 90, priceCents: 18000 }, { name: 'Instalação', minutes: 120, priceCents: 25000 }] },
  atelie: { label: 'Ateliê / Costura / Personalização', slogan: 'Encomendas, prazos e clientes organizados', services: [{ name: 'Ajuste', minutes: 60, priceCents: 9000 }, { name: 'Personalização', minutes: 90, priceCents: 15000 }, { name: 'Encomenda', minutes: 120, priceCents: 18000 }] },
  pet_shop: { label: 'Pet shop / Banho e tosa', slogan: 'Agenda dos pets, clientes e caixa no mesmo lugar', services: [{ name: 'Banho', minutes: 60, priceCents: 7000 }, { name: 'Tosa', minutes: 90, priceCents: 9500 }, { name: 'Banho + tosa', minutes: 120, priceCents: 15000 }] },
  fotografia: { label: 'Fotografia / Produção', slogan: 'Ensaios, eventos e caixa em um fluxo simples', services: [{ name: 'Ensaio', minutes: 90, priceCents: 35000 }, { name: 'Fotos profissionais', minutes: 60, priceCents: 25000 }, { name: 'Evento', minutes: 240, priceCents: 80000 }] },
  servicos_residenciais: { label: 'Serviços residenciais / Manutenção', slogan: 'Visitas, serviços e recebimentos organizados', services: [{ name: 'Visita técnica', minutes: 60, priceCents: 12000 }, { name: 'Manutenção', minutes: 90, priceCents: 18000 }, { name: 'Instalação', minutes: 120, priceCents: 25000 }] },
  academia: { label: 'Academia / Personal', slogan: 'Alunos, horários e recebimentos em movimento', services: [{ name: 'Avaliação física', minutes: 60, priceCents: 12000 }, { name: 'Aula personal', minutes: 60, priceCents: 10000 }, { name: 'Pacote mensal', minutes: 60, priceCents: 40000 }] },
  alimentacao: { label: 'Alimentação / Encomendas', slogan: 'Encomendas, clientes e caixa organizados', services: [{ name: 'Encomenda', minutes: 60, priceCents: 10000 }, { name: 'Coffee break', minutes: 120, priceCents: 30000 }, { name: 'Buffet pequeno', minutes: 180, priceCents: 45000 }] },
  outro: { label: 'Outro', slogan: 'Agenda, caixa e clientes no mesmo lugar', services: [{ name: 'Serviço', minutes: 60, priceCents: 10000 }] },
};

export function businessTypeLabel(type: BusinessType, customType?: string) {
  return type === 'outro' && customType?.trim() ? customType.trim() : presets[type].label;
}

export function defaultBusinessSlogan(type: BusinessType) {
  return presets[type].slogan;
}

export function suggestedServices(type: BusinessType) {
  return presets[type].services.map((service, index) => ({ id: `s-${type}-${index + 1}`, ...service }));
}