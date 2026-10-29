import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, requiresHumanApproval, type MarketContext } from "../src/risk/guardian.js";
import type { OrderIntent, PortfolioState } from "../src/types/messages.js";

const portfolio: PortfolioState = {
  capitalBrl: 10_000, equityBrl: 10_000, peakEquityBrl: 10_000,
  dayPnlBrl: 0, grossExposureBrl: 0, openPositions: 0, borrowedBrl: 0,
};
const market: MarketContext = {
  quoteAgeMs: 1000, statusAgeMs: 200, sourceDivergence: 0.001,
  halted: false, withinTradingHours: true, mode: "PAPER",
};
const intent: OrderIntent = {
  symbol: "SINT3", side: "BUY", quantity: 50, referencePrice: 40,
  stopPrice: 38.4, reason: "teste", correlationId: "t1",
};

test("aprova ordem dentro de todos os limites", () => {
  const v = evaluate(intent, portfolio, market);
  assert.equal(v.approved, true);
});

test("recusa ordem sem stop", () => {
  const v = evaluate({ ...intent, stopPrice: 0 }, portfolio, market);
  assert.equal(v.approved, false);
  assert.equal(v.approved === false && v.code, "SEM_STOP");
});

test("recusa quando a cotacao esta velha", () => {
  const v = evaluate(intent, portfolio, { ...market, quoteAgeMs: 20_000 });
  assert.equal(v.approved === false && v.code, "DADO_VELHO");
});

test("recusa quando as fontes divergem acima de 0,5%", () => {
  const v = evaluate(intent, portfolio, { ...market, sourceDivergence: 0.009 });
  assert.equal(v.approved === false && v.code, "DIVERGENCIA_FONTES");
});

test("recusa durante halt de mercado", () => {
  const v = evaluate(intent, portfolio, { ...market, halted: true });
  assert.equal(v.approved === false && v.code, "MERCADO_PARADO");
});

test("recusa fora do horario de negociacao", () => {
  const v = evaluate(intent, portfolio, { ...market, withinTradingHours: false });
  assert.equal(v.approved === false && v.code, "FORA_DO_HORARIO");
});

test("recusa quando o risco passa de 1% do capital", () => {
  // stop a 10% do preco: risco de 200 BRL em 10.000 = 2%
  const v = evaluate({ ...intent, stopPrice: 36 }, portfolio, market);
  assert.equal(v.approved === false && v.code, "RISCO_POR_OPERACAO");
});

test("recusa quando o stop diario ja foi atingido", () => {
  const v = evaluate(intent, { ...portfolio, dayPnlBrl: -210 }, market);
  assert.equal(v.approved === false && v.code, "STOP_DIARIO");
});

test("recusa quando o drawdown chega a 10%", () => {
  const v = evaluate(intent, { ...portfolio, equityBrl: 9_000, peakEquityBrl: 10_000 }, market);
  assert.equal(v.approved === false && v.code, "DRAWDOWN");
});

test("recusa quando a exposicao passaria de 60%", () => {
  const v = evaluate(intent, { ...portfolio, grossExposureBrl: 5_000 }, market);
  assert.equal(v.approved === false && v.code, "EXPOSICAO");
});

test("recusa qualquer alavancagem: dinheiro emprestado bloqueia a compra", () => {
  const v = evaluate(intent, { ...portfolio, borrowedBrl: 1 }, market);
  assert.equal(v.approved === false && v.code, "ALAVANCAGEM");
});

test("recusa quando o custo de ida e volta engole a distancia ate o stop", () => {
  const v = evaluate({ ...intent, stopPrice: 39.995 }, portfolio, market);
  assert.equal(v.approved === false && v.code, "CUSTO_MAIOR_QUE_ALVO");
});

test("recusa quantidade zero ou negativa", () => {
  assert.equal(evaluate({ ...intent, quantity: 0 }, portfolio, market).approved, false);
  assert.equal(evaluate({ ...intent, quantity: -5 }, portfolio, market).approved, false);
});

test("modo REAL exige aprovacao humana alem do Guardiao", () => {
  assert.equal(requiresHumanApproval("REAL"), true);
  assert.equal(requiresHumanApproval("PAPER"), false);
  assert.equal(requiresHumanApproval("PILOTO"), false);
});

test("o veredito nao depende de ordem de chamada nem muda entre execucoes", () => {
  const a = evaluate(intent, portfolio, market);
  const b = evaluate(intent, portfolio, market);
  assert.deepEqual(a, b);
});
