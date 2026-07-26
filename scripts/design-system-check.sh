#!/usr/bin/env bash
# Sprint 7.5 — Design System guardrails.
# Executar ao final de cada onda / no CI.
#
# HARD FAILS (exit != 0): regressões que quebram o Design System.
# SOFT WARNINGS: pendências planejadas para ondas seguintes; viram HARD ao final da Onda 6.

set -u
fail=0
warn=0

SCOPE=(src --glob '!src/components/ui/**' --glob '!src/integrations/**' --glob '!src/index.css' --glob '!src/App.css')

hard() {
  local label="$1"; shift
  local out
  out=$(rg -n "$@" "${SCOPE[@]}" 2>/dev/null || true)
  if [ -n "$out" ]; then
    echo "❌ HARD  · $label"
    echo "$out"
    fail=1
  else
    echo "✅ HARD  · $label"
  fi
}

soft() {
  local label="$1"; shift
  local out
  out=$(rg -n "$@" "${SCOPE[@]}" 2>/dev/null || true)
  if [ -n "$out" ]; then
    local n
    n=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
    echo "⚠️  SOFT · $label ($n ocorrências restantes — migrar nas ondas 2–5)"
    warn=1
  else
    echo "✅ SOFT · $label"
  fi
}

echo "── Sprint 7.5 · Design System Check ──"

# HARD — nunca podem voltar.
hard "font-black proibido"                'font-black'
hard "rounded-3xl / rounded-t-3xl"        'rounded-3xl|rounded-t-3xl'
hard "bg-black/70 proibido"               'bg-black/70'

# HARD — promovidos ao fim da Onda 6.
# Tipografia: permitidos apenas tamanhos ≥15px (títulos/KPIs display).
tsize=$(rg -no 'text-\[[0-9]+px\]' "${SCOPE[@]}" 2>/dev/null \
        | rg -v 'text-\[(1[5-9]|[2-9][0-9]|1[0-9]{2})px\]' || true)
if [ -n "$tsize" ]; then
  n=$(printf '%s\n' "$tsize" | wc -l | tr -d ' ')
  echo "❌ HARD  · text-[Npx] fora do padrão ($n ocorrências — usar .text-micro/.text-caption/.kpi-display)"
  echo "$tsize"
  fail=1
else
  echo "✅ HARD  · text-[Npx] dentro da whitelist"
fi

# Cores hex — app não deve ter nenhuma (exceções ficam em tokens/ui).
hex=$(rg -n '#[0-9A-Fa-f]{3,8}\b' "${SCOPE[@]}" 2>/dev/null || true)
if [ -n "$hex" ]; then
  n=$(printf '%s\n' "$hex" | wc -l | tr -d ' ')
  echo "❌ HARD  · Hex hardcoded ($n ocorrências — migrar para token)"
  echo "$hex"
  fail=1
else
  echo "✅ HARD  · Sem hex hardcoded"
fi

echo "────────────────────────────────────────"
if [ $fail -ne 0 ]; then
  echo "❌ REGRESSÃO HARD detectada. Corrija antes de fechar a onda."
  exit 1
fi
if [ $warn -ne 0 ]; then
  echo "⚠️  Warnings soft — dentro do plano das ondas 2–5. OK para fechar a Onda 1."
fi
echo "✅ Design System OK."
