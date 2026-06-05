import { Shift } from './shifts';
import { saveBlob, type SaveBlobPath } from './saveBlob';

function fileSafe(name: string) {
  return name.replace(/[^a-z0-9_-]+/gi, '-');
}

async function trigger(filename: string, mime: string, content: string): Promise<SaveBlobPath> {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  return saveBlob(blob, filename);
}


function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

function nameFor(shift: Shift) {
  const d = shift.data_operacional || shift.inicio_turno.slice(0, 10);
  return fileSafe(`visionario-rota-${d}-${shift.turno_id.slice(-5)}`);
}

/** Exporta a rota do turno como GPX 1.1 (compatível com Google Earth, Strava, etc.). */
export async function exportRouteGpx(shift: Shift): Promise<boolean> {
  const pts = shift.rota || [];
  if (pts.length < 2) return false;
  const trkpts = pts
    .map(p => {
      const time = new Date(p.t).toISOString();
      const spd = typeof p.spd === 'number' ? `\n        <speed>${p.spd.toFixed(2)}</speed>` : '';
      const hdg = typeof p.hdg === 'number' ? `\n        <course>${p.hdg.toFixed(1)}</course>` : '';
      return `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${time}</time>${spd}${hdg}</trkpt>`;
    })
    .join('\n');
  const title = escapeXml(`Visionario Drive — ${shift.data_operacional}`);
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visionario Drive" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <time>${new Date(shift.inicio_turno).toISOString()}</time>
  </metadata>
  <trk>
    <name>${title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  const path = await trigger(`${nameFor(shift)}.gpx`, 'application/gpx+xml', gpx);
  console.info('[exportRouteGpx] delivery path:', path);
  return path !== 'failed';
}


/** Exporta a rota do turno como KML (Google Earth/Maps). */
export async function exportRouteKml(shift: Shift): Promise<boolean> {
  const pts = shift.rota || [];
  if (pts.length < 2) return false;
  const coords = pts.map(p => `${p.lng},${p.lat},0`).join(' ');
  const title = escapeXml(`Visionario Drive — ${shift.data_operacional}`);
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${title}</name>
    <Style id="vd-line">
      <LineStyle><color>ff3566ff</color><width>4</width></LineStyle>
    </Style>
    <Placemark>
      <name>${title}</name>
      <styleUrl>#vd-line</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
  const path = await trigger(`${nameFor(shift)}.kml`, 'application/vnd.google-earth.kml+xml', kml);
  console.info('[exportRouteKml] delivery path:', path);
  return path !== 'failed';
}

