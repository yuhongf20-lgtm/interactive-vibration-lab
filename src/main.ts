import Chart from 'chart.js/auto'
import type { ChartConfiguration } from 'chart.js'
import { defaults, experiment, modes } from './experiments'
import type { Inputs, Mode } from './experiments'
import { forcePeak, rates, sampleAt, tau } from './physics'
import { mountRod } from './rotor-page'
import { rodDefaults } from './rotor'
import { handoutUnit, mountHandout } from './handout-page'
import { mountSignal } from './signal-page'
import './style.css'

const root = document.querySelector<HTMLDivElement>('#app')!
const byId = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T
const fmt = (n:number) => Number(n.toPrecision(5)).toString()
const display = (n:number|null,unit:string) => n === null ? '無有限解' : fmt(n)+' '+unit
const colors = ['#39dac5','#ffba75','#aabaff','#f698ba','#d2ec69','#86cfff','#e2e7ed']
const fields: Record<keyof Inputs,[string,string,number,number,number]> = {
  m:['等效質量','kg',1,20,0.1], k:['彈簧剛度 k','N/m',10,2000,1], c:['黏滯阻尼 c','N·s/m',0,200,0.1],
  x0:['初始位移 x₀','m',-0.2,0.2,0.001],v0:['初始速度 v₀','m/s',-2,2,0.01],duration:['模擬時間','s',1,30,0.1],
  f:['激振頻率 f','Hz',0.1,10,0.01],force:['外力振幅 F₀','N',0,100,0.1],
}
let mode: Exclude<Mode, 'rotor'>
const rodSettings = {...rodDefaults}
let disposePage: (()=>void)|undefined
let p: Inputs, reference: Inputs
let data: ReturnType<typeof experiment>
let charts: Chart[] = []
const settings = new Map<Mode, Inputs>()
let overlay = true, stationary = false, playing = false, cursor = 0, speed = 1
let timeCharts: Chart[] = []
let updatePending = false
function hasForce() { return ['forced','resonance'].includes(mode) }
function readMode(): Mode {
  const key = location.hash.slice(1)
  return Object.hasOwn(modes,key) ? key as Mode : 'natural'
}

function diagram() {
  return `<svg viewBox="0 0 500 250" role="img" aria-label="可上下振動的質量、彈簧與阻尼器">
  <path d="M90 223H410 M100 233l10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10 m20 10 10-10" class="base"/>
  <path id="spring" class="spring"/><path id="damper" class="base"/>
  <text x="157" y="205">剛度 k</text><text x="318" y="205">阻尼 c</text>
  <g id="moving">
  <rect x="170" y="68" width="160" height="93" rx="10" class="machine"/><text x="214" y="120">質量 m</text>
  </g><path d="M443 81v70l-6-8 m6 8 6-8" class="spring"/><text x="455" y="125">+x</text></svg>`
}

function header(selection:Mode|'handout'|'signal') {
  return `<header><div class="wrap"><small>INTERACTIVE VIBRATION LAB</small><h1>互動式振動與旋轉機械模擬實驗室</h1>
    <nav aria-label="實驗導航">${Object.entries(modes).map(([id,title])=>`<a href="#${id}" ${id===selection?'aria-current="page"':''}>${title}</a>`).join('')}<a href="#handout" ${selection==='handout'?'aria-current="page"':''}>互動講義</a>${selection==='signal'?'<a href="#signal" aria-current="page">振動訊號分析</a>':''}</nav></div></header>`
}

