import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENTS, ORDER_SENDERS, byId } from "../src/agents/registry.js";
import { EventBus } from "../src/bus/eventbus.js";

test("a mesa tem exatamente 25 agentes, numerados de 1 a 25", () => {
  assert.equal(AGENTS.length, 25);
  assert.deepEqual(AGENTS.map((a) => a.seat), Array.from({ length: 25 }, (_, i) => i + 1));
});

test("um unico agente pode enviar ordem", () => {
  assert.deepEqual(ORDER_SENDERS, ["executor"]);
});

test("nenhum agente de LLM puro origina ordem", () => {
  for (const a of AGENTS) {
    if (a.kind === "L") assert.equal(a.canSendOrders, false, `${a.name} nao pode enviar ordem`);
  }
});

test("o guardiao nao envia nem propoe ordem: so julga", () => {
  const g = byId("guardiao");
  assert.equal(g.canSendOrders, false);
  assert.equal(g.canProposeOrders, false);
});

test("o log de auditoria detecta um registro adulterado", () => {
  const bus = new EventBus();
  bus.publish("tecnico", "guardiao", "signal", { a: 1 });
  bus.publish("tecnico", "guardiao", "signal", { a: 2 });
  assert.equal(bus.verify().ok, true);
  const hist = bus.history() as unknown as Array<{ envelope: { payload: { a: number } } }>;
  hist[0]!.envelope.payload.a = 99;
  const v = bus.verify();
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.brokenAt, 0);
});
