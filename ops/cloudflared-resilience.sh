#!/usr/bin/env bash
# Recuperação conservadora do Cloudflare Tunnel da Peter Tecnet.
# Uso: sudo bash ops/cloudflared-resilience.sh install
#      sudo /usr/local/sbin/petertecnet-cloudflared-resilience check
set -Eeuo pipefail

SERVICE='cloudflared.service'
STATE_DIR="${CLOUDFLARED_RESILIENCE_STATE_DIR:-/run/petertecnet-cloudflared}"
METRICS_URL="${CLOUDFLARED_METRICS_URL:-}"
MIN_FAILURES="${CLOUDFLARED_MIN_FAILURES:-3}"
COOLDOWN_SECONDS="${CLOUDFLARED_COOLDOWN_SECONDS:-900}"
EGRESS_URL='https://www.cloudflare.com/cdn-cgi/trace'

log() { printf '[cloudflared-resilience] %s\n' "$*" >&2; }

install_resilience() {
  [[ "$EUID" -eq 0 ]] || { log 'Instalação exige root.'; exit 1; }
  command -v systemctl >/dev/null || { log 'systemd não encontrado.'; exit 1; }
  command -v curl >/dev/null || { log 'curl não encontrado.'; exit 1; }
  command -v flock >/dev/null || { log 'flock não encontrado.'; exit 1; }
  systemctl cat "$SERVICE" >/dev/null || { log 'cloudflared.service não encontrado; instalação interrompida.'; exit 1; }

  install -Dm0755 "$(realpath "$0")" /usr/local/sbin/petertecnet-cloudflared-resilience
  install -d -m 0755 /etc/systemd/system/cloudflared.service.d
  cat > /etc/systemd/system/cloudflared.service.d/40-petertecnet-resilience.conf <<'UNIT'
[Service]
Restart=always
RestartSec=15s
UNIT

  cat > /etc/systemd/system/petertecnet-cloudflared-watchdog.service <<'UNIT'
[Unit]
Description=Peter Tecnet Cloudflare Tunnel health check
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/petertecnet-cloudflared-resilience check
UNIT

  cat > /etc/systemd/system/petertecnet-cloudflared-watchdog.timer <<'UNIT'
[Unit]
Description=Periodic Cloudflare Tunnel health checks

[Timer]
OnBootSec=3min
OnUnitActiveSec=2min
AccuracySec=15s
RandomizedDelaySec=10s
Unit=petertecnet-cloudflared-watchdog.service

[Install]
WantedBy=timers.target
UNIT

  systemctl daemon-reload
  systemctl enable "$SERVICE"
  if ! systemctl is-active --quiet "$SERVICE"; then
    log 'Túnel inativo: iniciando serviço.'
    systemctl start "$SERVICE"
  fi
  systemctl enable --now petertecnet-cloudflared-watchdog.timer
  log 'Proteção instalada. Serviço ativo não foi reiniciado.'
}

metrics_value() {
  local url body value port
  if [[ -n "$METRICS_URL" ]]; then
    body="$(curl -fsS --connect-timeout 1 --max-time 3 "$METRICS_URL" 2>/dev/null)" || return 1
    printf '%s\n' "$body" | awk '/^cloudflared_tunnel_ha_connections([[:space:]]|\{)/ {found=1; if ($NF+0>0) active=1} END {if(found) print active+0}'
    return
  fi
  for port in 20241 20242 20243 20244 20245; do
    url="http://127.0.0.1:${port}/metrics"
    body="$(curl -fsS --connect-timeout 1 --max-time 2 "$url" 2>/dev/null)" || continue
    value="$(printf '%s\n' "$body" | awk '/^cloudflared_tunnel_ha_connections([[:space:]]|\{)/ {found=1; if ($NF+0>0) active=1} END {if(found) print active+0}')"
    if [[ -n "$value" ]]; then printf '%s\n' "$value"; return 0; fi
  done
  return 1
}

check_tunnel() {
  [[ "$MIN_FAILURES" =~ ^[1-9][0-9]*$ && "$COOLDOWN_SECONDS" =~ ^[1-9][0-9]*$ ]] || { log 'Parâmetros inválidos.'; exit 2; }
  install -d -m 0700 "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  flock -n 9 || exit 0

  local result='unavailable' count=0 previous=0 now
  if systemctl is-active --quiet "$SERVICE"; then
    if result="$(metrics_value)" && [[ -n "$result" ]]; then
      if [[ "$result" == '1' ]]; then
        printf '0\n' > "$STATE_DIR/failures"
        exit 0
      fi
      log 'Serviço ativo, mas sem conexões HA com a Cloudflare.'
    else
      # Ausência de métricas não prova falha: porta pode ter sido alterada.
      log 'Métricas indisponíveis; nenhuma reinicialização será efetuada.'
      exit 0
    fi
  else
    log 'Serviço cloudflared inativo.'
  fi

  if [[ -r "$STATE_DIR/failures" ]]; then read -r count < "$STATE_DIR/failures" || true; fi
  [[ "$count" =~ ^[0-9]+$ ]] || count=0
  count=$(( count + 1 ))
  printf '%s\n' "$count" > "$STATE_DIR/failures"
  if (( count < MIN_FAILURES )); then
    log "Falha ${count}/${MIN_FAILURES}; aguardando confirmação."
    exit 0
  fi

  now="$(date +%s)"
  if [[ -r "$STATE_DIR/last_restart" ]]; then read -r previous < "$STATE_DIR/last_restart" || true; fi
  [[ "$previous" =~ ^[0-9]+$ ]] || previous=0
  if (( now - previous < COOLDOWN_SECONDS )); then
    log 'Reinício ignorado pelo limite de segurança (cooldown).'
    exit 0
  fi
  if ! curl -fsS --connect-timeout 2 --max-time 5 --output /dev/null "$EGRESS_URL"; then
    log 'Conectividade externa indisponível; não reiniciar durante queda de internet.'
    exit 0
  fi

  log 'Falha confirmada; reiniciando somente cloudflared.service.'
  printf '%s\n' "$now" > "$STATE_DIR/last_restart"
  printf '0\n' > "$STATE_DIR/failures"
  if ! systemctl restart "$SERVICE"; then
    log 'Falha ao reiniciar cloudflared.service; verificar journalctl.'
    exit 1
  fi
}

case "${1:-}" in
  install) install_resilience ;;
  check) check_tunnel ;;
  *) printf 'Uso: %s {install|check}\n' "$0" >&2; exit 2 ;;
esac
