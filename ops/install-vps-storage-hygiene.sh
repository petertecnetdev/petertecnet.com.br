#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root (sudo bash ops/install-vps-storage-hygiene.sh)." >&2
  exit 1
fi

install -d -m 0755 /usr/local/sbin

cat > /usr/local/sbin/petertecnet-storage-hygiene <<'CLEANUP'
#!/usr/bin/env bash
set -Eeuo pipefail

before_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
reclaimed_kb=0
removed=0

# Only disposable Peter Tecnet automation/build workspaces directly under /tmp
# are eligible. Production applications, databases, uploads, backups, logs and
# unrelated temporary data are never selected. .keep-storage is an explicit opt-out.
while IFS= read -r -d '' candidate; do
  [[ "$(dirname "$candidate")" == "/tmp" ]] || continue
  [[ ! -e "$candidate/.keep-storage" ]] || continue

  in_use=0
  for cwd in /proc/[0-9]*/cwd; do
    target="$(readlink "$cwd" 2>/dev/null || true)"
    case "$target" in
      "$candidate"|"$candidate"/*) in_use=1; break ;;
    esac
  done
  if (( in_use )); then
    echo "Keeping active temporary workspace: $candidate"
    continue
  fi

  candidate_kb="$(du -sk "$candidate" 2>/dev/null | awk '{print $1}' || true)"
  candidate_kb="${candidate_kb:-0}"
  echo "Reclaiming stale disposable workspace: $candidate (${candidate_kb} KiB)"
  rm -rf -- "$candidate"
  reclaimed_kb=$((reclaimed_kb + candidate_kb))
  removed=$((removed + 1))
done < <(find /tmp -mindepth 1 -maxdepth 1 -type d -mmin +1800 \
  \( -name 'petertecnet-build-*' \
     -o -name 'cutinapp-*' \
     -o -name 'api-*' \
     -o -name 'admincenter-*' \) -print0 2>/dev/null)

after_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
echo "Removed stale workspaces: $removed"
echo "Estimated reclaimed storage: $((reclaimed_kb / 1024)) MiB"
echo "Root free space: $((before_kb / 1024)) MiB -> $((after_kb / 1024)) MiB"
logger -t petertecnet-storage-hygiene \
  "removed=$removed reclaimed_mib=$((reclaimed_kb / 1024)) free_mib=$((after_kb / 1024))"
CLEANUP
chmod 0755 /usr/local/sbin/petertecnet-storage-hygiene

cat > /etc/systemd/system/petertecnet-storage-hygiene.service <<'SERVICE'
[Unit]
Description=Peter Tecnet stale automation storage hygiene
Documentation=https://github.com/petertecnetdev/petertecnet.com.br

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/petertecnet-storage-hygiene
User=root
Group=root
NoNewPrivileges=true
PrivateTmp=false
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/tmp
SERVICE

cat > /etc/systemd/system/petertecnet-storage-hygiene.timer <<'TIMER'
[Unit]
Description=Run Peter Tecnet storage hygiene every six hours

[Timer]
OnCalendar=*-*-* 00/6:17:00
Persistent=true
RandomizedDelaySec=5m
Unit=petertecnet-storage-hygiene.service

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now petertecnet-storage-hygiene.timer
systemctl start petertecnet-storage-hygiene.service
systemctl --no-pager --full status petertecnet-storage-hygiene.timer