function mount() {
  const selection = readMode()
  playing = false
  disposePage?.()
  disposePage = undefined
  const unit = handoutUnit(location.hash)
  const signal = location.hash === '#signal'
  if (unit !== null || signal || selection === 'rotor') {
    charts.forEach(chart=>chart.destroy())
    charts = []
    timeCharts = []
    if (unit !== null) {
      root.innerHTML = header('handout')+'<main class="wrap" id="handout"></main>'
      disposePage = mountHandout(byId('handout'),unit,rodSettings)
    } else if (signal) {
      root.innerHTML = header('signal')+'<main class="wrap" id="signal-page"></main>'
      mountSignal(byId('signal-page'))
      disposePage = ()=>{}
      window.scrollTo(0,0)
    } else {
      root.innerHTML = header(selection)+'<main class="wrap" id="rotor-page"></main>'
      disposePage = mountRod(byId('rotor-page'),rodSettings)
      window.scrollTo(0,0)
    }
    return
  }
  mode = selection
  p = settings.get(mode) ?? {...defaults}
  settings.set(mode,p)
  reference = {...p,m:Math.min(20,p.m*2)}
  overlay = true
  stationary = false
  const keys: (keyof Inputs)[] = mode === 'frf' ? ['m','k','c'] : ['m','k','c','x0','v0','duration']
  if (hasForce()) keys.push('force','f')
  root.innerHTML = header(mode)+`<main class="wrap"><h2>${modes[mode]}</h2><div class="layout"><aside class="panel"><h3>實驗參數</h3>
    ${keys.map(key=>{
      const [name,unit,min,max,step] = fields[key]
      const label = key === 'm' ? '質量 m' : name
      const upper = max
      return `<div class="control"><label for="range-${key}">${label} <span>(${unit})</span></label>
      <input id="num-${key}" aria-label="${label}，${unit}" type="number" min="${min}" max="${upper}" step="any">
      <input id="range-${key}" type="range" min="${min}" max="${upper}" step="${step}"></div>`
    }).join('')}
    ${['resonance','forced'].includes(mode)?'<div class="actions" id="presets"><button data-r=".3">低頻</button><button data-r="1">接近共振</button><button data-r="2">高頻</button></div>':''}
    ${mode !== 'damping'?'<label class="check"><input type="checkbox" id="overlay" checked> '+(hasForce()||mode==='frf'?'比較阻尼比':'疊加參考組')+'</label>':''}
    ${mode==='natural'||mode==='free'?'<div class="actions"><button id="save">以目前參數建立參考組</button></div><p id="reference"></p>':''}
    ${hasForce()?'<label class="check"><input type="checkbox" id="steady"> 理論穩態波形</label>':''}
    <div class="actions"><button id="reset">重設參數</button><button id="csv">下載 CSV</button></div><p id="error" role="alert"></p></aside>
    <section class="results">
    ${mode==='frf'?'':`<section class="panel"><h3>機械系統動畫</h3>${diagram()}
    <div class="actions"><button id="play">播放</button><button id="replay">重播</button>
    <label>速度 <select id="speed"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div>
    <label for="time">模擬時間 <output id="readout"></output></label><input id="time" type="range" min="0" step="any"></section>`}
    <div class="metrics" id="metrics"></div><div id="plots"></div></section></div>
    <section class="teaching panel" id="teaching"></section></main>`
  for (const key of keys) {
    const range = byId<HTMLInputElement>('range-'+key), number = byId<HTMLInputElement>('num-'+key)
    range.value = number.value = String(p[key])
    range.oninput = () => {
      p[key] = range.valueAsNumber
      number.value = range.value
      scheduleUpdate()
    }
    number.onchange = () => {
      if (Number.isFinite(number.valueAsNumber)) p[key] = Math.max(+range.min,Math.min(+range.max,number.valueAsNumber))
      range.value = number.value = String(p[key])
      scheduleUpdate()
    }
  }
  byId('reset').onclick = () => { settings.delete(mode); mount() }
  byId('csv').onclick = exportCsv
  const overlayInput = byId<HTMLInputElement>('overlay')
  if (overlayInput) overlayInput.onchange = () => { overlay = overlayInput.checked; scheduleUpdate() }
  const steadyInput = byId<HTMLInputElement>('steady')
  if (steadyInput) steadyInput.onchange = () => { stationary = steadyInput.checked; scheduleUpdate() }
  const save = byId('save')
  if (save) save.onclick = () => { reference = {...p}; scheduleUpdate() }
  document.querySelectorAll<HTMLButtonElement>('[data-r]').forEach(button => {
    button.onclick = () => {
      const {fn,z} = rates(p)
      const ratio = button.dataset.r === '1' ? forcePeak(z) ?? 1 : Number(button.dataset.r)
      p.f = Math.max(.1,Math.min(10,fn*ratio))
      byId<HTMLInputElement>('num-f').value = String(p.f)
      byId<HTMLInputElement>('range-f').value = String(p.f)
      scheduleUpdate()
    }
  })
  if (mode !== 'frf') {
    byId('play').onclick = () => {
      if (!playing && cursor >= p.duration) cursor = 0
      setPlaying(!playing)
    }
    byId('replay').onclick = () => { cursor = 0; setPlaying(true); paint() }
    byId<HTMLSelectElement>('speed').onchange = event => { speed = Number((event.currentTarget as HTMLSelectElement).value) }
    byId<HTMLInputElement>('time').oninput = event => {
      setPlaying(false)
      cursor = (event.currentTarget as HTMLInputElement).valueAsNumber
      paint()
    }
  }
  speed = 1
  update()
  window.scrollTo(0,0)
}

