// Reusable local vector contours. No images, animation or formal effect imports.
export function paintBrushTip(ctx,type,x,y,size,angle,color,{hollow=false,projection=1}={}){
 if(type==='natural')return
 const inheritedAlpha=ctx.globalAlpha
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(projection,1)
 ctx.fillStyle=color;ctx.strokeStyle='#f4f8ff';ctx.lineWidth=.8
 const path=new Path2D()
 if(type==='star'){
  path.moveTo(0,-size);path.bezierCurveTo(size*.08,-size*.13,size*.13,-size*.08,size*.72,0);path.bezierCurveTo(size*.13,size*.08,size*.08,size*.13,0,size);path.bezierCurveTo(-size*.08,size*.13,-size*.13,size*.08,-size*.72,0);path.bezierCurveTo(-size*.13,-size*.08,-size*.08,-size*.13,0,-size)
 }else if(type==='butterfly'){
  path.moveTo(0,0);path.bezierCurveTo(-size*.3,-size,-size*1.15,-size*.9,-size*.85,-size*.12);path.bezierCurveTo(-size*1.05,size*.7,-size*.2,size*.8,0,size*.1);path.bezierCurveTo(size*.25,size*.8,size*1.05,size*.6,size*.8,-size*.1);path.bezierCurveTo(size*1.1,-size*.95,size*.2,-size*.85,0,0)
 }else if(type==='flower'){
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,b=a+Math.PI/5;path.moveTo(0,0);path.bezierCurveTo(Math.cos(a-.42)*size,Math.sin(a-.42)*size,Math.cos(a+.42)*size,Math.sin(a+.42)*size,0,0)}
 }else{
  for(let i=0;i<9;i++){const a=i*2.39,l=size*(.35+(i%4)*.15);path.moveTo(Math.cos(a)*l*.3,Math.sin(a)*l*.3);path.lineTo(Math.cos(a)*l,Math.sin(a)*l)}
 }
 // Nested translucent passes keep bright edges and a light-filled interior.
 ctx.globalAlpha=inheritedAlpha*.15;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.stroke(path);ctx.shadowBlur=0
 ctx.globalAlpha=inheritedAlpha*(type==='butterfly'||type==='flower'?.35:.8)
 if(hollow||type==='burst')ctx.stroke(path);else ctx.fill(path)
 ctx.globalAlpha=inheritedAlpha*.85;ctx.stroke(path)
 // Fixed broken glints tie the contour back into the granular brush.
 for(let i=0;i<11;i++){const a=i*2.39,r=size*(.2+(i%5)*.15);ctx.globalAlpha=inheritedAlpha*(.25+(i%3)*.2);ctx.fillRect(Math.cos(a)*r,Math.sin(a)*r,.7,1.2)}
 ctx.restore()
}
