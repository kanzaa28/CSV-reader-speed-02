// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01-run-20261121).
//
// Same answers as the reference, byte for byte, on every input. The reference
// walks the text one character at a time; this one jumps field to field with
// native scans (RegExp for unquoted delimiters, indexOf for quotes) and only
// touches characters that change the answer: doubled quotes, CR/LF inside
// quotes, stray CRs, and the characters after a closing quote.
//
// Policy (csv-reader 1.0.0, restated from the kit's RULES.txt):
// - U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (stray_cr).
// - A field opening with a quote runs to the next quote that is not doubled;
//   "" inside it is one quote; each CRLF or lone CR inside it reads as LF.
//   What follows the closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends).
// - A quote that never closes is a literal character and the text after it is
//   read again as unquoted (unterminated_quote).
// - A quote inside an unquoted field is a literal character.
// - columns is the first record when header is true, else null; rows are the
//   records after it, each padded (short_row) or cut (long_row) to the first
//   record's width. Errors are {code, line, row} in the order met.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on, its index in rows (null: header).
  let recLine = 1;
  let recRow = null;

  // One shared scanner for unquoted delimiters; lastIndex is reset per field.
  const SEP = /[,\r\n]/g;
  // Normalises CR/LF inside a quoted segment to LF, counting the lines.
  const BREAKS = /\r\n?|\n/g;

  function err(code) {
    errors.push({ code, line: recLine, row: recRow });
  }

  // Reads unquoted characters onto `value` from pos up to the next comma or
  // line break. A CR not followed by LF is dropped (stray_cr) and skipped.
  // Returns {value, ended, added}: added counts the characters kept.
  function readUnquoted(value) {
    let added = 0;
    SEP.lastIndex = pos;
    let m;
    while ((m = SEP.exec(text)) !== null) {
      const i = m.index;
      const c = m[0];
      if (c === ',') {
        if (i > pos) { value += text.slice(pos, i); added += i - pos; }
        pos = i + 1;
        return { value, ended: COMMA, added };
      }
      if (c === '\n') {
        if (i > pos) { value += text.slice(pos, i); added += i - pos; }
        pos = i + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // c === '\r'
      if (text.charCodeAt(i + 1) === 10) {
        if (i > pos) { value += text.slice(pos, i); added += i - pos; }
        pos = i + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      err('stray_cr');
      if (i > pos) { value += text.slice(pos, i); added += i - pos; }
      pos = i + 1;
      // SEP.lastIndex already sits past the CR; keep scanning.
    }
    if (pos < n) { value += text.slice(pos); added += n - pos; }
    pos = n;
    return { value, ended: END, added };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        err('unterminated_quote');
        return readUnquoted('"');
      }
      if (q > pos) {
        const seg = text.slice(pos, q);
        if (seg.indexOf('\r') === -1 && seg.indexOf('\n') === -1) {
          value += seg;
        } else {
          value += seg.replace(BREAKS, () => { line += 1; return '\n'; });
        }
      }
      if (text.charCodeAt(q + 1) === 34) {
        // Doubled quote: one literal quote, keep reading.
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      if (pos >= n) return { value, ended: END };
      const c = text.charCodeAt(pos);
      if (c === 44) { // ','
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) { // '\n'
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) { // CRLF
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands.
      const junk = readUnquoted(value);
      if (junk.added > 0) err('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recLine = line;
    recRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