const cursorPlugin = {
  id:'simulationCursor',
  afterDraw(chart: Chart) {
    const {ctx,chartArea,scales} = chart
    const x = scales.x.getPixelForValue(sampleAt(data.series[0].points,cursor).t)
    ctx.save()
    ctx.strokeStyle = '#e6f1f5'
    ctx.setLineDash([4,4])
    ctx.beginPath()
    ctx.moveTo(x,chartArea.top)
    ctx.lineTo(x,chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

function plot(title:string,xLabel:string,yLabel:string,datasets: ChartConfiguration<'line'>['data']['datasets'],time=false) {
  const section = document.createElement('section')
  section.className = 'panel plot'
  const header = document.createElement('div')
  header.className = 'plot-header'
  const heading = document.createElement('h3')
  heading.textContent = title
  const button = document.createElement('button')
  button.textContent = '下載 PNG'
  header.append(heading,button)
  const frame = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role','img')
  canvas.setAttribute('aria-label',title+'，'+xLabel+'，'+yLabel)
  frame.append(canvas)
  section.append(header,frame)
  byId('plots').append(section)
  const chart = new Chart(canvas, {
    type:'line', data:{datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
      color:'#b9cbd7',interaction:{mode:'nearest',axis:'x',intersect:false},
      plugins:{legend:{labels:{usePointStyle:true}},tooltip:{callbacks:{
        label: context => context.dataset.label+' · '+fmt(context.parsed.y ?? 0)+' '+yLabel,
      }}},
      scales:{x:{type:'linear',title:{display:true,text:xLabel,color:'#b9cbd7'},grid:{color:'#22394a'},ticks:{color:'#b9cbd7'}},
        y:{title:{display:true,text:yLabel,color:'#b9cbd7'},grid:{color:'#22394a'},ticks:{color:'#b9cbd7'}}}},
    plugins:time?[cursorPlugin]:[],
  })
  button.onclick = () => download(chart.toBase64Image(),title+'.png')
  charts.push(chart)
  if (time) timeCharts.push(chart)
}

function drawPlots() {
  charts.forEach(chart=>chart.destroy())
  charts = []
  timeCharts = []
  byId('plots').replaceChildren()
  if (data.series.length) {
    // 只在繪圖時減少點數。CSV、積分和動畫仍取原始資料。
    const reduce = (points: typeof data.series[number]['points']) => {
      const plotted = Math.max(4200,Math.ceil(p.duration*data.omega/tau*12))
      const stride = Math.max(1,Math.floor(points.length/plotted))
      return points.filter((_,i)=>i%stride===0 || i===points.length-1)
    }
    plot(stationary && data.response.amplitude!==null?'理論穩態位移':'完整時間響應', '時間 (s)','位移 (m)',
      data.series.map(({label,points},i)=>({label,data:reduce(points).map(({t,x})=>({x:t,y:x})),borderColor:colors[i],pointRadius:0,borderWidth:1.6})),true)
    if (hasForce()) plot('輸入外力','時間 (s)','外力 (N)',data.series.map(({label,points},i)=>({
      label,data:reduce(points).map(({t,force})=>({x:t,y:force})),borderColor:colors[i],pointRadius:0,borderWidth:1.6,
    })),true)
  }
  if (!data.frequency.length) return
  const frequencySets: ChartConfiguration<'line'>['data']['datasets'] = data.frequency.map(({label,points},i)=>({
    label,data:points,borderColor:colors[i],pointRadius:0,borderWidth:1.6,
  }))
  const points = data.frequency[0].points
  const marker = (x:number|null,label:string,color:string) => {
    if (x===null) return
    const point = points.find(point=>point.x===x)
    if (point?.y != null) frequencySets.push({label,data:[point],pointRadius:6,backgroundColor:color,borderColor:color})
  }
  const markerTop = points.reduce((maximum,{y})=>Math.max(maximum,y ?? 0),0) || 1
  if (points.some(point=>point.x===data.axisNatural)) frequencySets.push({
    label:'自然頻率',data:[{x:data.axisNatural,y:0},{x:data.axisNatural,y:markerTop}],
    pointRadius:0,borderColor:'#e5eaf4',borderDash:[4,4],borderWidth:1,
  })
  marker(data.axisPeak,'理論峰值位置','#ffba75')
  if (hasForce()) {
    const current = points.find(point=>point.x===data.coordinate)
    if (current?.y == null) frequencySets.push({
      label:'目前工作點 · 理想奇點', data:[{x:data.coordinate,y:0},{x:data.coordinate,y:markerTop}],
      pointRadius:0,borderColor:'#ffba75',borderDash:[3,4],
    })
    else marker(data.coordinate,'目前工作點','#ffffff')
  }
  plot('固定外力頻率響應','頻率比 r',mode==='frf'?'柔度 (m/N)':'穩態振幅 (m)',frequencySets)
}

function setPlaying(value:boolean) {
  playing = value
  const button = byId('play')
  if (button) button.textContent = value?'暫停':'播放'
}

function paint() {
  if (!data.series.length) return
  const {t,x,force} = sampleAt(data.series[0].points,cursor)
  const offset = 31*Math.tanh(x/.12)
  const svg = (id:string) => document.getElementById(id)!
  svg('moving').setAttribute('transform',`translate(0 ${offset})`)
  const top = 161+offset, dy = (223-top)/8
  svg('spring').setAttribute('d',`M200 ${top} v${dy} `+Array.from({length:6},(_,i)=>`l${i===0?-10:i%2?20:-20} ${dy}`).join(' ')+` l-10 ${dy}`)
  svg('damper').setAttribute('d',`M299 ${top}V192 m-10 0h20 M289 181v21h20v-21 M299 202v21`)
  byId<HTMLInputElement>('time').value = String(t)
  byId('readout').textContent = `${display(t,'s')} · x = ${display(x,'m')}${hasForce()?' · F = '+display(force,'N'):''}`
  timeCharts.forEach(chart=>chart.draw())
}

function teach() {
  const {fn,wn,period,z,cc,wd} = rates(p)
  const {omega,amplitude,response,axisPeak} = data
  const wnLabel = 'm'
  const results = [
    ['自然角頻率',display(wn,'rad/s')],['自然頻率',display(fn,'Hz')],
    ['自然週期',display(period,'s')],['阻尼比 ζ',fmt(z)],
    ['阻尼振動頻率',wd===null?'無週期振盪':display(wd/tau,'Hz')],
  ]
  if (hasForce()) results.push(['頻率比 r',fmt(omega/wn)],['外力振幅',display(amplitude,'N')],['穩態位移振幅',display(response.amplitude,'m')])
  byId('metrics').innerHTML = results.map(([label,value])=>`<div class="panel"><span>${label}</span><strong>${value}</strong></div>`).join('')
  const ref = byId('reference')
  if (ref) ref.textContent = `參考組 m = ${reference.m} kg、k = ${reference.k} N/m、c = ${reference.c} N·s/m，fₙ = ${display(rates(reference).fn,'Hz')}`
  const concept = hasForce() || mode==='frf'
    ? '固定振幅的正弦外力持續輸入能量。靠近共振時，低阻尼系統的位移放大最明顯，提高阻尼可壓低峰值。固定外力的位移峰值位於 r = √(1 − 2ζ²)，適用於 ζ < 1/√2。ζ 達到此界限時，最大柔度出現在零頻率的靜態極限。'
    : '質量愈重，彈簧要花更久才能帶動它回到平衡位置。彈簧愈硬，同一位移會產生更大的回復力。自然頻率由質量與剛度決定。欠阻尼時，實際振盪頻率隨阻尼增加而降低。臨界阻尼與過阻尼的自由解不週期振盪，過阻尼的慢衰減項可能使回復時間更長。'
  let detail = ''
  if (hasForce()) {
    detail = `<li>${`ω = 2π × ${p.f} Hz = ${display(omega,'rad/s')}，F<sub>0</sub> = ${display(amplitude,'N')}。`}</li>
    <li>r = ω/ω<sub>n</sub> = ${fmt(omega)}/${fmt(wn)} = ${fmt(omega/wn)}。(F(t)) = F<sub>0</sub> sin(ωt)，${wnLabel}x″ + cx′ + kx = F(t)。</li>
    <li>${amplitude===0?'此設定下正弦激振為零，穩態位移振幅為 0 m。完整響應仍可反映初始條件。':response.amplitude===null?'理想無阻尼精確共振，正弦激振使振幅隨時間增長。上圖顯示有限時間的 RK4 解。':`X = F<sub>0</sub>/√((k − ${wnLabel}ω<sup>2</sup>)<sup>2</sup> + (cω)<sup>2</sup>) = ${fmt(amplitude)} N / √((${fmt(response.elastic)} N/m)<sup>2</sup> + (${fmt(response.viscous)} N/m)<sup>2</sup>) = ${display(response.amplitude,'m')}。以 sin(ωt − φ) 表示位移，φ = atan2(cω, k − ${wnLabel}ω<sup>2</sup>) = ${display(response.phase,'rad')}。`}</li>`
  }
  if (data.frequency.length) detail += `<li>峰值位置 ${axisPeak===null?'沒有內部峰值':'r = '+fmt(axisPeak)}。</li>`
  byId('teaching').innerHTML = `<h3>先來看看它為什麼會這樣</h3><p>${concept}</p>
    <h3>實際調整參數算給你看</h3><ol>
    <li>已知 ${wnLabel} = ${p.m} kg，k = ${p.k} N/m，c = ${p.c} N·s/m。${mode==='frf'?'':` x<sub>0</sub> = ${p.x0} m，v<sub>0</sub> = ${p.v0} m/s，模擬 ${p.duration} s。`}</li>
    <li>ω<sub>n</sub> = √(k/${wnLabel}) = √(${p.k} N/m ÷ ${p.m} kg) = ${display(wn,'rad/s')}。</li>
    <li>f<sub>n</sub> = ω<sub>n</sub>/(2π) = ${fmt(wn)} ÷ (2π) = ${display(fn,'Hz')}，T<sub>n</sub> = 1/f<sub>n</sub> = ${display(period,'s')}。</li>
    <li>c<sub>cr</sub> = 2√(k${wnLabel}) = ${display(cc,'N·s/m')}，ζ = c/c<sub>cr</sub> = ${p.c} ÷ ${fmt(cc)} = ${fmt(z)}。
    ${wd===null?'此時自由響應不作週期振盪。':`ω<sub>d</sub> = ω<sub>n</sub>√(1 − ζ<sup>2</sup>) = ${fmt(wn)}√(1 − ${fmt(z)}<sup>2</sup>) = ${display(wd,'rad/s')}，每秒振盪 ${display(wd/tau,'Hz')}。`}</li>${detail}</ol>
    ${hasForce()?'<p>完整時間響應包含初始條件引起的暫態。理論穩態選項直接顯示特解，無阻尼時自由分量可持續存在。位移圖與動畫皆採目前顯示的解。</p>':''}
    <p>圖表來自模型計算。示意圖將位移映射到有限畫幅，請讀取波形與數值掌握實際大小。</p>`
}

function update() {
  cursor = 0
  setPlaying(false)
  try {
    data = experiment(mode,p,overlay,stationary,reference)
    byId('error').textContent = ''
    if (data.series.length) byId<HTMLInputElement>('time').max = String(p.duration)
    drawPlots()
    teach()
    paint()
  } catch (error) {
    byId('error').textContent = error instanceof Error?error.message:'無法更新模擬'
  }
}

function scheduleUpdate() {
  if (updatePending) return
  updatePending = true
  requestAnimationFrame(() => { updatePending = false; if (!disposePage) update() })
}

function download(url:string,name:string) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
}
function exportCsv() {
  const rows = data.series.length
    ? ['series,time_s,displacement_m,force_N',...data.series.flatMap(({label,points})=>points.map(({t,x,force})=>`${label},${t},${x},${force}`))]
    : ['series,frequency_ratio,receptance_m_per_N',...data.frequency.flatMap(({label,points})=>points.map(({x,y})=>`${label},${x},${y ?? ''}`))]
  const url = URL.createObjectURL(new Blob(['\ufeff',rows.join('\r\n')],{type:'text/csv;charset=utf-8'}))
  download(url,mode+'.csv')
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
let previous = 0
function frame(now:number) {
  if (playing) {
    cursor = Math.min(p.duration,cursor+Math.min((now-previous)/1000,.1)*speed)
    paint()
    if (cursor >= p.duration) setPlaying(false)
  }
  previous = now
  requestAnimationFrame(frame)
}
window.addEventListener('hashchange',mount)
mount()
requestAnimationFrame(frame)

