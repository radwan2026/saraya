// أيقونات SVG مرسومة يدوياً (تُستخدم في شاشة اللعبة ولوحة التحكم)

const svg = (body, vb = '0 0 64 64') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  rose: svg(`
    <defs><radialGradient id="ir" cx="45%" cy="40%"><stop offset="0" stop-color="#ff8fb1"/><stop offset="1" stop-color="#c2134d"/></radialGradient></defs>
    <path d="M32 40 C30 50 30 56 31 62" stroke="#2f8f4e" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M31 52 C22 50 18 44 19 42 C26 42 30 46 31 52Z" fill="#3fae62"/>
    <path d="M32 52 C40 49 45 45 45 42 C38 42 33 46 32 52Z" fill="#2f8f4e"/>
    <path d="M32 8 C44 8 50 18 47 28 C45 36 39 41 32 41 C25 41 19 36 17 28 C14 18 20 8 32 8Z" fill="url(#ir)"/>
    <path d="M32 14 C38 16 41 22 38 28 C35 33 28 32 27 27 C26 22 30 21 32 24" stroke="#8a0d36" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M20 22 C24 30 30 34 38 34" stroke="#ffb3c8" stroke-width="1.6" fill="none" opacity=".7"/>`),
  heart: svg(`
    <defs><linearGradient id="ih" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a9c"/><stop offset="1" stop-color="#e0184f"/></linearGradient></defs>
    <path d="M32 56 C14 44 6 34 6 23 C6 14 13 8 21 8 C26 8 30 11 32 15 C34 11 38 8 43 8 C51 8 58 14 58 23 C58 34 50 44 32 56Z" fill="url(#ih)"/>
    <path d="M16 18 C18 14 22 13 25 14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`),
  donut: svg(`
    <defs><radialGradient id="id" cx="50%" cy="45%"><stop offset=".3" stop-color="#ffd6a0"/><stop offset="1" stop-color="#c47a2c"/></radialGradient></defs>
    <circle cx="32" cy="33" r="25" fill="url(#id)"/>
    <path d="M10 30 C12 16 22 9 32 9 C44 9 53 17 54 29 C50 27 49 33 44 31 C40 29 38 34 33 32 C28 30 26 35 21 32 C17 30 14 33 10 30Z" fill="#ff7eb6"/>
    <circle cx="32" cy="33" r="8" fill="#1a1030"/>
    <g stroke-width="2.6" stroke-linecap="round"><path d="M20 20l3 2" stroke="#fff"/><path d="M38 16l3-1" stroke="#7df9ff"/><path d="M45 24l2 3" stroke="#ffe066"/><path d="M27 14l-2 2" stroke="#9cff8a"/><path d="M16 27l3 0" stroke="#7df9ff"/></g>`),
  perfume: svg(`
    <defs><linearGradient id="ip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c6ff"/><stop offset="1" stop-color="#8b3fd9"/></linearGradient></defs>
    <rect x="27" y="4" width="10" height="8" rx="2" fill="#f2c14e"/>
    <rect x="29" y="12" width="6" height="6" fill="#d9a43a"/>
    <path d="M18 24 C18 20 22 18 26 18 H38 C42 18 46 20 46 24 V54 C46 58 42 60 38 60 H26 C22 60 18 58 18 54Z" fill="url(#ip)"/>
    <path d="M32 28 L36 36 L32 44 L28 36Z" fill="#fff3" stroke="#fff8" stroke-width="1.5"/>
    <path d="M23 26 V50" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
    <g fill="#f3d6ff"><circle cx="50" cy="10" r="2.4"/><circle cx="56" cy="16" r="1.8"/><circle cx="52" cy="22" r="1.4"/></g>`),
  lantern: svg(`
    <defs><radialGradient id="il" cx="50%" cy="55%"><stop offset="0" stop-color="#fff6d0"/><stop offset=".5" stop-color="#ffc861"/><stop offset="1" stop-color="#d97a10"/></radialGradient></defs>
    <path d="M32 2 V8" stroke="#c99a3a" stroke-width="2.5"/>
    <circle cx="32" cy="4" r="3" fill="none" stroke="#c99a3a" stroke-width="2"/>
    <path d="M22 14 Q32 6 42 14Z" fill="#b8862b"/>
    <rect x="20" y="14" width="24" height="4" rx="1" fill="#d9a43a"/>
    <path d="M20 18 C14 30 14 42 22 52 H42 C50 42 50 30 44 18Z" fill="url(#il)"/>
    <path d="M32 20 V50 M24 22 C21 32 21 40 26 50 M40 22 C43 32 43 40 38 50" stroke="#a8641a" stroke-width="1.6" fill="none" opacity=".7"/>
    <rect x="22" y="52" width="20" height="4" rx="1" fill="#d9a43a"/>
    <path d="M28 56 L32 62 L36 56Z" fill="#b8862b"/>`),
  star: svg(`<path d="M32 4 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24Z" fill="#ffd27a" stroke="#fff3c4" stroke-width="2" stroke-linejoin="round"/>`),
  dove: svg(`
    <path d="M10 38 C18 30 30 30 40 34 C46 30 52 30 56 32 C52 34 50 36 48 40 C44 50 30 54 18 48 L6 52 L12 44Z" fill="#fff"/>
    <path d="M24 34 C22 20 30 10 40 6 C38 16 38 26 34 34Z" fill="#e8f0ff"/>
    <circle cx="50" cy="34" r="1.6" fill="#223"/>
    <path d="M56 32 L62 33 L56 35Z" fill="#ffb347"/>`),
  tasbih: svg(`
    <g fill="#7be0c3" stroke="#0b5b48" stroke-width="1">
      ${Array.from({ length: 14 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 14 - Math.PI / 2;
        return `<circle cx="${32 + Math.cos(a) * 20}" cy="${28 + Math.sin(a) * 20}" r="4.2"/>`;
      }).join('')}
    </g>
    <path d="M32 48 V56" stroke="#d9a43a" stroke-width="3"/>
    <path d="M28 56 H36 L34 62 H30Z" fill="#d9a43a"/>`),
  crown: svg(`<path d="M6 46 L10 18 L22 32 L32 12 L42 32 L54 18 L58 46Z" fill="#ffd27a" stroke="#fff1c2" stroke-width="2" stroke-linejoin="round"/><rect x="6" y="46" width="52" height="8" rx="2" fill="#e0a83a"/><circle cx="32" cy="38" r="4" fill="#ff5c8a"/>`),
  moon: svg(`<path d="M40 6 C26 8 16 20 16 34 C16 48 28 60 42 58 C30 54 24 44 24 32 C24 20 30 10 40 6Z" fill="#ffd27a"/><path d="M46 20 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1Z" fill="#fff3c4"/>`),
  book: svg(`<path d="M6 14 C16 10 26 12 32 18 C38 12 48 10 58 14 V52 C48 48 38 50 32 56 C26 50 16 48 6 52Z" fill="#0f766e"/><path d="M32 18 V56" stroke="#ffd27a" stroke-width="2"/><path d="M12 20 C18 18 24 19 28 22 M36 22 C40 19 46 18 52 20" stroke="#ffd27a" stroke-width="2" fill="none"/>`),
  gift: svg(`<rect x="8" y="24" width="48" height="12" rx="2" fill="#ffd27a"/><rect x="12" y="36" width="40" height="22" rx="2" fill="#e0a83a"/><rect x="29" y="24" width="6" height="34" fill="#c2134d"/><path d="M32 24 C24 10 12 14 18 22Z M32 24 C40 10 52 14 46 22Z" fill="#c2134d"/>`),
  heartLike: svg(`<path d="M32 56 C14 44 6 34 6 23 C6 14 13 8 21 8 C26 8 30 11 32 15 C34 11 38 8 43 8 C51 8 58 14 58 23 C58 34 50 44 32 56Z" fill="#ff4f7b"/>`),
};

export const GIFT_ICON = { rose: 'rose', heart: 'heart', donut: 'donut', perfume: 'perfume', other: 'gift' };
