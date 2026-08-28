#!/usr/bin/env bash
set +e
rm -f /home/trading/banco_auditparquet.pid
exec bash /home/trading/puente_github_repo/puente_github/scripts/banco_auditor_parquet.sh
