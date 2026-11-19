import { ExpressionManager, names } from '../src/expression/manager.js'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createFaceVideo } from './face-fixture.js'
const temp=mkdtempSync(join(tmpdir(),'firework-stage2-'))
const run=(tool,args,env={})=>spawnSync(process.execPath,[resolve('node_modules/.bin',tool),...args],
  {encoding:'utf8',env:{...process.env,...env},maxBuffer:16*1024*1024})
const build=run('vite',['build'])
const unitPath=join(temp,'unit.json')
const unit=run('vitest',['run','tests/expression.test.js','tests/effect-controller.test.js','--reporter=json','--outputFile',unitPath])
const browser=build.status===0 ? run('playwright',['test','tests/expression.spec.js','--reporter=json'],{STAGE2_VIDEO:createFaceVideo({portraitFraming:true})}) : null
let raw
try {raw=JSON.parse(browser?.stdout)} catch {}
const result=raw?.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.at(-1)
const mockPass=unit.status===0
const realPass=result?.status==='passed'
const dimensions=[
  {name:'表情数据获取',max:15,score:realPass?15:0,status:realPass?'PASS':'BLOCKED',evidence:result?.attachments,reason:realPass?null:'真实模型推理测试未通过',errors:result?.errors},
  {name:'表情分类',max:30,score:0,status:'BLOCKED',reason:'缺少独立真人 Neutral/Smile/Laugh 标注视频，肖像推理仅验证数据接口'},
  {name:'状态切换与稳定性',max:20,score:mockPass?20:0,status:mockPass?'PASS':'FAIL',scope:'Mock Blendshape 状态机'},
  {name:'说话误触发控制',max:15,score:0,status:'BLOCKED',reason:'Mock 已覆盖张嘴及撅嘴输入，缺少真实说话标注视频'},
  {name:'事件输出与模块解耦',max:15,score:mockPass?15:0,status:mockPass?'PASS':'FAIL',scope:'Mock 状态事件，独立模块仅依赖 EventTarget'},
  {name:'性能与异常处理',max:5,score:mockPass?2:0,status:'PARTIAL',reason:'2 分为本地计算与异常单测，剩余 3 分需真实设备性能对照'},
]
const mockMetrics = { source: 'Mock Blendshapes only', transitionMs: [], falseLaughStarts: 0, steadySwitches: 0 }
for (const interval of [16, 40, 100]) {
  const manager = new ExpressionManager()
  let started
  manager.addEventListener('expression:laugh:start', event => { started = event.detail.timestamp })
  for (let time = 0; time <= 2000; time += interval) {
    manager.update(names.map((categoryName, i) => ({ categoryName, score: [.95,.95,0,0,0,.8,.8,.6,.6][i] })), true, time)
  }
  mockMetrics.transitionMs.push(started)
}
const speech = new ExpressionManager()
speech.addEventListener('expression:laugh:start', () => mockMetrics.falseLaughStarts++)
let last
for (let time = 0; time <= 60000; time += 40) {
  const result = speech.update(names.map((categoryName,i) => ({ categoryName,
    score: [.5,.5,time%400<160?.8:.05,0,0,.1,.1,.2,.2][i] })), true,time)
  if (time > 2000 && result.state !== last) mockMetrics.steadySwitches++
  last = result.state
}
mockMetrics.latencyMeanMs = mockMetrics.transitionMs.reduce((sum,value)=>sum+value,0)/mockMetrics.transitionMs.length
mockMetrics.latencyP95Ms = [...mockMetrics.transitionMs].sort((a,b)=>a-b).at(-1)
const qualityMetrics = {
  strongSmileRecall: { status: 'BLOCKED', target: .9, reason: '需要独立标注的闭嘴、露齿和张嘴强烈笑容视频' },
  falseLaughPerMinute: { status: 'BLOCKED', target: 1, reason: '需要真实正常说话及微笑说话视频' },
  transitionLatency: { status: 'PARTIAL', reason: '仅计算 Mock 状态机延迟，未计真实推理与标注起始时间' },
  stateFlicker: { status: 'PARTIAL', reason: '仅验证 Mock 稳定输入' },
  calibrationEffectiveness: { status: 'BLOCKED', reason: '需要与个人校准不同的独立验收片段' },
}
const report={qualityMetrics, mockMetrics, generatedAt:new Date().toISOString(),build:build.status===0?'PASS':'FAIL',dimensions,
 score:dimensions.reduce((s,d)=>s+d.score,0),max:100,realDevice:'REAL_DEVICE_PENDING',
 classificationAccuracy:'BLOCKED',verdict:mockPass&&realPass?'LOGIC_AND_INFERENCE_PASSED / REAL_DEVICE_PENDING':'AUTO_TEST_NOT_PASSED',
 unit:JSON.parse(readFileSync(unitPath,'utf8')),browserErrors:raw?.errors,logs:{build:build.stderr,unit:unit.stderr,browser:browser?.stderr},
 fixture:'Public-domain still portrait replay; no expression ground truth'}
mkdirSync('reports',{recursive:true})
writeFileSync('reports/stage2-report.json',JSON.stringify(report,null,2))
writeFileSync('reports/stage2-summary.md',[
 '# Stage 02',report.verdict,`已获得 ${report.score}/100，待验证 ${100-report.score} 分。`,
 ...dimensions.map(d=>`- ${d.name} · ${d.status} · ${d.score}/${d.max} · ${d.reason??d.scope??'真实模型输出'}`),
 '真实表情准确率 BLOCKED。尚未完成真实设备验收。',
].join('\n\n'))
console.log(report.verdict,report.score+'/100','reports/stage2-report.json')
process.exitCode=mockPass&&realPass&&build.status===0?0:1
