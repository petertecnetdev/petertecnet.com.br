# Cutinapp

## Critical flows
descoberta -> evento -> ingresso/lote -> carrinho/checkout -> pagamento -> ingresso/QR -> check-in.

## Coordination
Alterações no checkout, pagamentos, tickets, QR e check-in devem verificar dependências da API central e claims ativos antes de editar.
