#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/cloudflared-resilience.sh"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/bin" "$TEST_DIR/state"
cat > "$TEST_DIR/bin/systemctl" <<'SH'
#!/usr/bin/env bash
if [[ "$1" == 'is-active' ]]; then [[ "${TEST_ACTIVE:-yes}" == yes ]]; exit; fi
if [[ "$1" == 'restart' ]]; then printf 'restart\n' >> "$TEST_LOG"; exit 0; fi
exit 0
SH
cat > "$TEST_DIR/bin/curl" <<'SH'
#!/usr/bin/env bash
case " $* " in
  *'/metrics'*)
    [[ "${TEST_METRICS:-1}" != unavailable ]] || exit 7
    printf 'cloudflared_tunnel_ha_connections %s\n' "$TEST_METRICS" ;;
  *) [[ "${TEST_EGRESS:-yes}" == yes ]] ;;
esac
SH
chmod +x "$TEST_DIR/bin/"*
export PATH="$TEST_DIR/bin:$PATH" TEST_LOG="$TEST_DIR/restarts"
export CLOUDFLARED_RESILIENCE_STATE_DIR="$TEST_DIR/state"
export CLOUDFLARED_METRICS_URL='http://127.0.0.1:20241/metrics'
export CLOUDFLARED_MIN_FAILURES=3 CLOUDFLARED_COOLDOWN_SECONDS=900
export TEST_ACTIVE=yes TEST_METRICS=1 TEST_EGRESS=yes

check() { bash "$SCRIPT" check >/dev/null 2>&1; }
restart_count() { if [[ -f "$TEST_LOG" ]]; then wc -l < "$TEST_LOG"; else echo 0; fi; }
assert_restarts() { [[ "$(restart_count)" == "$1" ]] || { echo "Esperado $1 reinício(s), encontrados $(restart_count)" >&2; exit 1; }; }

check; assert_restarts 0
TEST_METRICS=0; export TEST_METRICS
check; check; assert_restarts 0
check; assert_restarts 1
check; check; check; assert_restarts 1  # cooldown
TEST_METRICS=1; export TEST_METRICS
check
TEST_METRICS=unavailable; export TEST_METRICS
check; check; check; assert_restarts 1 # métrica ausente não é prova de falha
TEST_METRICS=0 TEST_EGRESS=no; export TEST_METRICS TEST_EGRESS
rm -f "$CLOUDFLARED_RESILIENCE_STATE_DIR/last_restart"
check; check; check; assert_restarts 1 # internet indisponível
printf 'Testes cloudflared-resilience: OK\n'
