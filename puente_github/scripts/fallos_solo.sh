#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
python3 - <<PY
import json
d=json.load(open("$N/audit/metrics.json"))
print("certification:", d.get("certification"))
errs = d.get("errors") or []
print("errores declarados:", len(errs))
for e in errs[:15]: print("  -", str(e)[:200])
print()
print("SOLO LOS UMBRALES QUE FALLAN:")
for mercado, datos in (d.get("markets") or {}).items():
    for nombre, t in (datos.get("thresholds") or {}).items():
        if isinstance(t, dict) and t.get("pass") is False:
            print(f"  {mercado:14s} {nombre:24s} peor={t.get('worst_value_ms')} ms  limite={t.get('limit_ms')} ms  ultimo={t.get('latest_value_ms')} ms  requerido={t.get('required')}")
print()
print("TODOS los umbrales, para ver el margen:")
for mercado, datos in (d.get("markets") or {}).items():
    for nombre, t in (datos.get("thresholds") or {}).items():
        if isinstance(t, dict) and "limit_ms" in t:
            ok = "OK  " if t.get("pass") else "FALL"
            print(f"  {ok} {mercado:14s} {nombre:24s} {t.get('worst_value_ms')} / {t.get('limit_ms')}")
print()
print("actividad / cobertura:")
for mercado, datos in (d.get("markets") or {}).items():
    for k,v in datos.items():
        if k in ("thresholds","worst_p99_ms_across_windows","worst_p99_ms_post_warmup"): continue
        print(f"  {mercado}: {k} = {str(v)[:160]}")
PY
echo "FS_OK"
