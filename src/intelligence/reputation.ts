/**
 * Nota de reputacao de plataforma (0-100).
 *
 * Existe para barrar o padrao mais comum de perda total: a corretora ou o
 * "sinal" que promete retorno. Alguns criterios zeram a nota sozinhos —
 * nao ha ponderacao que salve quem promete lucro garantido.
 */

import { LIMITS } from "../config/limits.js";

export interface ProviderFacts {
  /** Promete lucro, retorno fixo ou taxa de acerto. Reprovacao automatica. */
  readonly promisesReturns: boolean;
  /** Registro ativo na CVM ou no regulador do pais de origem. */
  readonly regulated: boolean;
  /** Ja houve relato de saque negado ou travado. Reprovacao automatica. */
  readonly withdrawalBlocked: boolean;
  /** Usa pressao de urgencia, bonus por deposito, "vagas limitadas". */
  readonly urgencyPressure: boolean;
  /** Tabela de custos publica e completa. */
  readonly transparentFees: boolean;
  /** Anos de operacao verificaveis. */
  readonly yearsOperating: number;
  /** Reclamacoes nao resolvidas nos ultimos 12 meses. */
  readonly unresolvedComplaints: number;
  /** Oferece ambiente de testes com dinheiro ficticio. */
  readonly hasSandbox: boolean;
  /** Permite criar chave de API sem permissao de saque. */
  readonly apiKeyWithoutWithdrawal: boolean;
}

export interface ReputationScore {
  readonly score: number;
  readonly blocked: boolean;
  readonly disqualifiers: readonly string[];
  readonly notes: readonly string[];
}

export function score(f: ProviderFacts): ReputationScore {
  const disqualifiers: string[] = [];
  if (f.promisesReturns) disqualifiers.push("Promete lucro, retorno fixo ou taxa de acerto.");
  if (f.withdrawalBlocked) disqualifiers.push("Historico de saque negado ou travado.");
  if (!f.regulated) disqualifiers.push("Sem registro no regulador (CVM ou equivalente).");

  if (disqualifiers.length > 0) {
    return { score: 0, blocked: true, disqualifiers, notes: ["Integracao bloqueada em codigo. Nenhum ajuste de parametro libera."] };
  }

  const notes: string[] = [];
  let s = 60;
  if (f.transparentFees) s += 10; else { s -= 15; notes.push("Tabela de custos incompleta: o custo real so aparece na nota de corretagem."); }
  if (f.hasSandbox) s += 8; else notes.push("Sem sandbox: a Fase 1 tera de rodar com simulacao local, nao com a corretora.");
  if (f.apiKeyWithoutWithdrawal) s += 12; else { s -= 25; notes.push("Chave de API sem escopo de saque e requisito. Sem isso, o sistema nao conecta."); }
  if (f.urgencyPressure) { s -= 20; notes.push("Usa pressao de urgencia na captacao."); }
  s += Math.min(10, f.yearsOperating * 2);
  s -= Math.min(30, f.unresolvedComplaints * 3);

  const final = Math.max(0, Math.min(100, Math.round(s)));
  return {
    score: final,
    blocked: final < LIMITS.minProviderReputation,
    disqualifiers,
    notes,
  };
}
