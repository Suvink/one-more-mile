import { useMemo, useState } from 'react';
import { seedRoster, type Runner, type SeedResult } from '../lib/voice';

interface Parsed {
  rows: Runner[];
  errors: string[];
  fileName: string;
}

const TEMPLATE = 'bib,name\n1234,Jane Doe\n1122,John Smith\n0042,Alex Perera\n';

/** Parses a bib,name CSV (quoted fields allowed). */
function parseCsv(text: string): { rows: Runner[]; errors: string[] } {
  const errors: string[] = [];
  const rows: Runner[] = [];
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { rows, errors: ['The file is empty.'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (header[0] !== 'bib' || header[1] !== 'name') {
    errors.push('Header must be exactly: bib,name');
    return { rows, errors };
  }

  const seen = new Set<string>();
  lines.slice(1).forEach((line, idx) => {
    const cells = splitCsvLine(line);
    const bib = (cells[0] ?? '').trim();
    const name = (cells[1] ?? '').trim();
    const n = idx + 2;
    if (!bib) errors.push(`Line ${n}: missing bib`);
    else if (!name) errors.push(`Line ${n}: missing name`);
    else if (seen.has(bib)) errors.push(`Line ${n}: duplicate bib "${bib}"`);
    else {
      seen.add(bib);
      rows.push({ bib, name });
    }
  });
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type Status = 'idle' | 'uploading' | 'done';

export default function Admin() {
  const [secret, setSecret] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SeedResult[]>([]);

  const valid = useMemo(
    () => !!parsed && parsed.errors.length === 0 && parsed.rows.length > 0,
    [parsed]
  );

  function onFile(file: File) {
    setError(null);
    setStatus('idle');
    setResults([]);
    const reader = new FileReader();
    reader.onload = () => {
      const { rows, errors } = parseCsv(String(reader.result ?? ''));
      setParsed({ rows, errors, fileName: file.name });
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  }

  async function upload() {
    if (!parsed || !valid) return;
    setError(null);
    setStatus('uploading');
    try {
      const res = await seedRoster(parsed.rows, secret.trim());
      setResults(res.results);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
      setStatus('idle');
    }
  }

  function downloadLinks() {
    const csv =
      'bib,name,listen_link\n' +
      results.map((r) => `${r.bib},"${r.name}",${r.listen_link}`).join('\n') +
      '\n';
    download('roster-links.csv', csv);
  }

  return (
    <main className="page">
      <p className="eyebrow">One More Mile · Admin</p>
      <h1>Seed the roster</h1>
      <p className="lede">Upload a CSV of runners. Everyone gets a private listen link.</p>

      <button
        type="button"
        className="link-download"
        onClick={() => download('roster-template.csv', TEMPLATE)}
      >
        ↓ Download CSV template
      </button>

      <label className="field" style={{ marginTop: 18 }}>
        <span>Admin key</span>
        <input
          type="password"
          placeholder="Your admin key"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
        />
      </label>

      <label className="dropzone">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <span className="dz-title">{parsed ? parsed.fileName : 'Choose a CSV file'}</span>
        <span className="dz-sub">bib, name — one runner per row</span>
      </label>

      {parsed && parsed.errors.length > 0 && (
        <div className="validation">
          <p className="v-head">{parsed.errors.length} problem(s) — fix and re-select:</p>
          <ul>
            {parsed.errors.slice(0, 12).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {parsed.errors.length > 12 && <li>…and {parsed.errors.length - 12} more</li>}
          </ul>
        </div>
      )}

      {parsed && valid && status !== 'done' && (
        <div className="preview">
          <p className="v-head ok">
            {parsed.rows.length} runner{parsed.rows.length === 1 ? '' : 's'} ready to upload.
          </p>
          <div className="preview-table" role="table">
            {parsed.rows.slice(0, 6).map((r) => (
              <div className="preview-row" role="row" key={r.bib}>
                <span className="tnum bibcell">{r.bib}</span>
                <span>{r.name}</span>
              </div>
            ))}
            {parsed.rows.length > 6 && (
              <div className="preview-row muted">…and {parsed.rows.length - 6} more</div>
            )}
          </div>
        </div>
      )}

      {error && <p className="error-inline">{error}</p>}

      {status !== 'done' && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 20 }}
          disabled={!valid || !secret.trim() || status === 'uploading'}
          onClick={upload}
        >
          {status === 'uploading' ? 'Uploading…' : 'Upload roster'}
        </button>
      )}

      {status === 'done' && (
        <div className="done-block">
          <div className="confirm">
            <span className="lbl">Seeded</span>
            <span className="who tnum">{results.length} runners</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={downloadLinks}>
            ↓ Download links CSV
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setParsed(null);
              setResults([]);
              setStatus('idle');
            }}
          >
            Upload another
          </button>
        </div>
      )}
    </main>
  );
}
