// تحويل SVG الختم إلى PDF متجه (المنحنيات تبقى منحنيات، قابلة للتعديل في Illustrator).
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

const MM = 72 / 25.4;

export function svgToPdf(svg, { widthMm, heightMm, title = 'Khatmi seal' }) {
  return new Promise((resolve, reject) => {
    const w = (widthMm + 2) * MM;
    const h = (heightMm + 2) * MM;
    const doc = new PDFDocument({ size: [w, h], margin: 0, info: { Title: title, Creator: 'Khatmi - ختمي', Producer: 'Khatmi' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    SVGtoPDF(doc, svg, 0, 0, { width: w, height: h, preserveAspectRatio: 'xMidYMid meet', assumePt: false });
    doc.end();
  });
}
