# Agent Tasks

Cada arquivo `TASK-*.json` representa uma unidade de trabalho compartilhada.

Regras:
- ID único e imutável.
- Um owner lock por vez.
- Atualização com SHA atual para impedir sobrescrita concorrente.
- DONE requer evidência quando aplicável.
- Delegação limitada.
- Contexto de plataforma separado da identidade do agente.
