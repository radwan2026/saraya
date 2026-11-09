const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
  const [,,mode,a,b,out]=process.argv;
  const browser=await chromium.launch({args:['--allow-file-access-from-files','--disable-web-security']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('console',m=>console.log('PAGE',m.text()));page.on('pageerror',e=>console.log('ERR',e.message));
  await page.goto('file://'+path.resolve(__dirname,'ad.html'));await page.evaluate(()=>window.ready);
  fs.mkdirSync(out,{recursive:true});
  const times = mode==='stills' ? a.split(',').map(Number) : null;
  const frames = times ? times.map(t=>Math.round(t*30)) : Array.from({length:+b-+a},(_,i)=>+a+i);
  for(const f of frames){
    const data=await page.evaluate(async f=>{await window.render(f/30);return document.getElementById('c').toDataURL('image/jpeg',0.95)},f);
    fs.writeFileSync(path.join(out,(times?'t'+(f/30).toFixed(2):String(f).padStart(5,'0'))+'.jpg'),Buffer.from(data.split(',')[1],'base64'));
  }
  await browser.close();
})();
