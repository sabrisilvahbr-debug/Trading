# Limites do projeto e situação regulatória

## O que este sistema não faz

1. **Não faz login com a sua senha** em plataforma de trading, por nenhum meio.
2. **Não envia ordem real sem a sua aprovação**, mesmo com o Guardião aprovando.
3. **Não promete lucro, renda passiva ou taxa de acerto.** Nenhuma tela mostra
   retorno sem o cenário pessimista e a probabilidade de prejuízo ao lado.
4. **Não opera dinheiro de terceiros.**
5. **Não integra** plataforma que promete retorno, corretora sem registro no
   regulador, ou chave com permissão de saque. Isso é bloqueio em código, com
   teste, não política escrita.

## CVM

Gerir recursos de terceiros e recomendar investimentos são atividades reguladas
pela CVM e exigem registro. Este projeto é ferramenta de **uso pessoal, na sua
própria conta**. Transformar isso em empresa que opera dinheiro de clientes é um
caminho diferente: exige registro de administrador de carteira, estrutura de
compliance e auditoria independente. Nada neste repositório prepara para isso.

Nada aqui é recomendação de investimento nem aconselhamento financeiro,
jurídico ou tributário.

## Tributação

Day trade e swing trade têm regras próprias: alíquotas diferentes, apuração
mensal, DARF, isenções específicas e compensação de prejuízo. O agente 19 gera
rascunho a partir das operações registradas. **Rascunho não é apuração** —
consulte um contador.

## A verdade incômoda

A maioria dos sistemas automáticos de trading perde dinheiro depois dos custos.
Backtest bom não garante futuro, e é fácil ajustar demais uma estratégia aos
dados antigos. Por isso o repositório inteiro é construído em torno de três
coisas: custo descontado em toda simulação, validação fora da amostra
obrigatória, e um Guardião que prefere não operar a operar no escuro.

Se a conta não fechar, a recomendação correta do sistema é parar.
