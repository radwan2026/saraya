const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch({proxy: process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
const p=await b.newPage({viewport:{width:1396,height:958}});
await p.emulateMedia({colorScheme:'light',media:'print'});
await p.goto('file://'+require('path').join(__dirname,'index.html'),{waitUntil:'networkidle'});
await p.addStyleTag({content:`
 .toc{display:none} .layout{display:block!important;padding-block:0!important}
 main{display:block!important}
 section{display:block!important;break-before:page;padding-top:4px}
 section > * + *{margin-top:22px}
 .cover{height:940px;display:flex;align-items:center;break-after:page}
 .cover-logo{width:340px!important}
 .panel,.sw,.ver,.dont,.apps figure,.story,.anatomy,.clear-box,.motif,.parts li,.scale .row,.swatches,.versions,.donts,.voice,.grid-2,.chapter{break-inside:avoid}
 .chapter{break-after:avoid}
 footer{display:none}
 .wrap{max-width:none!important;padding-inline:48px!important}
 .parts{gap:10px!important} .parts p{font-size:.92rem;line-height:1.6} .intro{max-width:none!important}
 .sw{grid-template-rows:84px auto!important} .gradient-bar{height:56px!important} .anatomy{padding:18px!important}
 .concept{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)!important}
 .cover-orbit ellipse{animation:none!important}
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`});
await p.evaluate(()=>document.fonts.ready);
console.log(await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family).join(',')));
await p.pdf({path:require('path').join(__dirname,'activities-committee-brand-guide.pdf'),format:'A4',landscape:true,scale:0.75,printBackground:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});
await b.close();})();
