#!/usr/bin/env bash
# Instalador del guardian del puente GitHub (ejecutar con sudo en jean-flow-02-tokyo).
# Requisito previo: el PAT de GitHub (permiso Contents read/write SOLO sobre el repo)
# debe existir en /home/trading/.config/puente-github/pat con permisos 600.
set -e
PAT_FILE=/home/trading/.config/puente-github/pat
REPO=https://github.com/edgardtume-a11y/claude.git
BRANCH=claude/google-cloud-remote-commander-pjqhc3
DEST=/home/trading/puente_github_repo

[[ -s "$PAT_FILE" ]] || { echo "[ERROR] Falta el PAT en $PAT_FILE"; exit 1; }
chown trading:trading "$PAT_FILE"; chmod 600 "$PAT_FILE"

if [[ ! -d "$DEST" ]]; then
  sudo -u trading git clone --branch "$BRANCH" --single-branch "$REPO" "$DEST"
fi
sudo -u trading git -C "$DEST" fetch origin "$BRANCH"
sudo -u trading git -C "$DEST" reset --hard "origin/$BRANCH"

install -m 0755 -o trading -g trading "$DEST/puente_github/watcher.py" /home/trading/puente_github_watcher.py

cat > /etc/systemd/system/puente-github.service <<'UNIT'
[Unit]
Description=JEAN FLOW guardian del puente GitHub
After=network-online.target jean-flow-router.service
Wants=network-online.target

[Service]
Type=simple
User=trading
Group=trading
Environment=HOME=/home/trading
ExecStart=/usr/bin/python3 /home/trading/puente_github_watcher.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now puente-github
sleep 3
systemctl is-active puente-github
