# Ecosystem Priorities

Este arquivo deve ser mantido principalmente pela frente de coordenação/Tech Lead para reduzir conflitos.

## P0
- regressões que bloqueiem login, compra, pagamento, emissão de ingresso, pedidos ou acesso aos aplicativos;
- perda de dados ou dinheiro;
- vulnerabilidades de autorização/isolamento entre aplicações;
- produção indisponível por mudança recente.

## P1
- falhas graves de conversão, checkout, onboarding e fluxos principais;
- regressões de UX que impeçam operação;
- inconsistências de contrato entre frontend e API;
- CI/build quebrado em trabalho pronto para integração.

## P2
- performance, SEO, acessibilidade, responsividade e melhorias de produto de alto valor.

## P3
- refinamentos cosméticos e melhorias sem impacto operacional imediato.

## Regra
Antes de iniciar trabalho P1-P3, verificar se existe P0 aberto em `BLOCKERS.md` ou em claims ativos.
