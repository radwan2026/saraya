// Regenerate the PDF: from brand-guidelines/, wrap index.html into _p.html (doctype + <meta charset=utf-8> + body) then run: node build-pdf.cjs
const {chromium}=require('playwright');const path=require('path');
(async()=>{const W=1600,H=1131;const b=await chromium.launch();const p=await b.newPage({viewport:{width:W,height:H}});
await p.goto('file://'+path.resolve('_p.html'),{waitUntil:'networkidle'});
await p.addStyleTag({content:`
@page{size:${W}px ${H}px;margin:0}
html,body{background-color:#020B18!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background-attachment:scroll!important}
.nav,.toast,body::before{display:none!important}
*{animation:none!important;transition:none!important}
.hero{height:${H-8}px;overflow:hidden;display:flex;align-items:center;border:0}
.hero h1,.specimen,.specimen.b{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;color:#E7EEF6!important;-webkit-text-fill-color:#E7EEF6!important}
.specimen{color:#7BF1FF!important;-webkit-text-fill-color:#7BF1FF!important}
.hero h1 span{-webkit-text-fill-color:#16D3EE!important}
section.ch{break-before:page;border-bottom:0;padding-block:56px}
.panel,.sw,.app,.dont,.tile,.slogan,.say,.ge,.lockup,.grad,.scale .row,.parts li,.anatomy{break-inside:avoid}

footer{break-before:page;height:${H-8}px;display:flex;align-items:center;padding:0!important}footer .wrap{flex-direction:column;justify-content:center;text-align:center;gap:40px}footer .f-brand{flex-direction:column;gap:24px}footer img{width:260px!important}footer .f-brand div div{font-size:3rem!important}footer small{font-size:1.1rem}
`});
await p.evaluate((H)=>{
  const split=(sec,startEl,suffix)=>{const n=document.createElement('section');n.className='ch';
    const w=document.createElement('div');w.className='wrap';const head=sec.querySelector('.ch-head').cloneNode(true);
    head.querySelector('h2').textContent+=' '+suffix;w.appendChild(head);
    let el=startEl;const move=[];while(el){move.push(el);el=el.nextElementSibling}move.forEach(m=>w.appendChild(m));
    n.appendChild(w);sec.after(n);return n};
  const us=document.getElementById('usage');const h3=[...us.querySelectorAll('h3')].find(h=>h.textContent.trim()==='لا تفعل');
  split(us,h3,'· لا تفعل');h3.style.marginTop='0';
  const lg=document.getElementById('logo');const lh=[...lg.querySelectorAll('h3')].find(h=>h.textContent.includes('صيغ'));split(lg,lh,'· الصيغ');lh.style.marginTop='0';
  document.querySelectorAll('#apps .app').forEach(f=>{f.classList.remove('a-wide');f.classList.add('a-half')});const apps=document.querySelector('#apps .apps');const figs=[...apps.children];
  const a2=document.createElement('div');a2.className='apps';figs.slice(4).forEach(f=>a2.appendChild(f));
  const asec=document.getElementById('apps');const n=split(asec,apps.nextElementSibling||(()=>{const d=document.createElement('div');apps.after(d);return d})(),'· الهدايا');n.querySelector('.wrap').appendChild(a2);
  document.querySelectorAll('section.ch').forEach(s=>{const w=s.querySelector('.wrap');const h=s.getBoundingClientRect().height;if(h>H-4){w.style.zoom=Math.max(.4,(H-170)/(h-112)).toFixed(3);}});
},H);
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
await p.emulateMedia({media:'screen'});
await p.pdf({path:'sadad-brand-guidelines.pdf',width:W+'px',height:H+'px',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
await b.close();})();
