# Risco: o que o Guardião recusa

Todos os limites vivem em `src/config/limits.ts`, congelados na carga
(`Object.freeze`). Não há rota HTTP, variável de ambiente ou proposta de LLM que
os altere em execução. Mudar limite é editar o arquivo, revisar no pull request
e reiniciar o processo.

## Limites atuais

| Limite | Valor | Efeito |
|---|---|---|
| Risco por operação | 1,0% do capital | recusa a ordem |
| Exposição bruta | 60% do capital | recusa a compra |
| Posições abertas | 5 | recusa nova compra |
| Stop diário | −2,0% do capital | congela a mesa no dia |
| Drawdown máximo | 10% sobre o pico | encerra a fase |
| Alavancagem | 1,0× (nenhuma) | recusa qualquer ordem alavancada |
| Idade da cotação | 15 s | sem ordem |
| Idade do status | 2 s | alerta; 3 falhas, pausa |
| Divergência entre fontes | 0,5% | sem ordem |
| Reputação da plataforma | 70/100 | bloqueia a integração |
| Confiança do LLM | 0,70 | escala para o Diretor, depois para você |

## Ordem de verificação

O Guardião checa **qualidade do dado antes de qualquer conta de dinheiro**.
Cotação velha, fontes divergentes ou mercado em halt derrubam a ordem antes de
o sistema calcular tamanho — porque calcular com dado ruim produz um número que
parece legítimo.

## O custo faz parte do risco

O risco de uma operação é a distância até o stop **mais** o atrito de ida e
volta (corretagem + meio spread + slippage, nas duas pernas). Dimensionar sem o
custo produz ordem que o Guardião recusa depois — e, pior, dá a impressão de que
a estratégia é lucrativa quando não é.

Há um limite específico para isso: se o custo de ida e volta for maior ou igual
à distância até o stop, a ordem é recusada com `CUSTO_MAIOR_QUE_ALVO`. A
operação simplesmente não se paga.

## Os três cenários

Nenhum número de retorno aparece sozinho. O módulo de cenários reamostra os
retornos observados e devolve P5, mediana, P95, probabilidade de prejuízo e
VaR 95%. É reamostragem do passado, não previsão: serve para dimensionar
expectativa, não para confiar nela.
