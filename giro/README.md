# Giro

**Agenda, caixa e clientes para o pequeno negócio.**

Aplicação SaaS/PWA em português do Brasil para pequenos negócios de serviços. O Giro combina agenda, caixa, clientes, ordens, equipe, sincronização em nuvem, backups, cobrança de planos pelo Asaas e um painel administrativo exclusivo do CEO.

- Produção: https://giro-7zo683.v2.appdeploy.ai/
- Desenvolvedor: Carlos Alisson Silva Falcão Lins
- CEO / Administrador: silvafalcaolins@gmail.com
- Stack: React 19, TypeScript, Vite, AppDeploy Auth/Database/Secrets, Asaas, PWA

## Funcionalidades

- Cadastro inicial por segmento com presets de serviços.
- Agenda de 14 dias, profissionais e bloqueio de conflito de horários.
- Caixa com entradas/saídas e lançamento automático ao concluir atendimento.
- Clientes com busca, histórico de visitas e WhatsApp.
- Ordens em fluxo Orçamento → Em andamento → Pronto → Entregue.
- Múltiplos profissionais e múltiplos negócios por conta.
- Modo local e Giro Cloud com autenticação.
- Backup manual e automático diário.
- Pix do próprio estabelecimento via EMV Copia e Cola.
- Planos Pro e Negócio com assinatura mensal Pix pelo Asaas.
- Webhook Asaas autenticado e idempotente.
- Painel CEO com contas, empresas, segmentos, planos, Asaas e auditoria.
- PWA instalável em celular e desktop.

## Segurança

O código deste repositório **não contém credenciais reais**. A chave `ASAAS_API_KEY` é configurada como segredo no backend da plataforma. O webhook gera token aleatório e armazena apenas seu hash SHA-256. Rotas administrativas são protegidas por autenticação e allowlist de e-mail.

## Estrutura

```text
giro/
├── backend/index.ts              # API, banco, segurança, Asaas e painel CEO
├── src/Giro.tsx                  # aplicação operacional
├── src/AdminPanel.tsx            # painel administrativo do CEO
├── src/BusinessSetupForm.tsx     # onboarding do negócio
├── src/businessProfiles.ts       # segmentos e serviços sugeridos
├── src/giro.css                  # interface responsiva
├── public/                       # PWA, ícone e service worker
└── tests/tests.txt               # cenários de QA
```

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

O projeto usa `@appdeploy/client` no frontend e `@appdeploy/sdk` no backend. Esses módulos são injetados pela plataforma de implantação e não aparecem como dependências no `package.json`.

## Planos

- Pro: R$ 39,90/mês
- Negócio: R$ 79,90/mês

## Observação sobre esta cópia

Esta pasta é uma cópia integral do snapshot de produção do Giro, sem segredos. O app publicado continua sendo gerenciado pela infraestrutura de deploy utilizada no projeto.
