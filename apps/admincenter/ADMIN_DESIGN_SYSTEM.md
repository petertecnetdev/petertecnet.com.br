# Peter Tecnet Admin Center — Design System

## Regra de arquitetura
`src/AdminDesignSystem.css` é a fonte canônica de tokens. Novos módulos devem consumir `--pt-*`; não devem criar paletas, escalas de espaçamento, z-index ou alturas de controles próprias. Compatibility aliases `--admin-*` existem apenas durante a migração.

## Camadas
1. `AdminDesignSystem.css`: tokens e primitives globais.
2. CSS estrutural existente: layout/compatibilidade durante migração.
3. `AdminUiKit.css`: componentes reutilizáveis.
4. CSS de módulo: somente composição e necessidades específicas.
5. Overrides: exceção documentada, nunca estratégia padrão.

## Tokens
Cores: `--pt-bg`, `--pt-surface*`, `--pt-text*`, `--pt-accent*`, `--pt-success`, `--pt-warning`, `--pt-danger`, `--pt-info`.
Espaçamento: `--pt-space-1..12`. Tipografia: `--pt-font-*` e `--pt-leading-*`. Radius: `--pt-radius-*`. Sombras: `--pt-shadow-*`. Controles: `--pt-control-*`. Shell: `--pt-sidebar-width`, `--pt-sidebar-drawer`, `--pt-topbar-height`, `--pt-content-max`. Z-index: `--pt-z-*`.

## Identidade por módulo
A shell define `--pt-module`/`--pt-module-rgb` para dashboard, operations, agents, financial, applications, users, establishments, items, notifications e activity. Componentes devem usar essa variável para contexto sem inventar uma identidade isolada.

## Primitives
`pt-stack`, `pt-grid`, `pt-surface` e `pt-status` são primitives de baixa especificidade. Controles têm foco visível e alvo mínimo de 44px. `prefers-reduced-motion` e `prefers-contrast` são respeitados.

## Checklist 1–100 — evidência atual da `main`

Status só é `CONCLUÍDO` quando existe evidência direta no código; comportamento que ainda exige validação de browser permanece `PARCIAL`.

- **CONCLUÍDO:** 1–15 (fundação/tokens), 21–25 (arquitetura compartilhada), 28–29 (herança/documentação), 32 (largura máxima), 36–39 (grid/ritmo/espaçamento), 47 (tecnologia com legibilidade), 50 (contrato visual comum), 57 (estado ativo), 61–64 (dimensão/alvo/hover/foco), 79–80 (mobile/teclado), 91 (topbar responsiva), 94–95 (altura/layout estável).
- **PARCIAL:** 16–20 (migração de cores/fontes/`!important`/sobreposição/CSS morto), 26–27 (inline styles e exceções locais), 30 (documentação existe, referência visual interativa ainda não comprovada), 31, 33–35, 40–46, 48–49 (shell/densidade/primeira dobra ainda precisam de validação e migração por página), 51–56, 58–60, 65–78, 81–90, 96–100 (implementação existe no shell, mas exige evidência de browser/runtime antes do encerramento), 74 (bloco do usuário ainda precisa validação visual).
- **PENDENTE:** nenhum ponto pode ser promovido a pendente apenas por ausência em busca textual; lacunas de adoção permanecem parciais até auditoria do consumidor correspondente.
- **REGRESSÃO:** nenhuma regressão nova confirmada neste checklist. Regressões encontradas por CI/runtime devem ser registradas aqui antes de qualquer promoção de status.

### Evidência direta
- `src/AdminDesignSystem.css`: tokens 1–15, identidade por módulo, foco acessível, controles mínimos, largura máxima, grid responsivo, primitives e preferências de movimento/contraste.
- `src/App.jsx`: navegação canônica dos dez módulos, deep links, preferências persistidas de sidebar/densidade/recentes/favoritos e lazy loading dos centros administrativos.
- `src/AdminUiKit.jsx`: primitives reutilizáveis de PageHeader, StatusBadge, KPI, FilterBar, DataTable e Field. A existência do primitive não prova migração de todas as páginas.
- `src/AdminResponsiveV3.css` + validador responsive: contrato dos breakpoints e contenção de overflow; validação visual real continua necessária antes de fechar itens dependentes de browser.

## Regra de integração
Não criar nova camada ampla de overrides para fechar o checklist. Priorizar migração de consumidores para tokens/primitives/components. Antes de alterar shell, PageHeader ou DataTable, revisar PRs/claims concorrentes. Lint, build, validadores responsive/navigation/runtime e CI são gates; sem evidência verde, o ponto permanece parcial.
