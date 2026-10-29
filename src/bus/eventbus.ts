/**
 * Barramento de eventos e log de auditoria encadeado por hash.
 *
 * Agente nao chama agente: publica no barramento. O log guarda cada
 * mensagem com o hash da anterior, de modo que apagar ou editar um
 * registro quebra a cadeia e o Conciliador detecta na proxima rodada.
 */

import { createHash, randomUUID } from "node:crypto";
import type { AgentId, Envelope } from "../types/messages.js";

export interface AuditRecord {
  readonly seq: number;
  readonly envelope: Envelope;
  readonly prevHash: string;
  readonly hash: string;
}

type Handler = (envelope: Envelope) => void | Promise<void>;

const GENESIS = "0".repeat(64);

export class EventBus {
  private readonly handlers = new Map<string, Handler[]>();
  private readonly log: AuditRecord[] = [];

  on(type: string, handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  publish<T>(from: AgentId, to: AgentId | "broadcast", type: string, payload: T, correlationId?: string): Envelope<T> {
    const envelope: Envelope<T> = {
      id: randomUUID(),
      from, to, type, payload,
      timestamp: Date.now(),
      correlationId: correlationId ?? randomUUID(),
    };
    this.append(envelope);
    for (const h of this.handlers.get(type) ?? []) void h(envelope);
    return envelope;
  }

  private append(envelope: Envelope): void {
    const prevHash = this.log.at(-1)?.hash ?? GENESIS;
    const hash = createHash("sha256")
      .update(prevHash)
      .update(JSON.stringify({ ...envelope, payload: envelope.payload ?? null }))
      .digest("hex");
    this.log.push({ seq: this.log.length, envelope, prevHash, hash });
  }

  /** Verificacao que o Conciliador roda de hora em hora. */
  verify(): { readonly ok: true; readonly records: number } | { readonly ok: false; readonly brokenAt: number } {
    let prev = GENESIS;
    for (const r of this.log) {
      const expected = createHash("sha256")
        .update(prev)
        .update(JSON.stringify({ ...r.envelope, payload: r.envelope.payload ?? null }))
        .digest("hex");
      if (expected !== r.hash || r.prevHash !== prev) return { ok: false, brokenAt: r.seq };
      prev = r.hash;
    }
    return { ok: true, records: this.log.length };
  }

  history(): readonly AuditRecord[] { return this.log; }
}
