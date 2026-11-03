# Vendor: ai-trading-claude

- Origem: https://github.com/zubair-trabzada/ai-trading-claude
- Commit copiado: c6d7252 (branch main, clone raso)
- Licença: MIT (ver LICENSE nesta pasta)

## O que foi revisado antes de copiar

- Nenhum acesso a corretora, nenhuma chave de API, nenhuma execução de ordem.
- `scripts/generate_trade_pdf.py`: sem rede, sem subprocess, sem eval. Só lê JSON e gera PDF com reportlab.
- Skills e agentes são instruções em Markdown. Os dados vêm da busca web do próprio Claude.
- Único comando de instalação em instruções: `pip install reportlab`.

## Como este projeto usa

O conteúdo de análise é **texto de LLM**, tratado como proposta não confiável.
Só entra no sistema por `src/research/proposal.ts`, que exige JSON validado,
confiança mínima, e passa pelo Guardião de Risco antes de qualquer ordem.
Nenhum resultado desta pasta envia ordem.

## Não editar

Mantenha esta pasta como veio do upstream. Mudanças locais vão em `src/research/`.
