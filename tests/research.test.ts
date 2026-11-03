import { test } from "node:test";
import assert from "node:assert/strict";
import { toOrderIntent, parseProposal } from "../src/research/proposal.js";

const ctx = { capitalBrl: 10_000, annualizedVol: 0.3, correlationId: "r1" };

const good = {
  symbol: "PETR4", side: "BUY", entry: 40, stop: 38.4, confidence: 0.8,
  dataUsed: ["fechamento diario 2026-10-30 (fonte: brapi, 30 min de atraso)"],
  rejectedAlternatives: ["venda: tendencia de alta"], reason: "cruzamento de medias",
};

test("proposta valida vira intencao de ordem com quantidade calculada em codigo", () => {
  const r = toOrderIntent(good, ctx);
  assert.equal(r.kind, "ordem");
  if (r.kind !== "ordem") return;
  assert.ok(r.intent.quantity > 0);
  assert.ok(r.intent.reason.startsWith("[pesquisa]"));
  assert.equal(r.intent.correlationId, "r1");
});

test("quantidade que o LLM sugere e ignorada", () => {
  const r = toOrderIntent({ ...good, quantity: 99999 }, ctx);
  assert.equal(r.kind, "rejeitado");
});

test("campo extra e recusado", () => {
  const r = toOrderIntent({ ...good, execute: true }, ctx);
  assert.equal(r.kind, "rejeitado");
});

test("campo obrigatorio ausente e recusado", () => {
  const { stop, ...semStop } = good;
  void stop;
  assert.equal(toOrderIntent(semStop, ctx).kind, "rejeitado");
});

test("ticker fora da B3 e recusado", () => {
  assert.equal(toOrderIntent({ ...good, symbol: "AAPL" }, ctx).kind, "rejeitado");
  assert.equal(toOrderIntent({ ...good, symbol: "petr4" }, ctx).kind, "rejeitado");
});

test("compra com stop acima da entrada e recusada", () => {
  assert.equal(toOrderIntent({ ...good, stop: 41 }, ctx).kind, "rejeitado");
});

test("venda com stop abaixo da entrada e recusada", () => {
  assert.equal(toOrderIntent({ ...good, side: "SELL", stop: 39 }, ctx).kind, "rejeitado");
});

test("confianca abaixo de 0,70 escala e nao vira ordem", () => {
  const r = toOrderIntent({ ...good, confidence: 0.6 }, ctx);
  assert.equal(r.kind, "escalado");
});

test("sem dados usados a proposta nao e auditavel e e recusada", () => {
  assert.equal(toOrderIntent({ ...good, dataUsed: [] }, ctx).kind, "rejeitado");
});

test("texto que nao e objeto e recusado sem lancar excecao", () => {
  assert.equal(toOrderIntent("compre PETR4 agora", ctx).kind, "rejeitado");
  assert.equal(toOrderIntent(null, ctx).kind, "rejeitado");
  assert.equal(parseProposal([]).ok, false);
});

test("capital insuficiente para uma unidade e recusado", () => {
  const r = toOrderIntent(good, { ...ctx, capitalBrl: 10 });
  assert.equal(r.kind, "rejeitado");
});
