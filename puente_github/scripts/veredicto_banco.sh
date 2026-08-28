#!/usr/bin/env bash
set +e
sed -n '/EL VEREDICTO/,$p' /home/trading/banco_auditparquet/banco.log 2>/dev/null
echo "---"
grep -E 'rc=' /home/trading/banco_auditparquet/banco.log | tail -8
echo "VBAN_OK"
