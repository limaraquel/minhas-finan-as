import { useState, useEffect, useRef, useCallback } from "react";

const S = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const CATEGORIES = [
  { id: "alimentacao", label: "Alimentação", icon: "🍔", color: "#f97316" },
  { id: "transporte",  label: "Transporte",  icon: "🚗", color: "#3b82f6" },
  { id: "moradia",     label: "Moradia",     icon: "🏠", color: "#8b5cf6" },
  { id: "saude",       label: "Saúde",       icon: "💊", color: "#10b981" },
  { id: "educacao",    label: "Educação",    icon: "📚", color: "#06b6d4" },
  { id: "lazer",       label: "Lazer",       icon: "🎮", color: "#ec4899" },
  { id: "vestuario",   label: "Vestuário",   icon: "👕", color: "#a855f7" },
  { id: "tecnologia",  label: "Tecnologia",  icon: "📱", color: "#6366f1" },
  { id: "papelaria",   label: "Papelaria",   icon: "✏️", color: "#84cc16" },
  { id: "mercado",     label: "Mercado",     icon: "🛒", color: "#f59e0b" },
  { id: "eletronicos", label: "Eletrônicos", icon: "💻", color: "#0ea5e9" },
  { id: "outros",      label: "Outros",      icon: "💸", color: "#6b7280" },
];

const PAYMENTS = [
  { id: "inter_debito",  label: "Inter — Débito",  color: "#ff7a00" },
  { id: "inter_credito", label: "Inter — Crédito", color: "#ff7a00" },
  { id: "nubank",        label: "Nubank",           color: "#8a05be" },
  { id: "pix",           label: "Pix",              color: "#32bcad" },
  { id: "dinheiro",      label: "Dinheiro",         color: "#22c55e" },
  { id: "debito",        label: "Débito",           color: "#3b82f6" },
  { id: "credito",       label: "Crédito",          color: "#f97316" },
  { id: "outro",         label: "Outro",            color: "#9ca3af" },
];

