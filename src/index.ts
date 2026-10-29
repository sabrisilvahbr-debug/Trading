/**
 * Rodada de demonstracao em modo PAPER.
 *
 * Gera uma serie de precos sintetica, roda o backtest com custos, valida
 * fora da amostra, projeta cenarios e submete uma ordem ao Guardiao.
 * Nenhuma conexao de rede, nenhuma corretora, nenhum dinheiro.
 */

import { LIMITS, COSTS } from "./config/limits.js";
import { run, validate, type Bar } from "./intelligence/backtest.js";
import { project } from "./intelligence/montecarlo.js";
import { sizeByTargetVol } from "./intelligence/sizing.js";
import { annualizedVol, returns, sma } from "./intelligence/indicators.js";
import { evaluate } from "./risk/guardian.js";
import { AGENTS, ORDER_SENDERS } from "./agents/registry.js";
import { EventBus } from "./bus/eventbus.js";

function syntheticBars(n = 260, seed = 20261029): Bar[] {
  let a = seed | 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(6.283185307 * rnd());
  const bars: Bar[] = [{ t: 0, close: 42.8 }];
  for (let i = 1; i < n; i++) {
    const shock = i > 150 && i < 190 ? 2.1 : 1;
    bars.push({ t: i, close: Math.max(5, bars[i - 1]!.close * (1 + 0.00018 + 0.016 * shock * gauss())) });
  }
  return bars;
}

const crossover = (bars: readonly Bar[], i: number): 0 | 1 => {
  const closes = bars.map((b) => b.close);
  const fast = sma(closes, 10, i), slow = sma(closes, 30, i);
  return fast !== null && slow !== null && fast > slow ? 1 : 0;
};

const pct = (v: number, d = 2) => `${v >= 0 ? "+" : "-"}${Math.abs(v * 100).toFixed(d)}%`;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function main(): void {
  console.log("Mesa 25 — rodada PAPER com dados sinteticos. Nenhuma corretora conectada.\n");
  console.log(`Agentes registrados: ${AGENTS.length}. Autorizados a enviar ordem: ${ORDER_SENDERS.join(", ")}.\n`);

  const bars = syntheticBars();
  const bt = run(bars, crossover);
  console.log("BACKTEST (serie completa, so para comparacao)");
  console.log(`  retorno           ${pct(bt.totalReturn)}`);
  console.log(`  comprar e segurar ${pct(bt.buyAndHoldReturn)}`);
  console.log(`  drawdown maximo   ${pct(-bt.maxDrawdown)}`);
  console.log(`  sharpe / sortino  ${bt.sharpe.toFixed(2)} / ${bt.sortino.toFixed(2)}`);
  console.log(`  operacoes         ${bt.trades}`);
  console.log(`  custos pagos      ${brl(bt.costsPaidBrl)}`);
  console.log(`  meses negativos   ${(bt.negativeMonthsRate * 100).toFixed(0)}%`);
  console.log(`  pior dia          ${pct(bt.worstDay)}\n`);

  const v = validate(bars, crossover);
  console.log("VALIDACAO FORA DA AMOSTRA (o numero que decide)");
  console.log(`  treino     ${pct(v.inSample.totalReturn)}`);
  console.log(`  validacao  ${pct(v.outOfSample.totalReturn)}`);
  console.log(`  queda      ${(v.decay * 100).toFixed(0)}%`);
  console.log(`  promovida  ${v.promoted ? "SIM" : "NAO"}`);
  for (const r of v.reasons) console.log(`    - ${r}`);
  console.log();

  const s = project(bt.dailyReturns, 30);
  console.log("TRES CENARIOS — 30 pregoes, 4.000 reamostragens. Nao e previsao.");
  console.log(`  pessimista (P5)   ${pct(s.p5)}`);
  console.log(`  base (mediana)    ${pct(s.median)}`);
  console.log(`  otimista (P95)    ${pct(s.p95)}`);
  console.log(`  prob. de prejuizo ${(s.probLoss * 100).toFixed(0)}%`);
  console.log(`  VaR 95%           ${pct(-s.var95)}\n`);

  // Uma ordem passando pelo caminho completo.
  const capital = 10_000;
  const price = bars.at(-1)!.close;
  const vol = annualizedVol(returns(bars.map((b) => b.close)));
  const stop = price * 0.97;
  const qty = sizeByTargetVol({ capitalBrl: capital, price, stopPrice: stop, annualizedVol: vol });

  const bus = new EventBus();
  const intent = {
    symbol: "SINT3", side: "BUY" as const, quantity: qty, referencePrice: price, stopPrice: stop,
    reason: "Cruzamento de medias 10/30 para cima no fechamento anterior.",
    correlationId: "demo-1",
  };
  bus.publish("tecnico", "dimensionador", "signal", { symbol: "SINT3", direction: "long" }, "demo-1");
  bus.publish("dimensionador", "guardiao", "order_intent", intent, "demo-1");

  const verdict = evaluate(intent, {
    capitalBrl: capital, equityBrl: capital, peakEquityBrl: capital,
    dayPnlBrl: 0, grossExposureBrl: 0, openPositions: 0, borrowedBrl: 0,
  }, {
    quoteAgeMs: 1200, statusAgeMs: 300, sourceDivergence: 0.0008,
    halted: false, withinTradingHours: true, mode: "PAPER",
  });

  console.log("ORDEM SUBMETIDA AO GUARDIAO");
  console.log(`  ativo       SINT3 (sintetico)`);
  console.log(`  preco       ${brl(price)}   stop ${brl(stop)}`);
  console.log(`  volatilidade anualizada ${(vol * 100).toFixed(1)}%`);
  console.log(`  quantidade  ${qty}`);
  console.log(`  custo ida e volta ${(2 * (COSTS.brokerageRate + COSTS.halfSpread + COSTS.slippage) * 100).toFixed(3)}%`);
  if (verdict.approved) {
    console.log(`  veredito    APROVADO — financeiro ${brl(verdict.notional)}, risco ${brl(verdict.riskBrl)} (${(verdict.riskBrl / capital * 100).toFixed(2)}% do capital, teto ${(LIMITS.maxRiskPerTrade * 100).toFixed(1)}%)`);
    console.log("  execucao    simulada (modo PAPER). Em REAL, ainda esperaria aprovacao humana.");
  } else {
    console.log(`  veredito    RECUSADO [${verdict.code}] ${verdict.message}`);
  }
  bus.publish("guardiao", "executor", "verdict", verdict, "demo-1");

  const chain = bus.verify();
  console.log(`\nAUDITORIA  cadeia de hashes ${chain.ok ? `integra (${chain.records} registros)` : `QUEBRADA no registro ${chain.brokenAt}`}`);
  console.log("\nNada acima e recomendacao de investimento. Os precos sao gerados localmente.");
}

main();
