import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyEntry } from './types';
import { saveBlob, type SaveBlobPath } from './saveBlob';
import { exportTelemetry } from './exportTelemetry';


function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface Bucket {
  key: string;
  label: string;
  entries: DailyEntry[];
}

function weekKey(d: Date): { key: string; label: string } {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  // ISO week: Monday as start
  const day = (dt.getDay() + 6) % 7;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const key = monday.toISOString().slice(0, 10);
  const label = `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  return { key, label };
}

function monthKey(d: Date): { key: string; label: string } {
  const dt = new Date(d);
  const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  const label = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

function aggregate(entries: DailyEntry[], keyFn: (d: Date) => { key: string; label: string }): Bucket[] {
  const map = new Map<string, Bucket>();
  entries.forEach(e => {
    const { key, label } = keyFn(new Date(e.date));
    if (!map.has(key)) map.set(key, { key, label, entries: [] });
    map.get(key)!.entries.push(e);
  });
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

function summarize(entries: DailyEntry[]) {
  const sum = (k: keyof DailyEntry) => entries.reduce((s, e) => s + (e[k] as number), 0);
  const earnings = sum('totalEarnings');
  const cost = sum('totalCost');
  const profit = sum('profit');
  const km = sum('kmDriven');
  const hours = sum('hoursWorked');
  const days = entries.length;
  return {
    days,
    earnings,
    cost,
    profit,
    km,
    hours,
    avgProfit: days > 0 ? profit / days : 0,
    avgEarnings: days > 0 ? earnings / days : 0,
    profitPerKm: km > 0 ? profit / km : 0,
    profitPerHour: hours > 0 ? profit / hours : 0,
  };
}

export async function exportHistoryPdf(entries: DailyEntry[]): Promise<SaveBlobPath> {
  const SCOPE = 'exportHistoryPdf';
  const tStart = performance.now();
  exportTelemetry.step(SCOPE, 'begin', {
    entriesCount: entries.length,
    firstDate: entries[0]?.date ?? null,
    lastDate: entries[entries.length - 1]?.date ?? null,
  });
  try {
    const doc = new jsPDF();
    exportTelemetry.step(SCOPE, 'jspdf_instance_created');

  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Visionario Delivery Pro', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório de Histórico', 14, 19);
  doc.text(`Gerado em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, 14, 24);

  let y = 38;
  doc.setTextColor(15, 23, 42);

  // Geral
  const total = summarize(entries);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', 14, y);
  y += 2;
  autoTable(doc, {
    startY: y + 3,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    head: [['Dias', 'Ganhos', 'Custos', 'Lucro', 'Km', 'Horas', 'Lucro/km', 'Lucro/h']],
    body: [[
      total.days.toString(),
      fmt(total.earnings),
      fmt(total.cost),
      fmt(total.profit),
      total.km.toFixed(0),
      total.hours.toFixed(1),
      fmt(total.profitPerKm),
      fmt(total.profitPerHour),
    ]],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Médias semanais
  const weeks = aggregate(entries, weekKey);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Médias Semanais', 14, y);
  autoTable(doc, {
    startY: y + 3,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    head: [['Semana', 'Dias', 'Ganhos', 'Custos', 'Lucro', 'Média/dia', 'Km']],
    body: weeks.map(w => {
      const s = summarize(w.entries);
      return [w.label, s.days.toString(), fmt(s.earnings), fmt(s.cost), fmt(s.profit), fmt(s.avgProfit), s.km.toFixed(0)];
    }),
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Médias mensais
  const months = aggregate(entries, monthKey);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Médias Mensais', 14, y);
  autoTable(doc, {
    startY: y + 3,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    head: [['Mês', 'Dias', 'Ganhos', 'Custos', 'Lucro', 'Média/dia', 'Km']],
    body: months.map(m => {
      const s = summarize(m.entries);
      return [m.label, s.days.toString(), fmt(s.earnings), fmt(s.cost), fmt(s.profit), fmt(s.avgProfit), s.km.toFixed(0)];
    }),
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Detalhe diário
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  if (y > 250) { doc.addPage(); y = 20; }
  doc.text('Detalhamento Diário', 14, y);
  autoTable(doc, {
    startY: y + 3,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    styles: { fontSize: 8 },
    head: [['Data', 'Horas', 'Km', 'Ganhos', 'Custos', 'Lucro', 'Lucro/km']],
    body: entries.map(e => [
      fmtDate(e.date),
      e.hoursWorked.toFixed(1),
      e.kmDriven.toFixed(0),
      fmt(e.totalEarnings),
      fmt(e.totalCost),
      fmt(e.profit),
      fmt(e.profitPerKm),
    ]),
  });

    const filename = `visionario-delivery-${now.toISOString().slice(0, 10)}.pdf`;
    exportTelemetry.step(SCOPE, 'before_blob_output', { filename });
    let blob: Blob;
    try {
      blob = doc.output('blob');
    } catch (err) {
      exportTelemetry.error(SCOPE, 'doc_output_blob', err);
      throw err;
    }
    exportTelemetry.step(SCOPE, 'blob_created', {
      hasBlob: !!blob,
      size: blob?.size ?? 0,
      type: blob?.type ?? null,
      genDurationMs: Math.round(performance.now() - tStart),
    });
    if (!blob || blob.size === 0) {
      exportTelemetry.error(SCOPE, 'blob_invalid', new Error(`blob size=${blob?.size ?? 'null'}`));
    }
    exportTelemetry.step(SCOPE, 'before_saveBlob');
    const path = await saveBlob(blob, filename);
    exportTelemetry.step(SCOPE, 'saveBlob_returned', { path, totalMs: Math.round(performance.now() - tStart) });
    console.info('[exportHistoryPdf] delivery path:', path);
    return path;
  } catch (err) {
    exportTelemetry.error(SCOPE, 'unhandled', err);
    throw err;
  }
}

