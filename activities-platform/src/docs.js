// تحويل نصوص الميثاق واللائحة (صيغة مبسّطة شبيهة بـ Markdown) إلى HTML.
import fs from 'node:fs';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function parseDoc(source) {
  const lines = source.split(/\r?\n/);
  let title = '';
  let subtitle = '';
  const toc = [];
  const out = [];
  let list = null; // { type: 'ol'|'ul', items: [{ n, text, sub: [] }] }

  const flush = () => {
    if (!list) return;
    const tag = list.type;
    out.push(`<${tag}>` + list.items.map((it) => {
      const sub = it.sub.length ? `<ul>${it.sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>` : '';
      const value = tag === 'ol' ? ` value="${it.n}"` : '';
      return `<li${value}>${inline(it.text)}${sub}</li>`;
    }).join('') + `</${tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { continue; }
    let m;
    if ((m = line.match(/^# (.+)$/))) {
      flush();
      if (!title) title = m[1];
      else out.push(`<h2 class="doc-part">${inline(m[1])}</h2>`);
    } else if ((m = line.match(/^> (.+)$/))) {
      flush();
      subtitle = m[1];
    } else if ((m = line.match(/^## (.+)$/))) {
      flush();
      const id = `art-${toc.length + 1}`;
      toc.push({ id, title: m[1] });
      out.push(`<h3 class="doc-article" id="${id}">${inline(m[1])}</h3>`);
    } else if ((m = line.match(/^### (.+)$/))) {
      flush();
      out.push(`<h4 class="doc-sub">${inline(m[1])}</h4>`);
    } else if ((m = line.match(/^(\d+)[.-]\s*(.+)$/))) {
      if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] }; }
      list.items.push({ n: Number(m[1]), text: m[2], sub: [] });
    } else if ((m = line.match(/^- (.+)$/))) {
      if (list && list.type === 'ol') list.items.at(-1).sub.push(m[1]);
      else {
        if (!list) list = { type: 'ul', items: [] };
        list.items.push({ text: m[1], sub: [] });
      }
    } else if (line.startsWith('|')) {
      flush();
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      out.push(`<div class="doc-table"><table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
        + `<tbody><tr>${cells.map(() => '<td>&nbsp;</td>').join('')}</tr></tbody></table></div>`);
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return { title, subtitle, toc, html: out.join('\n') };
}

export function loadDocs(dir) {
  const docs = {};
  for (const slug of ['charter', 'bylaws']) {
    docs[slug] = { slug, ...parseDoc(fs.readFileSync(new URL(`${slug}.md`, dir), 'utf8')), pdf: `/docs/${slug}.pdf` };
  }
  return docs;
}
