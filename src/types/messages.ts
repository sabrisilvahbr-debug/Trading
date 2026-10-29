/** Contrato unico de mensagem entre agentes. Ninguem chama ninguem direto. */

export type AgentId =
  | "diretor" | "cotacoes" | "macro" | "fundamentos" | "noticias"
  | "tecnico" | "quant" | "estrategias" | "guardiao" | "dimensionador"
  | "executor" | "gestor_ordens" | "tesoureiro" | "conciliador" | "monitor"
  | "backtester" | "golpes" | "cenarios" | "contador" | "seguranca"
  | "pesquisador" | "testador" | "relator" | "alertas" | "simulador";

export interface Envelope<T = unknown> {
  readonly id: string;
  readonly from: AgentId;
  readonly to: AgentId | "broadcast";
  readonly type: string;
  readonly payload: T;
  /** Epoch ms de quando a mensagem foi criada. */
  readonly timestamp: number;
  /** Liga todas as mensagens de uma mesma decisao. */
  readonly correlationId: string;
}

/** Cotacao sempre carrega fonte e horario. Numero sem procedencia nao circula. */
export interface Quote {
  readonly symbol: string;
  readonly price: number;
  readonly source: string;
  /** Epoch ms do dado na origem, nao de quando o lemos. */
  readonly asOf: number;
}

export type Side = "BUY" | "SELL";

export interface OrderIntent {
  readonly symbol: string;
  readonly side: Side;
  readonly quantity: number;
  readonly referencePrice: number;
  /** Preco de stop. Obrigatorio: ordem sem stop nao passa pelo Guardiao. */
  readonly stopPrice: number;
  /** Por que esta ordem existe. Vai para o audit_log. */
  readonly reason: string;
  readonly correlationId: string;
}

export interface PortfolioState {
  readonly capitalBrl: number;
  readonly equityBrl: number;
  readonly peakEquityBrl: number;
  readonly dayPnlBrl: number;
  readonly grossExposureBrl: number;
  readonly openPositions: number;
  readonly borrowedBrl: number;
}

/** Toda proposta vinda de LLM entra no sistema neste formato, nunca em texto livre. */
export interface LlmProposal<T> {
  readonly value: T;
  readonly confidence: number;
  readonly dataUsed: readonly string[];
  readonly rejectedAlternatives: readonly string[];
}
