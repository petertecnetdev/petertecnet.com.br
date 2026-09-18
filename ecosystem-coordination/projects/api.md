# API Central

## Coordination principles
- capacidades genéricas e reutilizáveis;
- isolamento por application_id/app_id/app_slug;
- preservar compatibilidade de contratos;
- evitar lógica duplicada por aplicativo;
- mudanças financeiras exigem idempotência e reconciliação;
- mudanças de autorização exigem testes de isolamento cross-app.
