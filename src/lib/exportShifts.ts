import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Shift, computeTotals, formatTempo, formatOperationalDate, getShifts } from './shifts';
import { exportTelemetry } from './exportTelemetry';
import { getVehicleById, TIPO_LABEL } from './vehicles';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtHora(iso?: string) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Retorna turnos finalizados cuja data_operacional está entre [from, to] (inclusivo). */
export function getShiftsInRange(from: string, to: string): Shift[] {
  return getShifts()
    .filter(s => s.status === 'finalizado')
    .filter(s => s.data_operacional >= from && s.data_operacional <= to)
    .sort((a, b) => a.data_operacional.localeCompare(b.data_operacional));
}

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerDownload(blob: Blob, filename: string) {
  // ⚠️ LEGACY PATH — usa anchor.click() + URL.createObjectURL.
  // Não funciona em Capacitor WebView (Android APK): o anchor download é ignorado.
  // O fluxo correto é saveBlob() (Filesystem + Share nativos), como em exportHistoryPdf.
  exportTelemetry.step('exportShifts.triggerDownload', 'legacy_anchor_begin', {
    filename, size: blob.size, type: blob.type,
  });
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    exportTelemetry.step('exportShifts.triggerDownload', 'legacy_anchor_dispatched', { filename });
  } catch (err) {
    exportTelemetry.error('exportShifts.triggerDownload', 'legacy_anchor_failed', err);
    throw err;
  }
}

export function exportShiftsCsv(from: string, to: string): number {
  const SCOPE = 'exportShiftsCsv';
  exportTelemetry.step(SCOPE, 'begin', { from, to });
  const shifts = getShiftsInRange(from, to);
  exportTelemetry.step(SCOPE, 'data_loaded', { shiftsCount: shifts.length });
  if (shifts.length === 0) return 0;

  const rows: (string | number)[][] = [];
  rows.push([
    'data_operacional', 'inicio', 'fim', 'tempo', 'veiculo', 'app',
    'corrida_id', 'horario_corrida', 'valor', 'km', 'r_por_km', 'resultado',
    'ganho_turno', 'km_turno', 'corridas_turno', 'custo_turno', 'lucro_turno',
  ]);

  for (const s of shifts) {
    const t = computeTotals(s);
    const v = getVehicleById(s.veiculo_id);
    const vname = v ? `${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}` : '';
    if (s.rides.length === 0) {
      rows.push([
        s.data_operacional, fmtHora(s.inicio_turno), fmtHora(s.fim_turno), formatTempo(t.tempo_online_minutos),
        vname, s.app_utilizado || '', '', '', '', '', '', '',
        t.ganho_total.toFixed(2), t.km_total.toFixed(2), t.corridas_total, t.custo_total.toFixed(2), t.lucro_total.toFixed(2),
      ]);
    } else {
      s.rides.slice().reverse().forEach((r, idx) => {
        rows.push([
          s.data_operacional, fmtHora(s.inicio_turno), fmtHora(s.fim_turno), formatTempo(t.tempo_online_minutos),
          vname, s.app_utilizado || '',
          r.corrida_id, fmtHora(r.data_registro), r.valor.toFixed(2), r.km.toFixed(2), r.valor_por_km.toFixed(2), r.resultado,
          idx === 0 ? t.ganho_total.toFixed(2) : '',
          idx === 0 ? t.km_total.toFixed(2) : '',
          idx === 0 ? t.corridas_total : '',
          idx === 0 ? t.custo_total.toFixed(2) : '',
          idx === 0 ? t.lucro_total.toFixed(2) : '',
        ]);
      });
    }
  }

  const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  exportTelemetry.step('exportShiftsCsv', 'blob_created', { hasBlob: !!blob, size: blob.size, type: blob.type });
  exportTelemetry.step('exportShiftsCsv', 'before_saveBlob', { delivery: 'legacy_triggerDownload' });
  try {
    triggerDownload(blob, `visionario-historico_${from}_a_${to}.csv`);
    exportTelemetry.step('exportShiftsCsv', 'saveBlob_returned', { path: 'legacy-anchor-download' });
  } catch (err) {
    exportTelemetry.error('exportShiftsCsv', 'delivery_failed', err);
    throw err;
  }
  return shifts.length;
}

