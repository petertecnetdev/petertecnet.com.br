# Peter Tecnet — Assignment Matrix

| Agente | Função principal | Trabalhos preferenciais | Revisão recomendada |
| --- | --- | --- | --- |
| NP01 | API Core | Laravel, API, banco, pagamentos, arquitetura backend | NP03; NP04 quando segurança/pagamentos |
| NP02 | Frontend Platform | React, Vite, PWA, UX, responsividade | NP03; NP05 quando performance |
| NP03 | Quality Engineering | testes, regressão, revisão, release validation | agente especialista do domínio |
| NP04 | Security Engineering | auth, inputs, uploads, webhooks, secrets, dependências | NP03 |
| NP05 | Performance Engineering | profiling, cache, API/frontend performance | NP03 |
| NP08 | SEO & Distribution | SEO técnico, schema, conteúdo, distribuição | NP03 para regressão técnica |
| NP09 | Data / Analytics / Admin | telemetria, Admin Center, relatórios, coordenação | NP03 |
| NP10 | Integrations | APIs externas, webhooks, automação, GitHub | NP04 para segurança; NP03 para regressão |

## Regras de atribuição
- OWNER pode atribuir qualquer tarefa diretamente.
- NP09 pode sugerir distribuição, detectar duplicidade e pedir revisão.
- O agente que implementa não deve aprovar a própria revisão quando `review.required=true`.
- CRITICAL prefere NP03 como QA; segurança inclui NP04; performance inclui NP05.
- Plataformas são contexto, não identidade.
