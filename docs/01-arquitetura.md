# Arquitetura

## Princípio central

> **Código calcula. LLM propõe. Guardião decide.**

1. **Código determinístico** faz toda conta de dinheiro e de risco: P&L, tamanho de posição, stop, limites, conciliação. Nunca o LLM.
2. **LLM** só interpreta texto — notícia, release, documentação de corretora — resume e **propõe** em JSON validado por schema. Nunca decide ordem.
3. **Guardião de risco** valida toda ordem contra limites em código. O LLM não contorna o Guardião nem altera limites.
4. Toda ação com dinheiro exige: dado com carimbo de tempo, cálculo reproduzível, motivo registrado e resultado medido depois.

## Camadas

```
            ┌──────────────────────────────────────────┐
  fontes →  │ coletores (2,3,4,5)  → market_snapshots  │
            └───────────────┬──────────────────────────┘
                            │ frescor validado (5)
            ┌───────────────▼──────────────────────────┐
            │ inteligência: sinais (6,7), estratégias(8)│
            │ dimensionamento (10), cenários (18)       │
            └───────────────┬──────────────────────────┘
                            │ OrderIntent
            ┌───────────────▼──────────────────────────┐
            │ GUARDIÃO (9) — limites em código          │
            └───────────────┬──────────────────────────┘
               recusa ◄─────┴─────► aprova
                                     │ em REAL: + aprovação humana
            ┌────────────────────────▼─────────────────┐
            │ executor (11) → gestor (12) → tesouraria │
            │ conciliador (14) → audit_log encadeado   │
            └──────────────────────────────────────────┘
```

## Contrato entre agentes

Ninguém chama ninguém direto. Todo mundo publica `Envelope` no barramento
(`src/bus/eventbus.ts`), com `id, from, to, type, payload, timestamp,
correlationId`. O `correlationId` liga todas as mensagens de uma mesma decisão,
do sinal até o resultado medido.

O barramento grava cada mensagem no log de auditoria com o hash da anterior.
Editar ou apagar um registro quebra a cadeia, e `bus.verify()` aponta o número
exato do registro adulterado. O Conciliador roda essa verificação de hora em hora.

## Estados globais

Dois estados independentes, sempre visíveis no painel:

| Eixo | Valores | Quem muda |
|---|---|---|
| Modo | `PAPER` → `PILOTO` → `REAL` | você, entre fases |
| Regime | `NORMAL` / `CAUTELA` / `PAUSADO_RISCO` / `PAUSADO_MANUAL` | Guardião e botão de pausa |

`PAUSADO_RISCO` é automático: stop diário, drawdown, halt de mercado, dado
velho ou divergência entre fontes. `PAUSADO_MANUAL` é o botão, e funciona mesmo
se um agente travar.

## Tabelas mínimas

`market_snapshots`, `signals`, `orders`, `positions`, `fills`, `pnl`,
`decisions`, `risk_events`, `audit_log` (imutável, hash encadeado),
`strategy_versions`, `backtests`, `provider_reputation`, `agent_runs`.

## Stack

- **Backend:** Node 20+ e TypeScript estrito. Sem dependência de runtime: o motor
  é código puro e testável. Postgres entra na Fase 1 para persistência.
- **Frontend:** `web/index.html` — escritório 3D em Three.js, painéis de P&L,
  curva de capital, limites e cenários.
