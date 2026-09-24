# Cutinapp Autonomous Revenue Sprint

Este diretório coordena as 10 automações Plus dedicadas a colocar a Cutinapp em produção e transformá-la em uma operação orientada a receita.

## Objetivo

Produto funcional + aquisição orgânica + ativação de produtores + conversão + pagamento + emissão + check-in + retenção + operação mensurável.

## Política oficial de entrega

**AUTONOMOUS_DEPLOY_POLICY = ENABLED**

A regra antiga "não fazer deploy/VPS" foi substituída por esta política:

- Deploy automático por GitHub Actions é permitido e esperado quando o CI da branch de produção estiver verde.
- O deploy deve publicar exatamente o SHA validado, executar health check e usar rollback/bloqueio em caso de falha.
- Frontends podem usar publicação atômica/zero-downtime.
- A API só pode publicar após API CI verde, backup verificado e health check.
- É proibido usar comandos destrutivos, force-push, resetar trabalho local ou fazer deploy manual sem gate apenas para contornar CI.
- SentinelX pode ser usado para diagnóstico e health checks; mudanças de produção devem preferir os workflows versionados.
- Nenhum agente deve remover/desativar um workflow de deploy automático válido apenas por causa da antiga regra "no VPS".
- Se existir conflito entre prompts antigos e este arquivo, registre MISCONFIGURED/BLOCKED e peça atualização do prompt; não reverta a política oficial de entrega.

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
