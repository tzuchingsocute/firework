export const palettes = [
 ['#f5dfac','#c29de0','#96dce0','#edb7d5'],
 ['#a9d7f1','#eca8c7','#b3e4cf','#e3c397'],
 ['#dfb2ea','#91d7db','#e5d6aa','#9cbbef'],
 ['#b8e2cb','#dfbe8b','#aebcea','#efbad6'],
]
export function createComposition(seed=0) {
 const colors=palettes[(seed>>>0)%palettes.length]
 return {seed,colors,fireworks:[
  {x:0,y:0,size:1,color:colors[0],brightness:1,main:{start:0,end:1440},secondary:{x:22,y:-40,size:.32,start:380,end:1250,color:colors[2]},sparkles:{start:480,end:1440}},
  {x:-110,y:-14,size:.4,color:colors[1],brightness:.65,main:{start:470,end:1320}},
  {x:101,y:14,size:.32,color:colors[2],brightness:.62,main:{start:610,end:1400}},
 ],sparkles:{start:540,end:1440,color:colors[3]}}
}
