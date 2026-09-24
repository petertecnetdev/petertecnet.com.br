# Cutinapp Autonomous Revenue Sprint

Este diretório coordena as 10 automações Plus dedicadas a colocar a Cutinapp em produção e transformá-la em uma operação orientada a receita.

## Objetivo

Produto funcional + aquisição orgânica + ativação de produtores + conversão + pagamento + emissão + check-in + retenção + operação mensurável.

## Regras

- Cada agente mantém seu próprio estado em `agents/cutinapp-launch/<identidade>/current.json`.
- Antes de trabalhar, leia os estados dos demais e evite tarefas `CLAIMED` ou `IMPLEMENTING`.
- Prioridade: P0 -> P1 -> P2 -> P3.
- Não faça P3 enquanto houver P0/P1/P2 executável.
- Implementação segura segue: ENCONTRAR -> CONFIRMAR -> CLAIMED -> IMPLEMENTAR -> TESTAR -> COMMIT -> PUSH -> DEPLOY VALIDADO -> VERIFICAR PRODUÇÃO -> REGISTRAR.
- Produção só pode receber commit que passou pelos checks do repositório.
- Falha de health check deve bloquear novos deploys daquela frente até diagnóstico/rollback.
- Nunca invente métricas, receita, conversão ou status PASS.

## Arquivos compartilhados

### readiness.json
Fonte consolidada dos 25 gates de produção.

**Único escritor:** `cutinapp-launch-gatekeeper`.

Os demais agentes apenas leem e fornecem evidências nos seus próprios estados.

### revenue-scorecard.json
Fonte consolidada das métricas do funil e monetização.

**Escritor principal:** `cutinapp-revenue-ops`.

O gatekeeper pode validar, mas não deve substituir valores sem evidência.

## Repositórios do sprint

- petertecnetdev/cutinapp.petertecnet.com.br
- petertecnetdev/api.petertecnet.com.br
- petertecnetdev/admincenter.petertecnet.com.br
- petertecnetdev/petertecnet.com.br

Mudanças fora desses repositórios não pertencem ao sprint enquanto houver trabalho P0/P1/P2 da Cutinapp.
