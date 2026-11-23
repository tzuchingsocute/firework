import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:1000,height:1000}})
await page.goto('http://127.0.0.1:5193')
for(const single of [false,true]){
const bytes=await page.evaluate(async single=>{
 const {createRain,defaults}=await import('/src/rain/rain.js')
 const {createDropletAppearance:original}=await import('/src/rain/droplet-appearance.js')
 const {createDropletAppearance:main}=await import('/src/rain/main-droplet-preview.js')
 const c=document.createElement('canvas');c.width=828;c.height=896;document.body.append(c)
 const ctx=c.getContext('2d'),painters=[original(ctx),main(ctx)]
 let seed=1201;const rain=createRain(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32));rain.reset()
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))))
 const start=performance.now();let previous=start
 rec.start()
 function draw(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;rain.advance(dt,defaults)
 ctx.fillStyle='#15212b';ctx.fillRect(0,0,828,896)
 for(let side=0;side<2;side++){ctx.save();ctx.translate(side*414,0);ctx.beginPath();ctx.rect(0,0,414,896);ctx.clip()
 ctx.fillStyle='#e8f4f8';ctx.font='16px sans-serif';ctx.fillText(side?'Main droplet prototype':'Approved pearl',15,25)
 if(single){const progress=((now-start)/1000*.21)%1;ctx.translate(207,progress*896);ctx.scale(5,5);painters[side]({id:1,x:0,y:0,size:1,phase:1,tail:1,vx:0,vy:188.16},1,.85,20,defaults,{y:-progress*896,height:896})}
 else for(const d of rain.drops)painters[side](d,1,d.life*.75,20,defaults,{y:0,height:896})
 ctx.restore()}
 if(now-start<12000)requestAnimationFrame(draw);else rec.stop()}
 requestAnimationFrame(draw)
 const data=await done;c.remove();return data
},single)
await writeFile(`reports/main-droplet-${single?'single':'comparison'}.webm`,Buffer.from(bytes))
}
await browser.close()
