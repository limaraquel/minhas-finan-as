# 💰 Meu Dinheiro — App de Finanças Pessoais

App PWA de controle financeiro pessoal com IA integrada.

## Funcionalidades

- 📊 **Painel** — Resumo do mês, meta de economia, gastos por categoria
- ➕ **Lançar** — Registro manual de despesas e receitas
- 🔁 **Gastos Fixos** — Netflix, aluguel, assinaturas com dia de vencimento
- 📅 **Contas a Pagar** — Controle de vencimentos com alertas
- 📋 **Histórico** — Filtros por mês, categoria e tipo
- 🤖 **IA** — Fala em linguagem natural e a IA lança automaticamente
- ⚙️ **Config** — Salário, meta de economia, nome

## Deploy no Vercel

### Opção 1 — Via GitHub (recomendado)

1. Crie um repositório no GitHub e faça push desta pasta
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Vercel detecta Vite automaticamente — só clique em **Deploy**

### Opção 2 — Via Vercel CLI

```bash
npm install -g vercel
cd meu-dinheiro
npm install
vercel
```

## Rodar localmente

```bash
npm install
npm run dev
```

## IA — Como usar

Na aba 🤖 IA, escreva em linguagem natural:

- "gastei 12 reais no almoço no débito inter"
- "paguei 89 no Spotify no nubank"
- "recebi salário de 4500"
- "gastei 2 reais numa caneta no crédito inter"

A IA identifica descrição, valor, categoria e forma de pagamento automaticamente.

## Tecnologias

- React 18 + Vite
- localStorage para persistência
- Claude API (Anthropic) para o chat de IA
- Deploy: Vercel
