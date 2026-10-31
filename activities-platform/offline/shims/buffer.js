// Buffer مبسّط يكفي لاستخدامات الخادم داخل المتصفح.
const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const toB64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };

export class Bytes extends Uint8Array {
  toString(enc) {
    if (enc === 'hex') return toHex(this);
    if (enc === 'base64') return toB64(this);
    if (enc === 'base64url') return toB64(this).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return new TextDecoder().decode(this);
  }

  static from(v, enc) {
    if (typeof v === 'string') {
      if (enc === 'hex') return new Bytes((v.match(/../g) || []).map((h) => parseInt(h, 16)));
      if (enc === 'base64') { const s = atob(v); return new Bytes(Array.from(s, (c) => c.charCodeAt(0))); }
      return new Bytes(new TextEncoder().encode(v));
    }
    return new Bytes(v);
  }
}
globalThis.Buffer = globalThis.Buffer || Bytes;
