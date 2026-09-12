import { useState, type FormEvent } from 'react';
import { businessTypeOptions, type BusinessSetupValue, type BusinessType } from './businessProfiles';

type Props = {
  submitLabel: string;
  onSubmit: (value: BusinessSetupValue) => Promise<void> | void;
  onCancel?: () => void;
  initial?: Partial<BusinessSetupValue>;
};

export default function BusinessSetupForm({ submitLabel, onSubmit, onCancel, initial }: Props) {
  const [type, setType] = useState<BusinessType | ''>(initial?.type ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const responsibleName = String(data.get('responsibleName') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const city = String(data.get('city') ?? '').trim();
    const state = String(data.get('state') ?? '').trim().toUpperCase();
    const customType = String(data.get('customType') ?? '').trim();
    const teamSize = Number(data.get('teamSize'));
    if (!name || !type || !responsibleName || !phone || !city || state.length !== 2 || !Number.isFinite(teamSize) || teamSize < 1) {
      setError('Preencha nome, tipo de negócio, responsável, WhatsApp, cidade, UF e número de profissionais.');
      return;
    }
    if (type === 'outro' && !customType) {
      setError('Descreva o tipo do negócio ao escolher “Outro”.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name, type, customType: type === 'outro' ? customType : undefined, responsibleName, phone, city, state, teamSize: Math.min(100, Math.round(teamSize)) });
    } finally {
      setBusy(false);
    }
  };

  return <form className="form-grid business-setup-form" onSubmit={submit}>
    <div className="two-col"><label className="field"><span>Nome do negócio</span><input name="name" defaultValue={initial?.name ?? ''} placeholder="Ex.: Barbearia Central" required /></label><label className="field"><span>Tipo de negócio</span><select name="type" value={type} onChange={event => setType(event.target.value as BusinessType | '')} required><option value="" disabled>Selecione</option>{businessTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    {type === 'outro' && <label className="field"><span>Qual é o seu tipo de negócio?</span><input name="customType" defaultValue={initial?.customType ?? ''} placeholder="Ex.: Escola de idiomas" required /></label>}
    <div className="two-col"><label className="field"><span>Nome do responsável</span><input name="responsibleName" defaultValue={initial?.responsibleName ?? ''} placeholder="Seu nome" required /></label><label className="field"><span>Telefone / WhatsApp</span><input name="phone" defaultValue={initial?.phone ?? ''} inputMode="tel" placeholder="(51) 99999-9999" required /></label></div>
    <div className="business-location-grid"><label className="field"><span>Cidade</span><input name="city" defaultValue={initial?.city ?? ''} placeholder="Porto Alegre" required /></label><label className="field"><span>UF</span><input name="state" defaultValue={initial?.state ?? ''} maxLength={2} placeholder="RS" required /></label><label className="field"><span>Profissionais</span><input name="teamSize" type="number" min="1" max="100" defaultValue={initial?.teamSize ?? 1} required /></label></div>
    <p className="business-type-help">O Giro usa o segmento para sugerir serviços iniciais. Você pode alterar preços, duração e cadastrar novos serviços depois.</p>
    {error && <p className="form-error">{error}</p>}
    <div className="setup-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Criando…' : submitLabel}</button>{onCancel && <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Voltar</button>}</div>
  </form>;
}