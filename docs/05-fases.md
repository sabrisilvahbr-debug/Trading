# Fases e critérios de saída

Cada fase tem um portão de entrada e um gatilho de encerramento definidos antes
de começar. Nenhum portão é negociado durante a fase — é por isso que ele existe.

## Fase 1 — Paper trading

Dados reais por API pública, dinheiro fictício, escritório 3D ligado.

**Objetivo:** validar o motor de sinais, o Guardião, a conciliação e a
recuperação de falha. Não é validar lucro.

**Passa se:** 60 pregões sem furar limite, sem divergência de conciliação, e com
o teste de caos passando (derrubar uma fonte, atrasar um preço, simular rejeição
de ordem).

## Fase 2 — Piloto

Dinheiro real pequeno, definido por você. Stop diário apertado. Chave de API sem
permissão de saque. Modo `REAL`: cada ordem aprovada pelo Guardião ainda espera
sua aprovação explícita.

**Passa se:** resultado líquido positivo no período combinado, **depois** de
corretagem, spread, slippage e imposto.

**Encerra se:** drawdown de 10% ou dois meses líquidos negativos.

## Fase 3 — Escala

Aumento gradual dentro dos mesmos tetos. Os limites não sobem junto com o
capital — eles são percentuais, e continuam sendo os mesmos percentuais.

**Volta para a fase anterior se:** qualquer limite for violado.

## O resultado honesto

Ao fim de cada fase, o relatório diz o que funcionou, o que falhou e qual a
recomendação: seguir, ajustar ou **encerrar**. Encerrar é um resultado válido e
provavelmente o mais comum. A maioria das estratégias automáticas não sobrevive
aos custos; descobrir isso na Fase 1 custa tempo, descobrir na Fase 3 custa
dinheiro.