export function exportShiftsPdf(from: string, to: string): number {
  const SCOPE = 'exportShiftsPdf';
  exportTelemetry.step(SCOPE, 'begin', { from, to });
  const shifts = getShiftsInRange(from, to);
  exportTelemetry.step(SCOPE, 'data_loaded', { shiftsCount: shifts.length });
  if (shifts.length === 0) return 0;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Visionario Drive — Histórico de turnos', 14, 16);
  doc.setFontSize(10);
  doc.text(`Período: ${formatOperationalDate(from)} → ${formatOperationalDate(to)}`, 14, 23);

  // Resumo agregado
  const agg = shifts.reduce((acc, s) => {
    const t = computeTotals(s);
    acc.ganho += t.ganho_total; acc.lucro += t.lucro_total; acc.km += t.km_total;
    acc.corridas += t.corridas_total; acc.minutos += t.tempo_online_minutos; acc.custo += t.custo_total;
    return acc;
  }, { ganho: 0, lucro: 0, km: 0, corridas: 0, minutos: 0, custo: 0 });

  doc.text(
    `Turnos: ${shifts.length}  ·  Corridas: ${agg.corridas}  ·  Tempo: ${formatTempo(agg.minutos)}`,
    14, 29
  );
  doc.text(
    `Ganho: ${fmt(agg.ganho)}   Custo: ${fmt(agg.custo)}   Lucro: ${fmt(agg.lucro)}   Km: ${agg.km.toFixed(1)}`,
    14, 35
  );

  // Tabela de turnos
  autoTable(doc, {
    startY: 42,
    head: [['Data', 'Início', 'Fim', 'Tempo', 'Veículo / App', 'Corr.', 'Km', 'Ganho', 'Custo', 'Lucro']],
    body: shifts.map(s => {
      const t = computeTotals(s);
      const v = getVehicleById(s.veiculo_id);
      const vname = v ? `${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}` : '—';
      return [
        formatOperationalDate(s.data_operacional),
        fmtHora(s.inicio_turno),
        fmtHora(s.fim_turno),
        formatTempo(t.tempo_online_minutos),
        `${vname}${s.app_utilizado ? `\n${s.app_utilizado}` : ''}`,
        t.corridas_total,
        t.km_total.toFixed(1),
        fmt(t.ganho_total),
        fmt(t.custo_total),
        fmt(t.lucro_total),
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 30, 30] },
  });

  // ⚠️ LEGACY PATH — doc.save() internamente faz anchor.click(); NÃO funciona em Capacitor WebView.
  // Correção definitiva: doc.output('blob') + saveBlob(), igual a exportHistoryPdf.
  const filename = `visionario-historico_${from}_a_${to}.pdf`;
  exportTelemetry.step('exportShiftsPdf', 'before_saveBlob', { delivery: 'legacy_doc.save', filename });
  try {
    let blob: Blob | null = null;
    try {
      blob = doc.output('blob');
      exportTelemetry.step('exportShiftsPdf', 'blob_created', { hasBlob: !!blob, size: blob?.size ?? 0, type: blob?.type ?? null });
    } catch (err) {
      exportTelemetry.error('exportShiftsPdf', 'doc_output_blob', err);
    }
    doc.save(filename);
    exportTelemetry.step('exportShiftsPdf', 'saveBlob_returned', { path: 'legacy-doc-save' });
  } catch (err) {
    exportTelemetry.error('exportShiftsPdf', 'delivery_failed', err);
    throw err;
  }
  return shifts.length;
}
