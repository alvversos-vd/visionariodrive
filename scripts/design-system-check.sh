#!/usr/bin/env bash
# Sprint 7.5 — Design System guardrails.
# Executar ao final de cada onda / no CI. Sai != 0 se detectar regressão.

set -u
fail=0

# Escopo: apenas código de app. Ignora shadcn primitives, integrações auto-gen e o splash HTML.
SCOPE=(src --glob '!src/components/ui/**' --glob '!src/integrations/**' --glob '!src/index.css' --glob '!src/App.css')

check() {
  local label="$1"; shift
  local out
  out=$(rg -n "$@" "${SCOPE[@]}" 2>/dev/null || true)
  if [ -n "$out" ]; then
    echo "❌ $label:"
    echo "$out"
    fail=1
  else
    echo "✅ $label"
  fi
}

echo "── Sprint 7.5 · Design System Check ──"

check "font-black proibido"       'font-black'
check "rounded-3xl proibido"      'rounded-3xl|rounded-t-3xl'
check "bg-black/70 proibido"      'bg-black/70'

# Tipografia arbitrária — permitidos apenas KPIs display grandes (>=32px).
tsize=$(rg -no 'text-\[[0-9]+px\]' "${SCOPE[@]}" 2>/dev/null \
        | rg -v 'text-\[(3[2-9]|[4-9][0-9]|1[0-9]{2})px\]' || true)
if [ -n "$tsize" ]; then
  echo "❌ text-[Npx] fora do padrão (use .text-micro/.text-caption/.kpi-display):"
  echo "$tsize"
  fail=1
else
  echo "✅ text-[Npx] dentro da whitelist"
fi

# Cores hardcoded — exceção documentada: cor da rota GPS já migrou para --map-route-color.
hex=$(rg -n '#[0-9A-Fa-f]{3,8}\b' "${SCOPE[@]}" 2>/dev/null || true)
if [ -n "$hex" ]; then
  echo "❌ Hex hardcoded encontrado (documentar exceção ou migrar para token):"
  echo "$hex"
  fail=1
else
  echo "✅ Sem hex hardcoded"
fi

echo "────────────────────────────────────────"
if [ $fail -ne 0 ]; then
  echo "REGRESSÃO detectada. Corrija antes de fechar a onda."
  exit 1
fi
echo "Design System OK."
