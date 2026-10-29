import { test } from "node:test";
import assert from "node:assert/strict";
import { sma, rsi, annualizedVol, returns } from "../src/intelligence/indicators.js";
import { sizeByTargetVol, conservativeKelly } from "../src/intelligence/sizing.js";
import { consolidate, divergence, checkQuote } from "../src/intelligence/freshness.js";
import { run, validate, type Bar } from "../src/intelligence/backtest.js";
import { project } from "../src/intelligence/montecarlo.js";
import { score } from "../src/intelligence/reputation.js";

test("sma devolve null antes de haver amostra suficiente", () => {
  assert.equal(sma([1, 2, 3], 5, 2), null);
  assert.equal(sma([1, 2, 3], 3, 2), 2);
});

test("rsi fica em 100 quando so ha alta", () => {
  const up = Array.from({ length: 20 }, (_, i) => 10 + i);
  assert.equal(rsi(up, 14), 100);
});

test("volatilidade de uma serie constante e zero", () => {
  assert.equal(annualizedVol(returns([10, 10, 10, 10])), 0);
});

test("dimensionamento nunca passa do teto de risco por operacao", () => {
  const qty = sizeByTargetVol({ capitalBrl: 10_000, price: 40, stopPrice: 38, annualizedVol: 0.3 });
  assert.ok(qty * Math.abs(40 - 38) <= 10_000 * 0.01 + 1e-9, "risco acima de 1% do capital");
});

test("dimensionamento devolve zero quando nao ha capital", () => {
  assert.equal(sizeByTargetVol({ capitalBrl: 0, price: 40, stopPrice: 38, annualizedVol: 0.3 }), 0);
});

test("kelly devolve zero quando a estrategia nao tem vantagem", () => {
  assert.equal(conservativeKelly(0.4, 1), 0);
  assert.ok(conservativeKelly(0.6, 2) <= 0.25);
});

test("consolidacao falha quando as fontes divergem demais", () => {
  const now = Date.now();
  const a = { symbol: "X", price: 100, source: "A", asOf: now };
  const b = { symbol: "X", price: 101, source: "B", asOf: now };
  assert.equal(consolidate(a, b, now).ok, false);
  assert.ok(divergence(100, 101) > 0.005);
});

test("cotacao velha nao passa no frescor", () => {
  const now = Date.now();
  assert.equal(checkQuote({ symbol: "X", price: 1, source: "A", asOf: now - 60_000 }, now).ok, false);
  assert.equal(checkQuote({ symbol: "X", price: 1, source: "A", asOf: now - 1_000 }, now).ok, true);
});

test("carimbo de tempo no futuro e tratado como falha", () => {
  const now = Date.now();
  assert.equal(checkQuote({ symbol: "X", price: 1, source: "A", asOf: now + 5_000 }, now).ok, false);
});

test("backtest cobra custo em cada troca de posicao", () => {
  const bars: Bar[] = Array.from({ length: 80 }, (_, i) => ({ t: i, close: 100 }));
  const alterna = (_: readonly Bar[], i: number): 0 | 1 => (i % 2 === 0 ? 1 : 0);
  const r = run(bars, alterna);
  assert.ok(r.costsPaidBrl > 0, "operar num preco parado deveria custar dinheiro");
  assert.ok(r.totalReturn < 0, "sem movimento de preco, so sobra o atrito");
});

test("estrategia que so funciona no treino nao e promovida", () => {
  // sobe na primeira metade, cai na segunda: o cruzamento quebra fora da amostra
  const bars: Bar[] = Array.from({ length: 200 }, (_, i) => ({
    t: i, close: i < 100 ? 100 + i : 200 - (i - 100) * 1.2,
  }));
  const cross = (b: readonly Bar[], i: number): 0 | 1 => {
    const c = b.map((x) => x.close);
    const f = sma(c, 5, i), s = sma(c, 20, i);
    return f !== null && s !== null && f > s ? 1 : 0;
  };
  const v = validate(bars, cross);
  assert.equal(v.promoted, false);
  assert.ok(v.reasons.length > 0);
});

test("monte carlo e reprodutivel com a mesma semente", () => {
  const r = [0.01, -0.02, 0.015, -0.005, 0.008];
  assert.deepEqual(project(r, 10, 500, 7), project(r, 10, 500, 7));
});

test("monte carlo com serie vazia nao inventa cenario", () => {
  const s = project([], 30);
  assert.equal(s.paths, 0);
  assert.equal(s.median, 0);
});

test("plataforma que promete lucro e bloqueada com nota zero", () => {
  const s = score({
    promisesReturns: true, regulated: true, withdrawalBlocked: false,
    urgencyPressure: false, transparentFees: true, yearsOperating: 10,
    unresolvedComplaints: 0, hasSandbox: true, apiKeyWithoutWithdrawal: true,
  });
  assert.equal(s.score, 0);
  assert.equal(s.blocked, true);
});

test("corretora sem registro e bloqueada mesmo sem outros problemas", () => {
  const s = score({
    promisesReturns: false, regulated: false, withdrawalBlocked: false,
    urgencyPressure: false, transparentFees: true, yearsOperating: 8,
    unresolvedComplaints: 0, hasSandbox: true, apiKeyWithoutWithdrawal: true,
  });
  assert.equal(s.blocked, true);
});

test("corretora regulada e transparente passa do corte", () => {
  const s = score({
    promisesReturns: false, regulated: true, withdrawalBlocked: false,
    urgencyPressure: false, transparentFees: true, yearsOperating: 10,
    unresolvedComplaints: 1, hasSandbox: true, apiKeyWithoutWithdrawal: true,
  });
  assert.equal(s.blocked, false);
  assert.ok(s.score >= 70);
});

test("chave com permissao de saque derruba a nota abaixo do corte", () => {
  const s = score({
    promisesReturns: false, regulated: true, withdrawalBlocked: false,
    urgencyPressure: false, transparentFees: true, yearsOperating: 5,
    unresolvedComplaints: 0, hasSandbox: true, apiKeyWithoutWithdrawal: false,
  });
  assert.equal(s.blocked, true);
});
