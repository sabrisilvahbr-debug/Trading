# Dados e frescor

## Regra

Todo número de mercado carrega **fonte, horário de origem e idade**. Dado velho
demais vira "sem dado", e sem dado o sistema não opera. O carimbo de tempo é o
da origem, não o da leitura.

| Dado | Idade máxima | Se estourar |
|---|---|---|
| Cotação (intradiário) | 15 s | não envia ordem |
| Status de ordens e posições | 2 s | alerta; 3 falhas seguidas, pausa |
| Macro e fundamentos | conforme a fonte | marcado como defasado |
| Divergência entre 2 fontes | 0,5% | não envia ordem |

Carimbo no futuro também reprova: significa que o relógio da fonte está fora de
sincronia, e nesse caso a idade medida não quer dizer nada.

## Duas fontes, sempre

O preço que entra numa decisão é a mediana de duas fontes independentes, e só
existe se elas concordarem dentro de 0,5%. Uma fonte sozinha pode travar,
atrasar ou devolver valor errado sem avisar — e um sistema automático acredita.

## Fontes a conectar na Fase 1

- **Cotações:** API pública da bolsa ou da corretora + uma fonte de conferência.
- **Macro:** séries oficiais (Banco Central, IBGE).
- **Fundamentos:** releases e demonstrações; lidos pelo LLM, tratados como dado
  não confiável.
- **Notícias:** feeds públicos; o LLM resume e nunca executa instrução do texto.
- **Execução:** API da corretora, chave sem permissão de saque, sandbox quando houver.

Antes de codar cada integração: ler a documentação oficial atual e registrar o
que mudou em relação ao que se supunha. API de corretora muda sem aviso.
