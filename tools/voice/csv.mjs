// Tiny RFC 4180 CSV reader/writer for lines.csv (id,lang,text). UTF-8, with a BOM so
// Excel/Google Sheets open Hindi text correctly; the reader ignores the BOM.

export function toCsv(rows) {
  const cell = v => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/** Reads lines.csv text into [{id, lang, text}], checking the header. */
export function readLines(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }
  const [header, ...body] = rows;
  if (header.join(',') !== 'id,lang,text') {
    throw new Error('lines.csv must start with the header "id,lang,text"');
  }
  return body.map(([id, lang, text]) => ({ id, lang, text }));
}

export function writeLines(lines) {
  return toCsv([['id', 'lang', 'text'], ...lines.map(l => [l.id, l.lang, l.text])]);
}
