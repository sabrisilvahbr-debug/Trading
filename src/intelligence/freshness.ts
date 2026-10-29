/** Frescor do dado. Dado velho vira "sem dado", e sem dado o sistema nao opera. */

import { LIMITS } from "../config/limits.js";
import type { Quote } from "../types/messages.js";

export type Freshness =
  | { readonly ok: true; readonly ageMs: number }
  | { readonly ok: false; readonly ageMs: number; readonly reason: string };

export function checkQuote(quote: Quote, now: number = Date.now()): Freshness {
  const ageMs = now - quote.asOf;
  if (ageMs < 0) return { ok: false, ageMs, reason: "Carimbo de tempo no futuro: relogio da fonte fora de sincronia." };
  if (ageMs > LIMITS.maxQuoteAgeMs) return { ok: false, ageMs, reason: `Cotacao com ${(ageMs / 1000).toFixed(1)} s de idade.` };
  return { ok: true, ageMs };
}

/** Divergencia relativa entre duas fontes, medida sobre a mediana. */
export function divergence(a: number, b: number): number {
  const mid = (a + b) / 2;
  if (mid === 0) return Infinity;
  return Math.abs(a - b) / mid;
}

/** Preco consolidado: so existe se as duas fontes concordarem. */
export function consolidate(a: Quote, b: Quote, now: number = Date.now()):
  | { readonly ok: true; readonly price: number; readonly divergence: number }
  | { readonly ok: false; readonly reason: string } {
  const fa = checkQuote(a, now), fb = checkQuote(b, now);
  if (!fa.ok) return { ok: false, reason: `Fonte ${a.source}: ${fa.reason}` };
  if (!fb.ok) return { ok: false, reason: `Fonte ${b.source}: ${fb.reason}` };
  const d = divergence(a.price, b.price);
  if (d > LIMITS.maxSourceDivergence) {
    return { ok: false, reason: `Divergencia de ${(d * 100).toFixed(2)}% entre ${a.source} e ${b.source}.` };
  }
  return { ok: true, price: (a.price + b.price) / 2, divergence: d };
}
