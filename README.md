# Mesa 25

Escritório virtual de trading com 25 agentes, painel 3D e um Guardião de Risco
que prefere não operar a operar no escuro.

**Estado atual: modo PAPER.** Nenhuma corretora conectada, nenhuma ordem real,
nenhum dinheiro. Os números do painel saem de um gerador de preços local.

> Nada neste repositório é recomendação de investimento nem aconselhamento
> financeiro, jurídico ou tributário.

---

## O princípio

> **Código calcula. LLM propõe. Guardião decide.**

Toda conta de dinheiro e de risco é código determinístico e testado. O LLM só
interpreta texto e propõe em JSON validado. Nenhuma ordem existe sem passar pelo
Guardião, e no modo `REAL` nenhuma ordem sai sem aprovação humana.

## Rodar

```bash
npm install
npm test     # 37 testes: limites de risco, frescor, custos, overfitting, auditoria
npm run demo # uma rodada PAPER completa, do sinal ao veredito do Guardião
```

O painel é um arquivo só, sem build:

```bash
open web/index.html
```

## O que a rodada de demonstração imprime

```
BACKTEST (série completa, só para comparação)
  retorno           +18.27%
  comprar e segurar -36.27%
  drawdown maximo   -9.05%
  operacoes         7
  custos pagos      R$ 70,70

VALIDACAO FORA DA AMOSTRA (o numero que decide)
  promovida  NAO
    - Menos de 10 operacoes fora da amostra: amostra pequena demais para concluir.

TRES CENARIOS — 30 pregoes
  pessimista (P5)   -6.48%
  base (mediana)    +1.91%
  otimista (P95)    +10.96%
  prob. de prejuizo 35%

ORDEM SUBMETIDA AO GUARDIAO
  veredito    APROVADO — risco R$ 99,50 (1.00% do capital, teto 1.0%)
  execucao    simulada (modo PAPER). Em REAL, ainda esperaria aprovacao humana.
```

Repare na linha `promovida NAO`: a estratégia bateu "comprar e segurar" por 54
pontos percentuais e **ainda assim** não foi promovida, porque a amostra fora do
treino é pequena demais para concluir qualquer coisa. É esse o comportamento
desejado.

## Estrutura

```
src/config/limits.ts        limites do Guardião, congelados na carga
src/risk/guardian.ts        função pura: intenção de ordem → aprovado ou recusado
src/intelligence/
  indicators.ts             médias, RSI, volatilidade
  sizing.ts                 volatilidade-alvo e Kelly conservador, já com custo
  backtest.ts               backtest com custos + validação fora da amostra
  montecarlo.ts             três cenários, VaR, probabilidade de prejuízo
  freshness.ts              idade do dado e divergência entre fontes
  reputation.ts             nota de plataforma 0–100, com reprovação automática
src/agents/registry.ts      os 25 agentes e o que cada um pode fazer
src/bus/eventbus.ts         barramento + log de auditoria encadeado por hash
web/index.html              escritório 3D e painéis
docs/                       arquitetura, agentes, risco, dados, fases, segurança
tests/                      37 testes
```

## Limites de risco

Vivem em `src/config/limits.ts`, congelados com `Object.freeze`. Nenhuma rota,
variável de ambiente ou proposta de LLM os altera em execução.

| Limite | Valor |
|---|---|
| Risco por operação | 1,0% do capital |
| Exposição bruta | 60% |
| Stop diário | −2,0% |
| Drawdown máximo | 10% |
| Alavancagem | nenhuma |
| Idade máxima da cotação | 15 s |
| Divergência entre fontes | 0,5% |

## O que este sistema não faz

- **Não faz login com a sua senha.** Nenhum agente digita credencial, token ou
  dado de pagamento em site de corretora. O acesso é por chave de API criada por
  você, **sem permissão de saque**, de preferência em sandbox. Corretora sem API:
  os agentes leem e relatam, e o clique de enviar ordem é seu.
- **Não envia ordem real sem a sua aprovação**, mesmo com o Guardião aprovando.
- **Não promete lucro nem taxa de acerto.** Todo retorno aparece junto do cenário
  pessimista e da probabilidade de prejuízo.
- **Não opera dinheiro de terceiros.** Isso exige registro na CVM.
- **Não obedece a texto de fora.** Notícia e documento são dados não confiáveis.

Detalhes em [`docs/07-limites-e-regulacao.md`](docs/07-limites-e-regulacao.md).

## Fases

| Fase | O que é | Portão |
|---|---|---|
| 1 · Paper | dados reais, dinheiro fictício | 60 pregões sem furar limite |
| 2 · Piloto | dinheiro real pequeno, aprovação por ordem | líquido positivo após custos e imposto |
| 3 · Escala | aumento gradual nos mesmos tetos | violação devolve à fase anterior |

Encerrar é um resultado válido, e provavelmente o mais comum: a maioria das
estratégias automáticas não sobrevive aos custos. Descobrir isso na Fase 1 custa
tempo; descobrir na Fase 3 custa dinheiro.

## Licença

MIT.

## Pesquisa (ai-trading-claude)

A pasta `vendor/ai-trading-claude/` traz os skills de análise (MIT, ver `VENDOR.md`).
São uma ferramenta de **pesquisa**: não se conectam a corretora e não enviam ordens.

A saída de análise é texto de LLM. Para virar qualquer coisa no sistema, passa por
`src/research/proposal.ts`, que:

- exige formato exato e recusa campos extras;
- recusa ticker fora da B3, stop do lado errado e proposta sem dados usados;
- escala para o Diretor quando a confiança está abaixo de 0,70;
- recalcula a quantidade em código, ignorando qualquer número sugerido pelo texto;
- entrega uma intenção de ordem que ainda precisa passar pelo Guardião.

Nenhum passo desse caminho envia ordem.
