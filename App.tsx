import React, { useMemo, useState } from "react";

/** ---------- helpers ---------- */
function makeRNG(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 123456789;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function randBetween(
  rng: () => number,
  min: number,
  max: number,
  decimals = 2
) {
  const v = min + (max - min) * rng();
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function fmt(n: number, dp = 2) {
  const isNeg = n < 0;
  const s = Math.abs(n).toFixed(dp);
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${isNeg ? "-" : ""}${parts.join(".")}`;
}
function currency(n: number, dp = 0, sym = "£") {
  return `${sym}${fmt(n, dp)}`;
}
const Box: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      background: "#fff",
    }}
  >
    {children}
  </div>
);
const Label: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{children}</div>
);
const Pill: React.FC<{ children: React.ReactNode; bg?: string }> = ({
  children,
  bg = "#eef",
}) => (
  <span
    style={{
      background: bg,
      padding: "4px 8px",
      borderRadius: 999,
      fontSize: 12,
      marginRight: 8,
    }}
  >
    {children}
  </span>
);

/** ---------- DCF ---------- */
function genDCFCase(seed: string) {
  const rng = makeRNG("DCF" + seed);
  const namePool = [
    "Northland Foods plc",
    "MetroMart Group",
    "BritFresh Beverages",
    "Crown Household plc",
    "Greenfield Staples",
    "PrimeCare & Home",
  ];
  const company = namePool[Math.floor(rng() * namePool.length)];
  const rev0 = randBetween(rng, 3000, 8000, 0);
  const ebitMargin = randBetween(rng, 0.1, 0.25, 3);
  const taxRate = randBetween(rng, 0.2, 0.28, 3);
  const daPct = randBetween(rng, 0.03, 0.06, 3);
  const capexPct = randBetween(rng, 0.03, 0.07, 3);
  const nwcPct = randBetween(rng, 0.08, 0.15, 3);
  const wacc = randBetween(rng, 0.07, 0.1, 3);
  const g = randBetween(rng, 0.02, 0.03, 3);
  const netDebt = randBetween(rng, 500, 2000, 0);
  const shares = randBetween(rng, 800, 1800, 0);
  const gStart = randBetween(rng, 0.08, 0.12, 3);
  const gEnd = randBetween(rng, 0.03, 0.06, 3);
  const growth: number[] = Array.from(
    { length: 5 },
    (_, i) => gStart + (i * (gEnd - gStart)) / 4
  );

  let revenue = rev0;
  const fcf: number[] = [];
  for (let t = 1; t <= 5; t++) {
    revenue = Math.round(revenue * (1 + growth[t - 1]));
    const ebit = revenue * ebitMargin;
    const nopat = ebit * (1 - taxRate);
    const da = revenue * daPct;
    const capex = revenue * capexPct;
    const nwc = revenue * nwcPct;
    const prevRevenue =
      t === 1 ? rev0 : Math.round(revenue / (1 + growth[t - 1]));
    const prevNwc = prevRevenue * nwcPct;
    const deltaNwc = nwc - prevNwc;
    const freeCF = nopat + da - capex - deltaNwc;
    fcf.push(Math.round(freeCF));
  }
  const terminalFCF = fcf[4] * (1 + g);
  const terminalValue = terminalFCF / (wacc - g);
  const disc = (x: number, t: number) => x / Math.pow(1 + wacc, t);
  const pvFcf = fcf.map((x, i) => disc(x, i + 1));
  const pvTV = disc(terminalValue, 5);
  const EV = Math.round(pvFcf.reduce((a, b) => a + b, 0) + pvTV);
  const equityValue = EV - netDebt;
  const perShare = equityValue / shares;

  return {
    company,
    rev0,
    ebitMargin,
    wacc,
    g,
    netDebt,
    shares,
    fcf,
    terminalValue,
    EV,
    equityValue,
    perShare,
  };
}
function DCFModule({ seed }: { seed: string }) {
  const dcf = useMemo(() => genDCFCase(seed), [seed]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  function check() {
    const val = Number(answer);
    if (Number.isNaN(val)) return setFeedback("Enter a number");
    const err =
      Math.abs(val - dcf.perShare) / Math.max(1, Math.abs(dcf.perShare));
    setFeedback(
      err <= 0.05 ? "✅ Correct (±5%)" : `❌ Off by ${(err * 100).toFixed(1)}%`
    );
  }
  return (
    <div>
      <Box>
        <h3>DCF — {dcf.company}</h3>
        <div style={{ fontSize: 13, color: "#444" }}>
          Last Rev: {currency(dcf.rev0, 0)}m · EBIT margin {pct(dcf.ebitMargin)}{" "}
          · WACC {pct(dcf.wacc)} · g {pct(dcf.g)} · Net debt{" "}
          {currency(dcf.netDebt, 0)}m · Shares {fmt(dcf.shares, 0)}m
        </div>
      </Box>
      <Box>
        <Label>Fair Value / Share (£)</Label>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="e.g. 6.42"
        />
        <button onClick={check} style={{ marginLeft: 8 }}>
          Check
        </button>
        {feedback && <div style={{ marginTop: 8 }}>{feedback}</div>}
        <details style={{ marginTop: 8 }}>
          <summary>Show solution</summary>
          <div>
            FCF Y1–Y5: {dcf.fcf.map((x) => currency(x, 0) + "m").join(", ")}
          </div>
          <div>
            TV: {currency(dcf.terminalValue, 0)}m · EV: {currency(dcf.EV, 0)}m ·
            Equity: {currency(dcf.equityValue, 0)}m
          </div>
          <div>
            <b>Per share: £{dcf.perShare.toFixed(2)}</b>
          </div>
        </details>
      </Box>
    </div>
  );
}

/** ---------- LBO ---------- */
function genLBOCase(seed: string) {
  const rng = makeRNG("LBO" + seed);
  const namePool = [
    "Atlas Components",
    "Harbor Services",
    "Northern Tools",
    "BluePeak Systems",
    "VistaHome Retail",
    "Orion Diagnostics",
  ];
  const co = namePool[Math.floor(rng() * namePool.length)];
  const ebitda0 = randBetween(rng, 200, 600, 0);
  const entryMult = randBetween(rng, 8, 12, 2);
  const exitMult = entryMult + randBetween(rng, -1.0, 1.0, 2);
  const debtPct = randBetween(rng, 0.55, 0.7, 2);
  const rate = randBetween(rng, 0.07, 0.11, 3);
  const taxRate = randBetween(rng, 0.22, 0.28, 3);
  const daPctEBITDA = randBetween(rng, 0.04, 0.07, 3);
  const capexPctEBITDA = randBetween(rng, 0.2, 0.35, 3);
  const nwcPctEBITDA = randBetween(rng, 0.02, 0.06, 3);
  const growth = randBetween(rng, 0.05, 0.09, 3);
  return {
    co,
    ebitda0,
    entryMult,
    exitMult,
    debtPct,
    rate,
    taxRate,
    daPctEBITDA,
    capexPctEBITDA,
    nwcPctEBITDA,
    growth,
  } as const;
}
function computeLBO(p: ReturnType<typeof genLBOCase>) {
  const EV_entry = p.ebitda0 * p.entryMult;
  const Debt0 = EV_entry * p.debtPct;
  const Equity0 = EV_entry - Debt0;
  let debt = Debt0,
    ebitda = p.ebitda0;
  const schedule: {
    year: number;
    EBITDA: number;
    Interest: number;
    Taxes: number;
    Capex: number;
    DeltaNWC: number;
    FCF: number;
    DebtEnd: number;
  }[] = [];
  for (let y = 1; y <= 5; y++) {
    ebitda *= 1 + p.growth;
    const da = ebitda * p.daPctEBITDA;
    const ebit = ebitda - da;
    const interest = debt * p.rate;
    const taxable = Math.max(0, ebit - interest);
    const taxes = taxable * p.taxRate;
    const capex = ebitda * p.capexPctEBITDA;
    const dNWC = ebitda * p.nwcPctEBITDA;
    const fcf = ebitda - interest - taxes - capex - dNWC;
    const repay = Math.min(debt, Math.max(0, fcf));
    debt = Math.max(0, debt - repay);
    schedule.push({
      year: y,
      EBITDA: ebitda,
      Interest: interest,
      Taxes: taxes,
      Capex: capex,
      DeltaNWC: dNWC,
      FCF: fcf,
      DebtEnd: debt,
    });
  }
  const EV_exit = ebitda * p.exitMult;
  const EquityExit = EV_exit - debt;
  const MOIC = EquityExit / Equity0;
  const IRR = Math.pow(MOIC, 1 / 5) - 1;
  return { EV_entry, Debt0, Equity0, EV_exit, EquityExit, MOIC, IRR, schedule };
}
function LBOmodule({ seed }: { seed: string }) {
  const base = useMemo(() => genLBOCase(seed), [seed]);
  const [debtPct, setDebtPct] = useState(base.debtPct);
  const [exitMult, setExitMult] = useState(base.exitMult);
  const [growth, setGrowth] = useState(base.growth);
  const [capexPct, setCapexPct] = useState(base.capexPctEBITDA);
  const out = useMemo(
    () =>
      computeLBO({
        ...base,
        debtPct,
        exitMult,
        growth,
        capexPctEBITDA: capexPct,
      } as any),
    [base, debtPct, exitMult, growth, capexPct]
  );
  return (
    <div>
      <Box>
        <h3>LBO — {base.co}</h3>
      </Box>
      <Box>
        <Label>Debt %</Label>
        <input
          type="range"
          min={0.4}
          max={0.8}
          step={0.01}
          value={debtPct}
          onChange={(e) => setDebtPct(Number(e.target.value))}
        />
        <Label>Exit Multiple</Label>
        <input
          type="range"
          min={base.entryMult - 2}
          max={base.entryMult + 2}
          step={0.05}
          value={exitMult}
          onChange={(e) => setExitMult(Number(e.target.value))}
        />
        <Label>EBITDA CAGR</Label>
        <input
          type="range"
          min={0.03}
          max={0.12}
          step={0.001}
          value={growth}
          onChange={(e) => setGrowth(Number(e.target.value))}
        />
        <Label>Capex % EBITDA</Label>
        <input
          type="range"
          min={0.15}
          max={0.4}
          step={0.005}
          value={capexPct}
          onChange={(e) => setCapexPct(Number(e.target.value))}
        />
        <div style={{ marginTop: 8 }}>
          <div>
            Entry EV: {currency(out.EV_entry, 0)}m · Debt:{" "}
            {currency(out.Debt0, 0)}m · Equity: {currency(out.Equity0, 0)}m
          </div>
          <div>
            Exit EV: {currency(out.EV_exit, 0)}m · Equity Exit:{" "}
            {currency(out.EquityExit, 0)}m
          </div>
          <div>
            MOIC: {out.MOIC.toFixed(2)} · IRR: {(out.IRR * 100).toFixed(1)}%
          </div>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary>Year-by-year</summary>
          <div style={{ fontSize: 12 }}>
            {out.schedule.map((r) => (
              <div key={r.year}>
                Y{r.year}: EBITDA {currency(r.EBITDA, 0)}m · FCF{" "}
                {currency(r.FCF, 0)}m · Debt End {currency(r.DebtEnd, 0)}m
              </div>
            ))}
          </div>
        </details>
      </Box>
    </div>
  );
}

/** ---------- M&A Accretion/Dilution ---------- */
function genMADCase(seed: string) {
  const rng = makeRNG("MNA" + seed);
  const acqNames = [
    "Britannia Consumer plc",
    "NorthRiver Tech",
    "Union Transport",
    "Crown Health plc",
  ];
  const tgtNames = [
    "DailyFresh Ltd",
    "SwiftWare Ltd",
    "Arcadia Devices",
    "Coastal Care Ltd",
  ];
  const acquirer = acqNames[Math.floor(rng() * acqNames.length)];
  const target = tgtNames[Math.floor(rng() * tgtNames.length)];
  const tax = randBetween(rng, 0.22, 0.27, 3);
  const peA = randBetween(rng, 12, 22, 2);
  const epsA = randBetween(rng, 1.2, 3.5, 2);
  const sharesA = randBetween(rng, 600, 1600, 0);
  const priceA = epsA * peA;
  const epsT = randBetween(rng, 0.6, 2.0, 2);
  const sharesT = randBetween(rng, 200, 800, 0);
  const peOffer = randBetween(rng, 14, 22, 2);
  const rDebt = randBetween(rng, 0.05, 0.09, 3);
  const baseSynergy = randBetween(rng, 50, 300, 0);
  return {
    acquirer,
    target,
    tax,
    peA,
    epsA,
    sharesA,
    priceA,
    epsT,
    sharesT,
    peOffer,
    rDebt,
    baseSynergy,
  } as const;
}
function MADModule({ seed }: { seed: string }) {
  const c = useMemo(() => genMADCase(seed), [seed]);
  const equityValue = c.epsT * c.peOffer * c.sharesT; // £m
  const [stockPct, setStockPct] = useState(0.4);
  const [debtPct, setDebtPct] = useState(0.4);
  const cashPct = Math.max(0, 1 - stockPct - debtPct);
  const [synergy, setSynergy] = useState(c.baseSynergy);

  const niA = c.epsA * c.sharesA,
    niT = c.epsT * c.sharesT;
  const debtRaised = equityValue * debtPct;
  const afterTaxInterest = debtRaised * c.rDebt * (1 - c.tax);
  const stockIssuedValue = equityValue * stockPct;
  const newShares = stockIssuedValue / c.priceA;
  const synergiesAfterTax = synergy * (1 - c.tax);
  const proNI = niA + niT + synergiesAfterTax - afterTaxInterest;
  const proShares = c.sharesA + newShares;
  const proEPS = proNI / proShares;
  const accretion = proEPS / c.epsA - 1;

  const targetNI = c.epsA * proShares;
  const needAfterTax = Math.max(0, targetNI - (niA + niT) + afterTaxInterest);
  const breakevenSynergy = needAfterTax / (1 - c.tax);

  return (
    <div>
      <Box>
        <h3>M&A — EPS Accretion/Dilution</h3>
        <div style={{ fontSize: 13, color: "#444" }}>
          Acquirer: {c.acquirer} · Target: {c.target} · Offer P/E:{" "}
          {c.peOffer.toFixed(1)}x · Equity Value: {currency(equityValue, 0)}m
        </div>
      </Box>
      <Box>
        <Label>Stock %</Label>
        <input
          type="range"
          min={0}
          max={1 - debtPct}
          step={0.01}
          value={stockPct}
          onChange={(e) => setStockPct(Number(e.target.value))}
        />
        <Label>Debt %</Label>
        <input
          type="range"
          min={0}
          max={1 - stockPct}
          step={0.01}
          value={debtPct}
          onChange={(e) => setDebtPct(Number(e.target.value))}
        />
        <div style={{ fontSize: 12, margin: "6px 0" }}>
          Cash % = {pct(cashPct)}
        </div>
        <Label>Pre-tax Synergies (£m/yr)</Label>
        <input
          type="number"
          value={synergy}
          onChange={(e) => setSynergy(Number(e.target.value))}
        />
        <div style={{ marginTop: 8 }}>
          Pro EPS: £{proEPS.toFixed(2)} · Accretion:{" "}
          {(accretion * 100).toFixed(2)}%
        </div>
        <div style={{ marginTop: 6 }}>
          <Pill bg={accretion >= 0 ? "#e5f8e8" : "#fdecec"}>
            {accretion >= 0 ? "Accretive ✓" : "Dilutive"}
          </Pill>
          <Pill>Breakeven synergy ≈ {currency(breakevenSynergy, 0)}m</Pill>
        </div>
      </Box>
    </div>
  );
}

/** ---------- Hedge Fund Long/Short ---------- */
function genHFUniverse(seed: string) {
  const rng = makeRNG("HF" + seed);
  const tickers = [
    "ALFA",
    "BRAV",
    "CHAR",
    "DELT",
    "ECHO",
    "FOXT",
    "GOLF",
    "HOTL",
  ];
  return tickers.map((t) => ({
    t,
    mu: randBetween(rng, -0.05, 0.15, 3),
    sigma: randBetween(rng, 0.1, 0.4, 3),
  }));
}
function HFModule({ seed }: { seed: string }) {
  const uni = useMemo(() => genHFUniverse(seed), [seed]);
  const [weights, setWeights] = useState<number[]>(Array(uni.length).fill(0)); // -100..+100

  function setW(i: number, v: number) {
    const w = Math.max(-100, Math.min(100, v));
    setWeights((prev) => prev.map((x, idx) => (idx === i ? w : x)));
  }

  const gross = weights.reduce((a, b) => a + Math.abs(b), 0);
  const net = weights.reduce((a, b) => a + b, 0);
  const wDec = weights.map((w) => w / 100);
  const expRet = wDec.reduce((a, wi, i) => a + wi * uni[i].mu, 0);
  const vol = Math.sqrt(
    wDec.reduce((a, wi, i) => a + (wi * uni[i].sigma) ** 2, 0)
  ); // assume independence
  const sharpe = vol > 0 ? expRet / vol : 0;

  const passGross = gross <= 200,
    passNet = Math.abs(net) <= 20,
    passSharpe = sharpe >= 0.8;

  return (
    <div>
      <Box>
        <h3>Hedge Fund — Long/Short Sandbox</h3>
        <div style={{ overflowX: "auto", fontSize: 13 }}>
          {uni.map((u, i) => (
            <div
              key={u.t}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 100px 100px 150px",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <strong>{u.t}</strong>
              <span>μ {pct(u.mu)}</span>
              <span>σ {pct(u.sigma)}</span>
              <span>
                <input
                  type="number"
                  value={weights[i]}
                  onChange={(e) => setW(i, Number(e.target.value))}
                  style={{ width: 90 }}
                />{" "}
                %
              </span>
            </div>
          ))}
        </div>
      </Box>
      <Box>
        <div>
          Gross: {gross.toFixed(0)}% · Net: {net.toFixed(0)}% · Exp. Return:{" "}
          {(expRet * 100).toFixed(2)}% · Exp. Vol: {(vol * 100).toFixed(2)}% ·
          Sharpe: {sharpe.toFixed(2)}
        </div>
        <div style={{ marginTop: 6 }}>
          <Pill bg={passGross ? "#e5f8e8" : "#fdecec"}>
            {passGross ? "Gross ✓" : "Gross > 200%"}
          </Pill>
          <Pill bg={passNet ? "#e5f8e8" : "#fdecec"}>
            {passNet ? "Net ✓" : "Net out of range"}
          </Pill>
          <Pill bg={passSharpe ? "#e5f8e8" : "#fdecec"}>
            {passSharpe ? "Sharpe ✓" : "Sharpe < 0.8"}
          </Pill>
        </div>
      </Box>
    </div>
  );
}

/** ---------- VC Power-Law Fund ---------- */
function simulateVC(
  seed: string,
  fundSize: number,
  deals: number,
  reserveMult: number,
  skillTilt: number
) {
  const rng = makeRNG(
    "VC" +
      seed +
      ":" +
      Math.round(fundSize) +
      ":" +
      deals +
      ":" +
      reserveMult +
      ":" +
      skillTilt
  );
  let buckets = [
    { p: 0.55, min: 0.0, max: 0.2 },
    { p: 0.25, min: 0.5, max: 1.5 },
    { p: 0.15, min: 2.0, max: 5.0 },
    { p: 0.045, min: 5.0, max: 20.0 },
    { p: 0.005, min: 20.0, max: 100.0 },
  ];
  const tilt = Math.max(-2, Math.min(2, skillTilt));
  const shift = tilt * 0.05;
  if (shift !== 0) {
    const take = Math.min(Math.max(0, buckets[0].p - 0.05), Math.abs(shift));
    buckets[0].p -= take * Math.sign(shift);
    const dist = take * Math.sign(shift);
    const denom = buckets[2].p + buckets[3].p + buckets[4].p;
    [2, 3, 4].forEach((i) => (buckets[i].p += (buckets[i].p / denom) * dist));
  }
  const sumP = buckets.reduce((a, b) => a + b.p, 0);
  buckets = buckets.map((b) => ({ ...b, p: b.p / sumP }));

  const initialPerDeal = fundSize / (deals * (1 + reserveMult));
  const reservePool = fundSize - initialPerDeal * deals;

  let investedTotal = 0,
    returnedTotal = 0,
    hits10x = 0,
    topMultiple = 0;
  const results: number[] = [];
  for (let i = 0; i < deals; i++) {
    const r = rng();
    let cum = 0,
      chosen: { p: number; min: number; max: number } | null = null;
    for (const b of buckets) {
      cum += b.p;
      if (r <= cum && !chosen) chosen = b;
    }
    const mult = randBetween(rng, chosen!.min, chosen!.max, 3);
    results.push(mult);
    investedTotal += initialPerDeal;
    returnedTotal += initialPerDeal * mult;
    if (mult >= 10) hits10x += 1;
    topMultiple = Math.max(topMultiple, mult);
  }
  const winnersIdx = results
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m >= 2.0);
  if (winnersIdx.length > 0 && reservePool > 0) {
    const addPer = reservePool / winnersIdx.length;
    investedTotal += reservePool;
    winnersIdx.forEach((w) => {
      returnedTotal += addPer * w.m;
    });
  }
  const tvpi = returnedTotal / investedTotal;
  const years = 10;
  const irr = Math.pow(tvpi, 1 / years) - 1;
  return {
    investedTotal,
    returnedTotal,
    tvpi,
    irr,
    hits10x,
    topMultiple,
    results,
  } as const;
}
function VCModule({ seed }: { seed: string }) {
  const [fundSize, setFundSize] = useState(100);
  const [deals, setDeals] = useState(25);
  const [reserveMult, setReserveMult] = useState(1.5);
  const [skill, setSkill] = useState(0);
  const [run, setRun] = useState(0);
  const sim = useMemo(
    () => simulateVC(seed + ":" + run, fundSize, deals, reserveMult, skill),
    [seed, run, fundSize, deals, reserveMult, skill]
  );
  const passTVPI = sim.tvpi >= 3.0,
    passIRR = sim.irr >= 0.25;

  return (
    <div>
      <Box>
        <h3>VC — Power-Law Fund</h3>
        <Label>Fund Size (£m)</Label>
        <input
          type="number"
          value={fundSize}
          onChange={(e) => setFundSize(Number(e.target.value))}
        />
        <Label>Number of Initial Deals</Label>
        <input
          type="number"
          value={deals}
          onChange={(e) =>
            setDeals(Math.max(5, Math.min(60, Number(e.target.value))))
          }
        />
        <Label>Reserves Multiplier (× initial)</Label>
        <input
          type="range"
          min={0}
          max={2.5}
          step={0.1}
          value={reserveMult}
          onChange={(e) => setReserveMult(Number(e.target.value))}
        />
        <Label>Skill Tilt</Label>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.1}
          value={skill}
          onChange={(e) => setSkill(Number(e.target.value))}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setRun((r) => r + 1)}>Run Simulation</button>
        </div>
      </Box>
      <Box>
        <div>
          Invested: {currency(sim.investedTotal, 0)}m · Returned:{" "}
          {currency(sim.returnedTotal, 0)}m
        </div>
        <div>
          TVPI: {sim.tvpi.toFixed(2)}× · IRR(≈10y): {(sim.irr * 100).toFixed(1)}
          %
        </div>
        <div>
          #≥10×: {sim.hits10x} · Top outcome: {sim.topMultiple.toFixed(1)}×
        </div>
        <div style={{ marginTop: 6 }}>
          <Pill bg={passTVPI ? "#e5f8e8" : "#fdecec"}>
            {passTVPI ? "TVPI ✓" : "TVPI < 3×"}
          </Pill>
          <Pill bg={passIRR ? "#e5f8e8" : "#fdecec"}>
            {passIRR ? "IRR ✓" : "IRR < 25%"}
          </Pill>
        </div>
      </Box>
      <Box>
        <Label>Outcome Multiples</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sim.results.map((m, i) => (
            <span
              key={i}
              style={{
                background: "#f2f2f2",
                padding: "4px 8px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {m.toFixed(1)}×
            </span>
          ))}
        </div>
      </Box>
    </div>
  );
}

/** ---------- App Shell ---------- */
export default function App() {
  const tabs = ["DCF", "LBO", "M&A", "HF", "VC"] as const;
  type Tab = (typeof tabs)[number];
  const [tab, setTab] = useState<Tab>("DCF");
  const [seed, setSeed] = useState("1001");

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, Arial",
        background: "#f6f7fb",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 16,
          }}
        >
          <div>
            <h1>Finance Skill Simulator</h1>
            <div style={{ fontSize: 12, color: "#666" }}>
              DCF • LBO • M&amp;A EPS • Hedge Fund L/S • VC Power-Law
            </div>
          </div>
          <div>
            <Label>Case ID</Label>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: tab === t ? "#4f46e5" : "#fff",
                color: tab === t ? "#fff" : "#111",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "DCF" && <DCFModule seed={seed} />}
        {tab === "LBO" && <LBOmodule seed={seed} />}
        {tab === "M&A" && <MADModule seed={seed} />}
        {tab === "HF" && <HFModule seed={seed} />}
        {tab === "VC" && <VCModule seed={seed} />}

        <div style={{ fontSize: 12, color: "#777", marginTop: 16 }}>
          Tip: Change the Case ID for new random scenarios. In HF, balance
          gross/net; in VC, run multiple seeds to see power-law behavior.
        </div>
      </div>
    </div>
  );
}
