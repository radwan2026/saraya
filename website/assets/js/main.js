// بيانات الخدمات — الصور من مجلد assets/images (صور الشركة)، مع صورة احتياطية إن لم تتوفر
const U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=75`;
const L = (f) => `assets/images/${f}`;
const services = [
  { t: 'الإمدادات الغذائية والخدمات التموينية', d: 'متابعة أحدث التقنيات والممارسات العالمية في مجال التموين وتوريد المواد الغذائية.', img: L('top-view-tin-can-plate.jpg'), alt: U('photo-1542838132-92c53300491e') },
  { t: 'الملابس والمنتجات الجلدية', d: 'توريد الملابس الفاخرة والزي الموحد والمنتجات الجلدية عالية الجودة.', img: L('shoes-accessories-men-lay-wooden-floor.jpg'), alt: U('photo-1489987707025-afc232f7ea0f') },
  { t: 'حلول الإلكترونيات وتقنية المعلومات', d: 'حلول تكنولوجية متكاملة ومبتكرة تواكب أحدث التطورات في مجالات الإلكترونيات.', img: L('new-modern-wifi-repeater-light-gray-background.jpg'), alt: U('photo-1518770660439-4636190af475') },
  { t: 'قطع غيار السيارات', d: 'قطع الغيار الأصلية والمعتمدة مع الحرص على توفير أعلى معايير الجودة.', img: L('gear-metal-wheels-isolated-white-background.jpeg'), alt: U('photo-1486262715619-67b85e0b08d3') },
  { t: 'مواد التنظيف والصحة العامة', d: 'حلول متكاملة لضمان بيئة نظيفة وصحية على أعلى مستويات الجودة.', img: L('stack-toilet-paper-rolls-shelf.jpg'), alt: U('photo-1581578731548-c64695cc6952') },
  { t: 'تركيبات الاتصالات والشبكات', d: 'تصميم الشبكات السلكية واللاسلكية وتركيب الأنظمة والصيانة الدورية مع دعم فني متخصص.', img: L('fusion-unique-mandala-designs.jpg'), alt: U('photo-1558494949-ef010cbdcc31') },
  { t: 'مواد البناء وورش العمل', d: 'مواد بناء عالية الجودة تلتزم بأعلى معايير السلامة عبر شبكة موردين موثوقين.', img: L('people-renovating-house-concept.jpg'), alt: U('photo-1504307651254-35680f356dfd') },
  { t: 'معدات المكاتب والمباني', d: 'تجهيز المكاتب والمباني بأعلى معايير الجودة والابتكار.', img: L('lifestyle.jpg'), alt: U('photo-1497366216548-37526070297c') },
  { t: 'الاستشارات والتطوير', d: 'خدمات التطوير التنظيمي والتكنولوجي التي تحوّل التحديات إلى فرص نجاح.', img: L('businessmen-discussion-technology-outdoors-concept.jpg'), alt: U('photo-1552664730-d307ca884978') },
  { t: 'الخدمات الفنية والصيانة', d: 'أحدث الأدوات لتشخيص المشكلات وتنفيذ الصيانة الوقائية والدورية بأعلى معايير الجودة.', img: L('close-up-metallic-keys.jpeg'), alt: U('photo-1581092160562-40aa08e78837') },
  { t: 'أنظمة الأمان والمراقبة', d: 'كاميرات المراقبة وأنظمة الإنذار والتحكم في الدخول مع الصيانة والدعم المستمر.', img: L('closeup-cctv-camera-wall.jpg'), alt: U('photo-1557597774-9d273605dfa9') },
  { t: 'معدات الصوت والفيديو والاتصالات', d: 'أنظمة متكاملة تجمع بين الأداء العالي وسهولة الاستخدام.', img: L('table-with-content-creator-stuff-camera-microphone-camera-lens-headphones-working-from-home.jpg'), alt: U('photo-1598488035139-bdbb2231ce04') },
  { t: 'معدات المستندات والحواسيب', d: 'الطابعات وأجهزة النسخ والحواسيب المكتبية والمحمولة وأنظمة التخزين الرقمي.', img: L('top-view-desktop-with-laptop-glasses.jpg'), alt: U('photo-1593642632559-0c6d3fc62b89') },
];



const grid = document.getElementById('servicesGrid');
const select = document.getElementById('serviceSelect');
services.forEach((s, i) => {
  const card = document.createElement('article');
  card.className = 'service-card reveal';
  card.innerHTML = `
    <div class="service-img"><img src="${s.img}" data-alt="${s.alt}" alt="${s.t}" loading="lazy" onerror="imgFallback(this)"><span class="service-no">${String(i + 1).padStart(2, '0')}</span></div>
    <div class="service-body"><h3>${s.t}</h3><p>${s.d}</p></div>`;
  grid.appendChild(card);
  select.add(new Option(s.t, s.t));
});
document.querySelector('[data-count]').dataset.count = services.length;

// قائمة الجوال
const toggle = document.getElementById('navToggle');
const nav = document.getElementById('mainNav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open'); toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', false);
}));

// ظل الهيدر عند التمرير
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ظهور العناصر + العدادات
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

document.querySelectorAll('[data-count]').forEach(el => {
  const target = +el.dataset.count, suffix = el.dataset.suffix || '';
  let n = 0; const step = Math.max(1, Math.ceil(target / 40));
  const t = setInterval(() => { n = Math.min(target, n + step); el.textContent = n + suffix; if (n >= target) clearInterval(t); }, 30);
});

// نموذج الاتصال: يفتح البريد بالبيانات (استبدله بخدمة نماذج لاحقاً مثل Formspree)
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = `الاسم: ${f.get('name')}\nالهاتف: ${f.get('phone')}\nالبريد: ${f.get('email')}\nالخدمة: ${f.get('service')}\n\n${f.get('message')}`;
  window.location.href = `mailto:Info@vanguard.ly?subject=${encodeURIComponent('طلب من الموقع - ' + (f.get('service') || 'استفسار'))}&body=${encodeURIComponent(body)}`;
  document.getElementById('formNote').textContent = 'شكراً لتواصلك! سيتم فتح بريدك لإرسال الرسالة.';
});

document.getElementById('year').textContent = new Date().getFullYear();