const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const payById = (id) => PAYMENTS.find((p) => p.id === id) || PAYMENTS[PAYMENTS.length - 1];
const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().split("T")[0];
const thisMonth = () => today().substring(0, 7);
const addMonths = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1]}/${y}`;
};

// ── parcelas geradas a partir de um parcelamento ──────────────────
function gerarParcelas(p) {
  const parcelas = [];
  for (let i = 0; i < p.totalParcelas; i++) {
    const mes = addMonths(p.mesInicio, i);
    const dia = p.diaVencimento || "10";
    parcelas.push({
      id: `${p.id}_p${i + 1}`,
      parcelamentoId: p.id,
      desc: `${p.desc} (${i + 1}/${p.totalParcelas})`,
      valor: parseFloat((p.valorTotal / p.totalParcelas).toFixed(2)),
      categoria: p.categoria,
      pagamento: p.pagamento,
      tipo: "despesa",
      data: `${mes}-${dia.padStart(2, "0")}`,
      numeroParcela: i + 1,
    });
  }
  return parcelas;
}

async function parseTransactionFromText(text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `Você é um assistente financeiro. O usuário descreve uma transação em linguagem natural.
Responda SOMENTE com JSON válido, sem markdown, sem explicações.
Formato:
{
  "desc": "descrição curta",
  "valorTotal": 0.00,
  "categoria": "alimentacao|transporte|moradia|saude|educacao|lazer|vestuario|tecnologia|papelaria|mercado|eletronicos|outros",
  "pagamento": "inter_debito|inter_credito|nubank|pix|dinheiro|debito|credito|outro",
  "tipo": "despesa|receita",
  "data": "YYYY-MM-DD ou null",
  "parcelas": 1
}
Regras:
- "débito inter" / "inter débito" → inter_debito; "crédito inter" / "cartão inter" → inter_credito
- "nubank" → nubank; "pix" → pix; "dinheiro" → dinheiro
- Se não mencionar pagamento → inter_debito
- "hoje" → ${today()}, "ontem" → dia anterior, senão null
- Se mencionar parcelamento (3x, 6x, em X vezes) → preenche "parcelas" com o número
- Pão de queijo, lanche, café, restaurante → alimentacao`,
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.[0]?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ── UI helpers ────────────────────────────────────────────────────
function Badge({ color, children }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
function Card({ children, style = {} }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem", ...style }}>{children}</div>;
}
function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "var(--text)", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function ProgressBar({ pct, color = "#3b82f6" }) {
  return (
    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
    </div>
  );
}

const TABS = [
  { id: "dashboard",     icon: "📊", label: "Painel" },
  { id: "lancamento",    icon: "➕", label: "Lançar" },
  { id: "parcelamentos", icon: "💳", label: "Parcelas" },
  { id: "fixos",         icon: "🔁", label: "Fixos" },
  { id: "contas",        icon: "📅", label: "Contas" },
  { id: "historico",     icon: "📋", label: "Histórico" },
  { id: "ia",            icon: "🤖", label: "IA" },
  { id: "config",        icon: "⚙️", label: "Config" },
];

// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [lancamentos, setLancamentos] = useState([]);
  const [parcelamentos, setParcelamentos] = useState([]);
  const [fixos, setFixos] = useState([]);
  const [contas, setContas] = useState([]);
  const [config, setConfig] = useState({ salario: 0, meta: 20, nome: "Gabriel" });

  useEffect(() => {
    setLancamentos(S.get("fin_lanc") || []);
    setParcelamentos(S.get("fin_parc") || []);
    setFixos(S.get("fin_fixos") || []);
    setContas(S.get("fin_contas") || []);
    setConfig(S.get("fin_config") || { salario: 0, meta: 20, nome: "Gabriel" });
  }, []);

  const saveLanc = (arr) => { setLancamentos(arr); S.set("fin_lanc", arr); };
  const saveParc = (arr) => { setParcelamentos(arr); S.set("fin_parc", arr); };
  const saveFixos = (arr) => { setFixos(arr); S.set("fin_fixos", arr); };
  const saveContas = (arr) => { setContas(arr); S.set("fin_contas", arr); };
  const saveConfig = (cfg) => { setConfig(cfg); S.set("fin_config", cfg); };

  // parcelas virtuais de todos os parcelamentos ativos
  const todasParcelas = parcelamentos.flatMap(gerarParcelas);

  const addLancamento = useCallback((l) => {
    const novo = { ...l, id: Date.now() + Math.random() };
    saveLanc([...lancamentos, novo]);
    return novo;
  }, [lancamentos]);

  const addParcelamento = useCallback((p) => {
    const novo = { ...p, id: Date.now() };
    saveParc([...parcelamentos, novo]);
    return novo;
  }, [parcelamentos]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root { --bg:#0f0f13; --card:#1a1a22; --border:#2a2a38; --text:#f0f0f5; --muted:#6b6b80; --accent:#6366f1; }
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{background:#0f0f13;border:1px solid #2a2a38;color:#f0f0f5;border-radius:10px;padding:10px 12px;font-size:14px;font-family:'DM Sans',sans-serif;width:100%;outline:none;transition:border-color .2s}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        select option{background:#1a1a22}
        button{font-family:'DM Sans',sans-serif;cursor:pointer}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2a2a38;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp .25s ease forwards}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Olá, {config.nome} 👋</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Meu Dinheiro</div>
        </div>
        <div style={{ fontSize: 28 }}>💰</div>
      </div>

      <div style={{ padding: "1rem 1.25rem" }} className="fade-up" key={tab}>
        {tab === "dashboard"     && <Dashboard lancamentos={lancamentos} parcelamentos={parcelamentos} todasParcelas={todasParcelas} fixos={fixos} contas={contas} config={config} />}
        {tab === "lancamento"    && <Lancamento onAdd={addLancamento} onAddParc={addParcelamento} />}
        {tab === "parcelamentos" && <Parcelamentos parcelamentos={parcelamentos} todasParcelas={todasParcelas} onDelete={(id) => saveParc(parcelamentos.filter(p => p.id !== id))} />}
        {tab === "fixos"         && <Fixos fixos={fixos} onSave={saveFixos} />}
        {tab === "contas"        && <Contas contas={contas} onSave={saveContas} />}
        {tab === "historico"     && <Historico lancamentos={lancamentos} todasParcelas={todasParcelas} onDelete={(id) => saveLanc(lancamentos.filter(l => l.id !== id))} />}
        {tab === "ia"            && <IAChat onAdd={addLancamento} onAddParc={addParcelamento} />}
        {tab === "config"        && <Config config={config} onSave={saveConfig} onClear={() => saveLanc([])} />}
      </div>

      {/* bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#13131a", borderTop: "1px solid #2a2a38", display: "flex", justifyContent: "space-around", padding: "6px 0 max(8px,env(safe-area-inset-bottom))", zIndex: 100 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "2px 4px", color: tab === t.id ? "#6366f1" : "#6b6b80", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 40 }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════
function Dashboard({ lancamentos, parcelamentos, todasParcelas, fixos, contas, config }) {
  const mes = thisMonth();
  const doMes = lancamentos.filter(l => l.data?.startsWith(mes));
  const parcelasMes = todasParcelas.filter(p => p.data?.startsWith(mes));

  const despesasManual = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + +l.valor, 0);
  const despesasParcelas = parcelasMes.reduce((s, p) => s + +p.valor, 0);
  const totalDespesas = despesasManual + despesasParcelas;
  const receitas = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + +l.valor, 0);
  const baseRenda = config.salario > 0 ? config.salario : receitas;
  const saldo = baseRenda - totalDespesas;
  const metaVal = baseRenda * (config.meta / 100);
  const economPct = metaVal > 0 ? Math.round(((baseRenda - totalDespesas) / metaVal) * 100) : 0;

  // compromissos futuros (próximos 3 meses)
  const futuros = [];
  for (let i = 1; i <= 3; i++) {
    const m = addMonths(mes, i);
    const parcM = todasParcelas.filter(p => p.data?.startsWith(m));
    const fixoM = fixos.reduce((s, f) => s + +f.valor, 0);
    const total = parcM.reduce((s, p) => s + +p.valor, 0) + fixoM;
    if (total > 0) futuros.push({ mes: m, total, parcelas: parcM.length, fixos: fixos.length });
  }

  const urgentes = contas.filter(c => { if (c.paga) return false; const diff = (new Date(c.vencimento) - new Date()) / 86400000; return diff >= 0 && diff <= 7; });

  const porCat = {};
  [...doMes.filter(l => l.tipo === "despesa"), ...parcelasMes].forEach(l => {
    porCat[l.categoria] = (porCat[l.categoria] || 0) + +l.valor;
  });
  const catSorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MetricCard label="Saldo do mês" value={fmt(saldo)} accent={saldo >= 0 ? "#10b981" : "#ef4444"} />
        <MetricCard label="Gastos" value={fmt(totalDespesas)} accent="#f97316" sub={despesasParcelas > 0 ? `incl. ${fmt(despesasParcelas)} parcelas` : undefined} />
        <MetricCard label="Salário" value={fmt(baseRenda)} />
        <MetricCard label="Transações" value={doMes.length + parcelasMes.length} sub={monthLabel(mes)} />
      </div>

      {baseRenda > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Meta de economia</div>
            <span style={{ fontSize: 13, color: economPct >= 100 ? "#10b981" : "#f97316", fontWeight: 700 }}>{economPct}%</span>
          </div>
          <ProgressBar pct={economPct} color={economPct >= 100 ? "#10b981" : "#6366f1"} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Meta: {fmt(metaVal)} • Economizado: {fmt(Math.max(0, baseRenda - totalDespesas))}</div>
        </Card>
      )}

      {/* Compromissos futuros */}
      {futuros.length > 0 && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>💳 Compromissos futuros</div>
          {futuros.map(f => (
            <div key={f.mes} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{monthLabel(f.mes)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.parcelas} parcela{f.parcelas !== 1 ? "s" : ""} + {f.fixos} fixo{f.fixos !== 1 ? "s" : ""}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#f97316" }}>{fmt(f.total)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            Total nos próximos 3 meses: <strong style={{ color: "var(--text)" }}>{fmt(futuros.reduce((s, f) => s + f.total, 0))}</strong>
          </div>
        </Card>
      )}

      {urgentes.length > 0 && (
        <Card style={{ borderColor: "#ef444444", background: "#ef444411" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>⚠️ Contas vencendo em breve</div>
          {urgentes.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #ef444422" }}>
              <span>{c.nome}</span>
              <span style={{ color: "#ef4444", fontWeight: 600 }}>{fmt(c.valor)} · {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </Card>
      )}

      {catSorted.length > 0 && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Gastos por categoria</div>
          {catSorted.map(([catId, val]) => {
            const cat = catById(catId);
            const pct = totalDespesas > 0 ? (val / totalDespesas) * 100 : 0;
            return (
              <div key={catId} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{cat.icon} {cat.label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(val)} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({Math.round(pct)}%)</span></span>
                </div>
                <ProgressBar pct={pct} color={cat.color} />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// LANÇAMENTO
// ══════════════════════════════════════════════════════════════════
function Lancamento({ onAdd, onAddParc }) {
  const [modo, setModo] = useState("normal"); // normal | parcelado
  const [form, setForm] = useState({ tipo: "despesa", desc: "", valor: "", categoria: "alimentacao", pagamento: "inter_credito", data: today() });
  const [parc, setParc] = useState({ totalParcelas: "2", diaVencimento: "10" });
  const [ok, setOk] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setP = (k, v) => setParc(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.desc || !form.valor || !form.data) return;
    if (modo === "parcelado") {
      const mesInicio = form.data.substring(0, 7);
      onAddParc({ desc: form.desc, valorTotal: parseFloat(form.valor), categoria: form.categoria, pagamento: form.pagamento, mesInicio, totalParcelas: parseInt(parc.totalParcelas), diaVencimento: parc.diaVencimento });
      setOk(`✓ Parcelamento em ${parc.totalParcelas}x de ${fmt(parseFloat(form.valor) / parseInt(parc.totalParcelas))} criado!`);
    } else {
      onAdd({ ...form, valor: parseFloat(form.valor) });
      setOk("✓ Lançamento salvo!");
    }
    setForm(f => ({ ...f, desc: "", valor: "" }));
    setTimeout(() => setOk(""), 3000);
  };

  const valorParc = form.valor && parc.totalParcelas ? (parseFloat(form.valor) / parseInt(parc.totalParcelas)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* toggle modo */}
      <div style={{ display: "flex", gap: 8 }}>
        {["normal", "parcelado"].map(m => (
          <button key={m} onClick={() => setModo(m)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${modo === m ? "#6366f1" : "var(--border)"}`, background: modo === m ? "#6366f122" : "transparent", color: modo === m ? "#6366f1" : "var(--muted)", fontWeight: 600, fontSize: 13 }}>
            {m === "normal" ? "💸 Normal" : "💳 Parcelado"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {modo === "normal" && (
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>TIPO</div>
            <select value={form.tipo} onChange={e => set("tipo", e.target.value)}>
              <option value="despesa">💸 Despesa</option>
              <option value="receita">💰 Receita</option>
            </select>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>{modo === "parcelado" ? "MÊS DA 1ª PARCELA" : "DATA"}</div>
          {modo === "parcelado"
            ? <input type="month" value={form.data.substring(0, 7)} onChange={e => set("data", e.target.value + "-01")} />
            : <input type="date" value={form.data} onChange={e => set("data", e.target.value)} />}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>DESCRIÇÃO</div>
        <input placeholder={modo === "parcelado" ? "Ex: Tênis Nike, iPhone..." : "Ex: Almoço, uber..."} value={form.desc} onChange={e => set("desc", e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: modo === "parcelado" ? "1fr 1fr" : "1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>VALOR TOTAL (R$)</div>
          <input type="number" placeholder="0,00" step="0.01" min="0" value={form.valor} onChange={e => set("valor", e.target.value)} />
        </div>
        {modo === "parcelado" && (
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>Nº DE PARCELAS</div>
            <input type="number" min="2" max="48" value={parc.totalParcelas} onChange={e => setP("totalParcelas", e.target.value)} />
          </div>
        )}
      </div>

      {modo === "parcelado" && form.valor && valorParc > 0 && (
        <div style={{ background: "#6366f122", border: "1px solid #6366f144", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {parc.totalParcelas}x de <strong style={{ color: "#6366f1" }}>{fmt(valorParc)}</strong> &nbsp;•&nbsp; Total: {fmt(parseFloat(form.valor))}
        </div>
      )}

      {modo === "parcelado" && (
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>DIA DE VENCIMENTO</div>
          <input type="number" min="1" max="28" placeholder="10" value={parc.diaVencimento} onChange={e => setP("diaVencimento", e.target.value)} />
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>CATEGORIA</div>
        <select value={form.categoria} onChange={e => set("categoria", e.target.value)}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>PAGAMENTO</div>
        <select value={form.pagamento} onChange={e => set("pagamento", e.target.value)}>
          {PAYMENTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <button onClick={submit} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 700, fontSize: 15, marginTop: 4 }}>
        {modo === "parcelado" ? `Criar parcelamento em ${parc.totalParcelas}x` : "Salvar lançamento"}
      </button>
      {ok && <div style={{ textAlign: "center", color: "#10b981", fontWeight: 600, fontSize: 14 }}>{ok}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PARCELAMENTOS
// ══════════════════════════════════════════════════════════════════
function Parcelamentos({ parcelamentos, todasParcelas, onDelete }) {
  const mes = thisMonth();

  const totalComprometido = (p) => gerarParcelas(p).filter(x => x.data >= `${mes}-01`).reduce((s, x) => s + x.valor, 0);
  const parcelasPagas = (p) => gerarParcelas(p).filter(x => x.data < `${mes}-01`).length;

  // resumo por mês (próximos 6 meses)
  const resumoMeses = [];
  for (let i = 0; i <= 5; i++) {
    const m = addMonths(mes, i);
    const total = todasParcelas.filter(p => p.data?.startsWith(m)).reduce((s, p) => s + p.valor, 0);
    resumoMeses.push({ mes: m, total });
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Parcelamentos</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        {parcelamentos.length} ativo{parcelamentos.length !== 1 ? "s" : ""}
      </div>

      {/* Linha do tempo por mês */}
      {todasParcelas.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📅 Impacto nos próximos meses</div>
          {resumoMeses.map(r => (
            <div key={r.mes} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 52, fontSize: 12, fontWeight: 600, color: r.mes === mes ? "#6366f1" : "var(--text)", flexShrink: 0 }}>
                {monthLabel(r.mes)}{r.mes === mes ? " ←" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <ProgressBar pct={r.total > 0 ? Math.min(100, (r.total / (parcelamentos.reduce((s, p) => s + p.valorTotal / p.totalParcelas, 0) || 1)) * 100) : 0} color="#6366f1" />
              </div>
              <div style={{ width: 72, textAlign: "right", fontSize: 13, fontWeight: 600, color: r.total > 0 ? "#f97316" : "var(--muted)", flexShrink: 0 }}>
                {r.total > 0 ? fmt(r.total) : "—"}
              </div>
            </div>
          ))}
        </Card>
      )}

      {parcelamentos.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: 14 }}>
          Nenhum parcelamento ativo.<br />Use a aba ➕ para criar um.
        </div>
      )}

      {parcelamentos.map(p => {
        const cat = catById(p.categoria);
        const pay = payById(p.pagamento);
        const pagas = parcelasPagas(p);
        const restantes = p.totalParcelas - pagas;
        const pct = (pagas / p.totalParcelas) * 100;
        const comprometido = totalComprometido(p);

        return (
          <Card key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{cat.icon} {p.desc}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{pay.label} · desde {monthLabel(p.mesInicio)}</div>
              </div>
              <button onClick={() => onDelete(p.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, marginLeft: 8 }}>🗑️</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ background: "#0f0f13", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Valor total</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(p.valorTotal)}</div>
              </div>
              <div style={{ background: "#0f0f13", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Por parcela</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(p.valorTotal / p.totalParcelas)}</div>
              </div>
              <div style={{ background: "#0f0f13", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Falta pagar</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: restantes > 0 ? "#f97316" : "#10b981" }}>{fmt(comprometido)}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>{pagas} paga{pagas !== 1 ? "s" : ""}</span>
              <span>{restantes} restante{restantes !== 1 ? "s" : ""} de {p.totalParcelas}</span>
            </div>
            <ProgressBar pct={pct} color={restantes === 0 ? "#10b981" : "#6366f1"} />

            {/* lista de parcelas */}
            <div style={{ marginTop: 12 }}>
              {gerarParcelas(p).map((parc, i) => {
                const isPast = parc.data < today().substring(0, 7) + "-01";
                const isCurrent = parc.data.substring(0, 7) === mes;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)", opacity: isPast ? 0.4 : 1 }}>
                    <span style={{ color: isCurrent ? "#6366f1" : "var(--text)", fontWeight: isCurrent ? 700 : 400 }}>
                      {monthLabel(parc.data.substring(0, 7))} {isCurrent ? "← atual" : ""}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmt(parc.valor)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// GASTOS FIXOS
// ══════════════════════════════════════════════════════════════════
function Fixos({ fixos, onSave }) {
  const [form, setForm] = useState({ nome: "", valor: "", categoria: "moradia", pagamento: "inter_debito", dia: "5" });
  const [show, setShow] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const add = () => { if (!form.nome || !form.valor) return; onSave([...fixos, { ...form, id: Date.now(), valor: parseFloat(form.valor) }]); setForm({ nome: "", valor: "", categoria: "moradia", pagamento: "inter_debito", dia: "5" }); setShow(false); };
  const remove = (id) => onSave(fixos.filter(f => f.id !== id));
  const total = fixos.reduce((s, f) => s + +f.valor, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Gastos Fixos</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total: {fmt(total)}/mês</div>
        </div>
        <button onClick={() => setShow(!show)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13 }}>{show ? "Cancelar" : "+ Novo"}</button>
      </div>
      {show && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>NOME</div><input placeholder="Ex: Netflix, Aluguel..." value={form.nome} onChange={e => set("nome", e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>VALOR</div><input type="number" value={form.valor} onChange={e => set("valor", e.target.value)} /></div>
              <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>DIA VENC.</div><input type="number" min="1" max="31" value={form.dia} onChange={e => set("dia", e.target.value)} /></div>
            </div>
            <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>CATEGORIA</div><select value={form.categoria} onChange={e => set("categoria", e.target.value)}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
            <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>PAGAMENTO</div><select value={form.pagamento} onChange={e => set("pagamento", e.target.value)}>{PAYMENTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
            <button onClick={add} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700 }}>Adicionar</button>
          </div>
        </Card>
      )}
      {fixos.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: 14 }}>Nenhum gasto fixo cadastrado.</div>}
      {fixos.map(f => {
        const cat = catById(f.categoria);
        return (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 22, width: 36, textAlign: "center" }}>{cat.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{f.nome}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Todo dia {f.dia} · {payById(f.pagamento).label}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f97316" }}>{fmt(f.valor)}</div>
              <button onClick={() => remove(f.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 16, marginTop: 2 }}>🗑️</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CONTAS A PAGAR
// ══════════════════════════════════════════════════════════════════
function Contas({ contas, onSave }) {
  const [form, setForm] = useState({ nome: "", valor: "", vencimento: today() });
  const [show, setShow] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const add = () => { if (!form.nome || !form.vencimento) return; onSave([...contas, { ...form, id: Date.now(), paga: false, valor: parseFloat(form.valor) || 0 }]); setForm({ nome: "", valor: "", vencimento: today() }); setShow(false); };
  const toggle = (id) => onSave(contas.map(c => c.id === id ? { ...c, paga: !c.paga } : c));
  const remove = (id) => onSave(contas.filter(c => c.id !== id));
  const pending = contas.filter(c => !c.paga).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const paid = contas.filter(c => c.paga);
  const getStatus = (venc) => { const diff = (new Date(venc) - new Date()) / 86400000; if (diff < 0) return { label: "Vencida", color: "#ef4444" }; if (diff <= 3) return { label: "Urgente", color: "#f97316" }; if (diff <= 7) return { label: "Em breve", color: "#f59e0b" }; return { label: `${Math.ceil(diff)}d`, color: "var(--muted)" }; };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>Contas a Pagar</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{pending.length} pendente{pending.length !== 1 ? "s" : ""}</div></div>
        <button onClick={() => setShow(!show)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13 }}>{show ? "Cancelar" : "+ Nova"}</button>
      </div>
      {show && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>DESCRIÇÃO</div><input placeholder="Ex: Fatura Nubank, IPTU..." value={form.nome} onChange={e => set("nome", e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>VALOR</div><input type="number" value={form.valor} onChange={e => set("valor", e.target.value)} /></div>
              <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>VENCIMENTO</div><input type="date" value={form.vencimento} onChange={e => set("vencimento", e.target.value)} /></div>
            </div>
            <button onClick={add} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700 }}>Adicionar</button>
          </div>
        </Card>
      )}
      {pending.length === 0 && paid.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: 14 }}>Nenhuma conta cadastrada.</div>}
      {pending.map(c => { const s = getStatus(c.vencimento); return (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => toggle(c.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${s.color}`, background: "none", flexShrink: 0 }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{c.nome}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{c.valor > 0 ? fmt(c.valor) : "—"}</div><Badge color={s.color}>{s.label}</Badge></div>
          <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 16 }}>🗑️</button>
        </div>
      ); })}
      {paid.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>✅ Pagas</div>
          {paid.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", opacity: 0.5 }}>
              <button onClick={() => toggle(c.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #10b981", background: "#10b98133", flexShrink: 0, fontSize: 12 }}>✓</button>
              <div style={{ flex: 1, fontSize: 13, textDecoration: "line-through" }}>{c.nome}</div>
              <div style={{ fontSize: 13 }}>{c.valor > 0 ? fmt(c.valor) : "—"}</div>
              <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 14 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════════════════════════
function Historico({ lancamentos, todasParcelas, onDelete }) {
  const [mes, setMes] = useState(thisMonth());
  const [filtCat, setFiltCat] = useState("");
  const [filtTipo, setFiltTipo] = useState("");
  const [mostrarParcelas, setMostrarParcelas] = useState(true);

  const meses = [...new Set([...lancamentos.map(l => l.data?.substring(0, 7)), ...todasParcelas.map(p => p.data?.substring(0, 7))])].filter(Boolean).sort().reverse();
  if (!meses.includes(thisMonth())) meses.unshift(thisMonth());

  let items = lancamentos.filter(l => l.data?.startsWith(mes));
  if (mostrarParcelas) items = [...items, ...todasParcelas.filter(p => p.data?.startsWith(mes))];
  if (filtCat) items = items.filter(l => l.categoria === filtCat);
  if (filtTipo) items = items.filter(l => l.tipo === filtTipo);
  items = [...items].sort((a, b) => b.data.localeCompare(a.data));

  const totalMes = items.filter(l => l.tipo === "despesa").reduce((s, l) => s + +l.valor, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <select value={mes} onChange={e => setMes(e.target.value)}>{meses.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        <select value={filtCat} onChange={e => setFiltCat(e.target.value)}><option value="">Todas categorias</option>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={filtTipo} onChange={e => setFiltTipo(e.target.value)} style={{ flex: 1 }}><option value="">Todos</option><option value="despesa">Despesas</option><option value="receita">Receitas</option></select>
        <button onClick={() => setMostrarParcelas(!mostrarParcelas)} style={{ background: mostrarParcelas ? "#6366f122" : "transparent", border: `1px solid ${mostrarParcelas ? "#6366f1" : "var(--border)"}`, color: mostrarParcelas ? "#6366f1" : "var(--muted)", borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>
          💳 Parcelas
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        {items.length} lançamento{items.length !== 1 ? "s" : ""} · <strong style={{ color: "#f97316" }}>{fmt(totalMes)}</strong>
      </div>
      {items.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: 14 }}>Nenhum lançamento.</div>}
      {items.map((l, i) => {
        const cat = catById(l.categoria);
        const pay = payById(l.pagamento);
        const isParcela = !!l.parcelamentoId;
        return (
          <div key={l.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 20, width: 32, textAlign: "center", flexShrink: 0 }}>{l.tipo === "receita" ? "💰" : cat.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.desc}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")} · {l.tipo === "receita" ? "Receita" : pay.label}
                {isParcela && <span style={{ color: "#6366f1", marginLeft: 4 }}>· parcela</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: l.tipo === "receita" ? "#10b981" : "#f97316" }}>
                {l.tipo === "receita" ? "+" : "−"}{fmt(l.valor)}
              </div>
              {!isParcela && <button onClick={() => onDelete(l.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginTop: 2 }}>🗑️</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// IA CHAT
// ══════════════════════════════════════════════════════════════════
function IAChat({ onAdd, onAddParc }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Olá! 👋 Me conta o que você gastou e eu lanço automaticamente.\n\nExemplos:\n• \"gastei 12 reais no almoço no débito inter\"\n• \"comprei tênis por 300 reais em 3x no crédito inter\"\n• \"paguei 50 no uber com nubank\"\n• \"recebi salário de 3000\"" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const parsed = await parseTransactionFromText(text);
      if (!parsed.valorTotal || !parsed.desc) {
        setMsgs(m => [...m, { role: "assistant", text: "Hmm, não consegui identificar o valor ou a descrição. Tente novamente! Ex: \"gastei 15 reais no pão de queijo no débito inter\"" }]);
      } else if (parsed.parcelas > 1) {
        const mesInicio = (parsed.data || today()).substring(0, 7);
        const p = { desc: parsed.desc, valorTotal: parsed.valorTotal, categoria: parsed.categoria || "outros", pagamento: parsed.pagamento || "inter_credito", mesInicio, totalParcelas: parsed.parcelas, diaVencimento: "10" };
        onAddParc(p);
        const cat = catById(p.categoria);
        const pay = payById(p.pagamento);
        const valorParcela = parsed.valorTotal / parsed.parcelas;
        setMsgs(m => [...m, { role: "assistant", text: `✅ Parcelamento criado!\n\n${cat.icon} **${p.desc}**\n💳 ${parsed.parcelas}x de ${fmt(valorParcela)} = ${fmt(parsed.valorTotal)}\n📂 ${cat.label} · ${pay.label}\n📅 Início: ${monthLabel(mesInicio)}` }]);
      } else {
        const data = parsed.data || today();
        const lanc = { desc: parsed.desc, valor: parsed.valorTotal, categoria: parsed.categoria || "outros", pagamento: parsed.pagamento || "inter_debito", tipo: parsed.tipo || "despesa", data };
        onAdd(lanc);
        const cat = catById(lanc.categoria);
        const pay = payById(lanc.pagamento);
        setMsgs(m => [...m, { role: "assistant", text: `✅ Lançado!\n\n${cat.icon} **${lanc.desc}**\n💵 ${fmt(lanc.valor)}\n📂 ${cat.label} · ${pay.label}\n📅 ${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")}` }]);
      }
    } catch {
      setMsgs(m => [...m, { role: "assistant", text: "Ops, tive um problema ao processar. Tente de novo!" }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "#6366f1" : "var(--card)", border: m.role === "assistant" ? "1px solid var(--border)" : "none", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {m.text.split("**").map((seg, j) => j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px 16px 16px 4px", fontSize: 18 }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Gastei X em Y no cartão Z... ou comprei em 3x" style={{ flex: 1 }} />
        <button onClick={send} disabled={loading} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>→</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════
function Config({ config, onSave, onClear }) {
  const [form, setForm] = useState(config);
  const [ok, setOk] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => { onSave({ ...form, salario: parseFloat(form.salario) || 0, meta: parseFloat(form.meta) || 20 }); setOk("✓ Salvo!"); setTimeout(() => setOk(""), 2000); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Perfil</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>NOME</div><input value={form.nome || ""} onChange={e => set("nome", e.target.value)} /></div>
          <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>SALÁRIO LÍQUIDO (R$)</div><input type="number" value={form.salario || ""} onChange={e => set("salario", e.target.value)} /></div>
          <div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>META DE ECONOMIA (%)</div><input type="number" min="0" max="100" value={form.meta || 20} onChange={e => set("meta", e.target.value)} /></div>
        </div>
        <button onClick={save} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, width: "100%", marginTop: 12 }}>Salvar</button>
        {ok && <div style={{ textAlign: "center", color: "#10b981", marginTop: 8, fontWeight: 600 }}>{ok}</div>}
      </Card>
      <Card style={{ borderColor: "#ef444433" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>⚠️ Zona de perigo</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Apaga todos os lançamentos permanentemente.</div>
        <button onClick={() => { if (confirm("Tem certeza?")) onClear(); }} style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13 }}>Apagar todos os lançamentos</button>
      </Card>
    </div>
  );
}
