import Chart from 'chart.js/auto'
import type { ChartDataset, Plugin } from 'chart.js'
import { rodDefaults, rodExperiment, rodFrame, sectorCount } from './rotor'
import type { RodInputs, RodSample } from './rotor'
import { tau } from './physics'

const fields: Record<keyof RodInputs,[string,string,number,number,number]> = {
  uniformity:['質量分布均勻程度','%',0,100,1], direction:['質量集中方向','°',0,360,1],
  mass:['桿件總質量 M','kg',0.25,20,0.05], length:['桿件長度','mm',100,1000,10],
  radius:['桿件半徑','mm',5,50,1], rpm:['轉速','rpm',0,3000,1],
  k:['橫向支撐剛度 k','N/m',100,100000,100], c:['橫向支撐阻尼 c','N·s/m',0,200,0.1],
  x0:['軸心初始 x 位移','mm',-20,20,0.1], y0:['軸心初始 y 位移','mm',-20,20,0.1],
  duration:['模擬時間','s',1,10,0.1],
}
const mint='#39dac5', amber='#ffba75', pale='#e5eaf4'
const f = (value:number) => Number(value.toPrecision(5)).toString()
const mm = (value:number|null) => value===null?'無有限解':f(value*1000)
type Point = {x:number;y:number|null}
type Line = ChartDataset<'line',Point[]>
const line = (label:string,color:string,data:Point[],pointRadius=0):Line => ({
  label,data,borderColor:color,backgroundColor:color,pointRadius,borderWidth:1.6,
})

function arc(inner:number,outer:number,start:number,end:number) {
  const xy = (radius:number,angle:number) => [radius*Math.cos(angle),-radius*Math.sin(angle)].join(' ')
  return `M${xy(inner,start)} L${xy(outer,start)} A${outer} ${outer} 0 0 0 ${xy(outer,end)} L${xy(inner,end)} `
    +(inner ? `A${inner} ${inner} 0 0 1 ${xy(inner,start)} Z` : 'Z')
}

export function mountRod(root:HTMLElement,p:RodInputs,onUpdate?:()=>void) {
  const get = <T extends HTMLElement = HTMLElement>(id:string) => root.querySelector<T>('#'+id)!
  root.innerHTML = `<h2>旋轉機械偏心振動</h2><div class="layout">
  <aside class="panel"><h3>桿件與支撐</h3>
    ${Object.entries(fields).map(([key,[name,unit,min,max,step]])=>`
      <div class="control"><label for="rod-range-${key}">${name} (${unit})</label>
      <input type="number" id="rod-number-${key}" aria-label="${name}，${unit}" min="${min}" max="${max}" step="any" value="${p[key as keyof RodInputs]}">
      <input type="range" id="rod-range-${key}" min="${min}" max="${max}" step="${step}" value="${p[key as keyof RodInputs]}"></div>`).join('')}
    <label class="check"><input type="checkbox" id="rod-steady"> 理論穩態波形與軌跡</label>
    <div class="actions"><button id="rod-reset">重設參數</button><button id="rod-csv">下載 CSV</button></div>
    <p id="rod-error" role="alert"></p></aside>
  <section class="results">
    <section class="panel"><h3>雙軸承桿件與旋轉截面</h3>
      <svg viewBox="0 0 520 240" role="img" aria-label="水平桿件、兩端軸承與旋轉質量截面">
        <path d="M34 131H317 M426 49V181 M361 115H491" stroke="#557588" stroke-dasharray="4 5"/>
        <g id="rod-shaft">
          <rect x="39" y="103" width="34" height="54" rx="5" class="machine"/>
          <rect x="279" y="103" width="34" height="54" rx="5" class="machine"/>
          <path d="M52 130H299" stroke="#92acbf" stroke-width="5"/>
          <rect id="rod-body" rx="7" fill="#254a5c" stroke="#8aaaae"/>
          <path id="rod-stripe" stroke="#ffba75" stroke-width="4" stroke-linecap="round"/>
        </g>
        <text x="30" y="204">左軸承</text><text x="269" y="204">右軸承</text>
        <path d="M482 166h24m-5-4 5 4-5 4 M482 166v-24m-4 5 4-5 4 5" class="spring"/>
        <text x="504" y="184">x</text><text x="485" y="140">y</text>
        <g id="rod-section">
          <g id="rod-spin"><g id="rod-density"></g><line id="rod-e-line" stroke="#fff3c0" stroke-width="2"/>
          <circle id="rod-g" r="4.2" fill="#fff3c0" stroke="#252528" stroke-width="1.4"/></g>
          <circle r="3" fill="#39dac5" stroke="#0d1921"/><text x="-16" y="16">O</text><text id="rod-g-label">G</text>
        </g>
        <text x="363" y="204">截面 · 暖色較密</text>
      </svg>
      <p id="rod-scale"></p><div class="actions"><button id="rod-play">播放</button><button id="rod-replay">重播</button>
        <label>播放速度 <select id="rod-speed"><option value=".1">0.1×</option><option value=".25">0.25×</option><option value="1">1×</option><option value="2">2×</option></select></label>
      </div><label for="rod-time">模擬時間 <output id="rod-readout"></output></label><input id="rod-time" type="range" min="0" step="any">
      <p id="rod-status" role="status"></p>
    </section>
    <div class="metrics" id="rod-metrics"></div>
    <div id="rod-motion" class="results"></div>
    <section class="panel"><h3>固定轉速，改變同一根桿件的質量分布</h3><div class="rod-table" id="rod-table"></div></section>
    <div id="rod-comparison" class="results"></div>
  </section></div><section class="teaching panel" id="rod-teach"></section>`
  let data:ReturnType<typeof rodExperiment>
  let current:RodSample
  let charts: Chart<'line',Point[]>[] = []
  let time = 0, previous = 0, gain = 1, pending = 0, animation = 0
  let playing = false
  const slider = get<HTMLInputElement>('rod-time')
  const play = get<HTMLButtonElement>('rod-play')
  const stationary = get<HTMLInputElement>('rod-steady')

  function setPlaying(value:boolean) {
    playing=value
    play.textContent=value?'暫停':'播放'
  }

  function paint() {
    current=rodFrame(data.samples,time)
    const {x,y,theta,t} = current
    const scale=54000/p.radius*gain, dx=x*scale, dy=-y*scale
    get('rod-shaft').setAttribute('transform',`translate(${dx*.35} ${dy})`)
    get('rod-section').setAttribute('transform',`translate(${424+dx} ${115+dy})`)
    get('rod-spin').setAttribute('transform',`rotate(${-theta*360/tau})`)
    const gx=54*data.section.e/(p.radius/1000)*Math.cos(data.section.phase+theta)
    const gy=-54*data.section.e/(p.radius/1000)*Math.sin(data.section.phase+theta)
    get('rod-g-label').setAttribute('x',String(gx+7))
    get('rod-g-label').setAttribute('y',String(gy-5))
    const stripeY=130-(3+p.radius*.18)*Math.sin(theta+data.section.phase)
    get('rod-stripe').setAttribute('opacity',String((1-p.uniformity/100)*(.55+.45*Math.cos(theta+data.section.phase))))
    get('rod-stripe').setAttribute('transform',`translate(0 ${stripeY})`)
    slider.value=String(t)
    get('rod-readout').textContent=`${f(t)} s · x = ${mm(x)} mm · y = ${mm(y)} mm`
    charts.slice(0,2).forEach(chart=>chart.draw())
  }

  function plot(parent:string,title:string,xLabel:string,yLabel:string,sets:Line[],type?:'time'|'orbit') {
    const panel=document.createElement('section')
    panel.className='panel plot'
    panel.innerHTML=`<div class="plot-header"><h3>${title}</h3><button>下載 PNG</button></div><div><canvas role="img" aria-label="${title}"></canvas></div>`
    get(parent).append(panel)
    if(type==='orbit') panel.classList.add('rod-orbit')
    const marker:Plugin<'line'> = {id:'rodMarker', afterDraw({ctx,scales,chartArea}) {
      if(!current || !type) return
      const x=scales.x.getPixelForValue(type==='orbit'?current.x*1000:current.t)
      ctx.save()
      ctx.strokeStyle=pale
      ctx.fillStyle=pale
      ctx.beginPath()
      if(type==='orbit') {
        ctx.arc(x,scales.y.getPixelForValue(current.y*1000),4,0,tau)
        ctx.fill()
      } else {
        ctx.moveTo(x,chartArea.top)
        ctx.lineTo(x,chartArea.bottom)
        ctx.stroke()
      }
      ctx.restore()
    }}
    const orbitLimit = type==='orbit' ? Math.max(.001, ...sets[0].data.map(({x,y})=>Math.max(Math.abs(x),Math.abs(y??0))))*1.12 : undefined
    const chart=new Chart<'line',Point[]>(panel.querySelector('canvas')!,{
      type:'line',data:{datasets:sets},plugins:type?[marker]:[],
      options:{animation:false,responsive:true,maintainAspectRatio:false,parsing:false,color:'#b9cbd7',
        interaction:{mode:'nearest',intersect:false},
        scales:{
          x:{type:'linear',min:orbitLimit===undefined?undefined:-orbitLimit,max:orbitLimit,
            title:{display:true,text:xLabel,color:'#b9cbd7'},ticks:{color:'#b9cbd7'},grid:{color:'#294252'}},
          y:{type:'linear',min:orbitLimit===undefined?undefined:-orbitLimit,max:orbitLimit,
            title:{display:true,text:yLabel,color:'#b9cbd7'},ticks:{color:'#b9cbd7'},grid:{color:'#294252'}},
        }},
    })
    charts.push(chart)
    panel.querySelector('button')!.onclick=()=>download(chart.toBase64Image(),title+'.png')
  }

  function comparisonCharts() {
    const curve = data.comparison.map(row=>({x:row.section.e*1000,y:row.amplitude===null?null:row.amplitude*1000}))
    const work = (x:number) => ({x,y:data.point.amplitude===null?null:data.point.amplitude*1000})
    plot('rod-comparison','A．固定轉速下的偏心距與振幅','偏心距 e (mm)','單軸振幅 (mm)',[
      line('四種質量分布',mint,curve,4),line('目前設定',amber,[work(data.section.e*1000)],6),
    ])
    const rpmData=data.sweep.map(({x,y})=>({x,y:y===null?null:y*1000}))
    const top=Math.max(.001,...rpmData.map(({y})=>y??0))
    const peak=rpmData.find(({x,y})=>x===data.peak && y!==null)
    const marks=[line('自然轉速',pale,[{x:data.natural,y:0},{x:data.natural,y:top}])]
    if(peak) marks.push(line('不平衡響應峰值',amber,[peak],5))
    plot('rod-comparison','B．固定質量分布下的轉速掃描','轉速 (rpm)','單軸振幅 (mm)',[
      line('旋轉不平衡穩態',mint,rpmData),...marks,line('目前工作點',amber,[work(p.rpm)],6),
    ])
  }

  function showText() {
    const {section,point,comparison}=data
    const {force,response,amplitude,rms,peakToPeak}=point
    const quantities=[['偏心距 e',mm(section.e)+' mm'],['不平衡量 U',mm(section.unbalance)+' kg·mm'],
      ['不平衡力振幅',f(force)+' N'],['單軸穩態振幅',mm(amplitude)+(amplitude===null?'':' mm')],
      ['穩態峰對峰值',mm(peakToPeak)+(peakToPeak===null?'':' mm')],['穩態 RMS 位移',mm(rms)+(rms===null?'':' mm')]]
    get('rod-metrics').innerHTML=quantities.map(([label,value])=>`<div class="panel"><span>${label}</span><strong>${value}</strong></div>`).join('')
    get('rod-status').textContent=amplitude===null?'無阻尼精確共振。顯示有限時間 RK4 響應，穩態比較圖在共振處留空。'
      : data.steadyView?'目前顯示理論穩態特解。':'目前顯示含初始條件的完整時間響應。'
    get('rod-table').innerHTML=`<table><thead><tr><th scope="col">均勻程度</th><th scope="col">e (mm)</th><th scope="col">U (kg·mm)</th><th scope="col">F₀ (N)</th>
      <th scope="col">振幅 (mm)</th><th scope="col">峰對峰 (mm)</th><th scope="col">RMS (mm)</th></tr></thead><tbody>
      ${comparison.map(row=>`<tr><th scope="row"><button data-uniformity="${row.uniformity}">${row.label} · ${row.uniformity}%</button></th>
        <td>${mm(row.section.e)}</td><td>${mm(row.section.unbalance)}</td><td>${f(row.force)}</td>
        <td>${mm(row.amplitude)}</td><td>${mm(row.peakToPeak)}</td><td>${mm(row.rms)}</td></tr>`).join('')}</tbody></table>`
    get('rod-table').querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.onclick=()=>{
      p.uniformity=Number(button.dataset.uniformity)
      sync('uniformity')
      schedule()
    })
    const element=section.elements.reduce((a,b)=>a.weight>b.weight?a:b)
    const amplitudeStep = amplitude===null
      ? '此工作點沒有有限穩態振幅。比較圖留空，時間波形及軌跡以有限時間解呈現。'
      : force===0 ? '不平衡激振力為 0 N，因此單軸穩態振幅為 0 mm。'
      : `單軸振幅 A = F<sub>0</sub>/√((k − Mω<sup>2</sup>)<sup>2</sup> + (cω)<sup>2</sup>)。代入 ${f(force)} N ÷ √((${f(response.elastic)} N/m)<sup>2</sup> + (${f(response.viscous)} N/m)<sup>2</sup>)，得 A = ${mm(amplitude)} mm。`
    get('rod-teach').innerHTML=`<h3>先來看看它為什麼會這樣</h3>
      <p>均勻桿件的每一小塊都有對稱位置的等質量，質心因此落在幾何軸心 O。把同一根桿件的質量往一側重新分布，總質量維持固定，整體質心 G 就會往較密的一側偏移。質心隨桿件轉動，給兩個橫向方向週期性激振。</p>
      <p>固定質量分布時，轉速加倍會讓不平衡力變成四倍。位移還受剛度、阻尼和慣性影響，可能在通過共振峰後下降。自然轉速約 ${f(data.natural)} rpm。${data.peak!==null && p.c>0?`旋轉不平衡位移的理論峰值在 ${f(data.peak)} rpm。`:''}</p>
      <p>本模型將桿件視為剛體，沿軸向使用相同密度分布。對稱支撐在 x、y 兩方向有相同 k、c。只考慮純平移，忽略軸承及支座的運動質量，因此兩方向的等效運動質量皆取桿件總質量。桿長用於示意與體積，固定總質量和半徑時只改變桿長會改變平均密度，橫向質心與純平移響應維持相同。</p>
      <h3>實際調整參數算給你看</h3><ol>
      <li>目前桿件質量 ${p.mass} kg、長 ${p.length} mm、半徑 ${p.radius} mm、平均密度 ${f(p.mass/(Math.PI*(p.radius/1000)**2*(p.length/1000)))} kg/m³、均勻程度 ${p.uniformity}%、集中方向 ${p.direction}°。k = ${p.k} N/m，c = ${p.c} N·s/m。完整響應從 (${p.x0}, ${p.y0}) mm 起算，兩軸初速皆為 0 m/s。</li>
      <li>截面切成 ${section.elements.length} 個等面積元素。令 α = 1 − ${p.uniformity}/100 = ${f(1-p.uniformity/100)}，每塊依 1 + α cos(θ<sub>i</sub> − ${p.direction}°) 配置質量，再歸一化使 Σm<sub>i</sub> = ${f(section.sum.mass)} kg。例如最密元素的質量為 ${f(element.mass)} kg，形心座標為 (${mm(element.x)}, ${mm(element.y)}) mm。</li>
      <li>Σm<sub>i</sub>x<sub>i</sub> = ${mm(section.sum.mx)} kg·mm，Σm<sub>i</sub>y<sub>i</sub> = ${mm(section.sum.my)} kg·mm。各自除以 ${f(section.sum.mass)} kg，得 x<sub>G</sub> = ${mm(section.x)} mm，y<sub>G</sub> = ${mm(section.y)} mm。</li>
      <li>e = √(x<sub>G</sub><sup>2</sup> + y<sub>G</sub><sup>2</sup>) = ${mm(section.e)} mm = ${f(section.e)} m。U = Me = ${p.mass} kg × ${mm(section.e)} mm = ${mm(section.unbalance)} kg·mm。</li>
      <li>ω = 2π × ${p.rpm}/60 = ${f(point.omega)} rad/s。F<sub>0</sub> = Uω<sup>2</sup> = ${f(section.unbalance)} kg·m × (${f(point.omega)} rad/s)<sup>2</sup> = ${f(force)} N。令 ψ = ωt + ${f(section.phase)} rad，兩軸的方程為 Mx″ + cx′ + kx = F<sub>0</sub>cos ψ、My″ + cy′ + ky = F<sub>0</sub>sin ψ。</li>
      <li>${amplitudeStep}
      峰對峰與 RMS 為單軸穩態正弦值 2A 和 A/√2。均勻或靜止時激振為零，若給定初始位移，仍可在完整時間響應看到自由振動。</li></ol>`
  }

  function update() {
    pending=0
    try {
      data=rodExperiment(p,stationary.checked)
      get('rod-error').textContent=''
      setPlaying(false)
      time=0
      slider.max=String(p.duration)
      charts.forEach(chart=>chart.destroy())
      charts=[]
      get('rod-motion').replaceChildren()
      get('rod-comparison').replaceChildren()
      const radius=54
      const width=95+105*(p.length-100)/900, height=10+p.radius*.48
      const body=get('rod-body')
      for(const [attr,value] of Object.entries({x:176-width/2,y:130-height/2,width,height})) body.setAttribute(attr,String(value))
      get('rod-stripe').setAttribute('d',`M${184-width/2} 0H${168+width/2}`)
      get('rod-density').innerHTML=data.section.elements.map(({inner,outer,angle,weight})=>{
        const half=tau/sectorCount/2
        const color=183-132*Math.max(0,weight-1)+22*Math.max(0,1-weight)
        return `<path d="${arc(radius*inner,radius*outer,angle-half,angle+half)}" fill="hsl(${color} 68% ${42+10*(weight-1)}%)" stroke="#152b37" stroke-width=".35"/>`
      }).join('')
      const cx=radius*data.section.x/(p.radius/1000), cy=-radius*data.section.y/(p.radius/1000)
      get('rod-g').setAttribute('cx',String(cx))
      get('rod-g').setAttribute('cy',String(cy))
      get('rod-e-line').setAttribute('x2',String(cx))
      get('rod-e-line').setAttribute('y2',String(cy))
      let max=0
      for(const {x,y} of data.samples) max=Math.max(max,Math.hypot(x,y))
      gain=max?Math.min(20,24/(max*54000/p.radius)):1
      get('rod-scale').textContent=`軸心位移倍率 ${f(gain)}×（相對於截面比例，側視圖投影 x 分量）；O 到 G 的距離沿用截面比例。e = ${mm(data.section.e)} mm。`
      const stride=Math.max(1,Math.floor(data.samples.length/Math.max(1600,p.duration*p.rpm/60*16)))
      const plotSamples=data.samples.filter((_,i)=>i%stride===0 || i===data.samples.length-1)
      current=data.samples[0]
      plot('rod-motion','軸心時間位移','時間 (s)','位移 (mm)',[
        line('x(t)',mint,plotSamples.map(({t,x})=>({x:t,y:x*1000}))),
        line('y(t)',amber,plotSamples.map(({t,y})=>({x:t,y:y*1000}))),
      ],'time')
      plot('rod-motion','軸心振動軌跡 Orbit Plot','x (mm)','y (mm)',[
        line('軸心 O',mint,plotSamples.map(({x,y})=>({x:x*1000,y:y*1000}))),
      ],'orbit')
      comparisonCharts()
      showText()
      paint()
      onUpdate?.()
    } catch(error) {
      get('rod-error').textContent=error instanceof Error?error.message:'無法更新旋轉桿件模擬'
    }
  }

  function download(url:string,name:string) {
    const a=document.createElement('a')
    a.href=url
    a.download=name
    a.click()
  }

  function sync(key:keyof RodInputs) {
    get<HTMLInputElement>('rod-number-'+key).value=String(p[key])
    get<HTMLInputElement>('rod-range-'+key).value=String(p[key])
  }

  function schedule() {
    if(!pending) pending=requestAnimationFrame(update)
  }

  for(const key of Object.keys(fields) as (keyof RodInputs)[]) {
    const range=get<HTMLInputElement>('rod-range-'+key), number=get<HTMLInputElement>('rod-number-'+key)
    range.oninput=()=>{
      p[key]=range.valueAsNumber
      sync(key)
      schedule()
    }
    number.onchange=()=>{
      if(Number.isFinite(number.valueAsNumber)) p[key]=Math.max(+range.min,Math.min(+range.max,number.valueAsNumber))
      sync(key)
      schedule()
    }
  }
  stationary.onchange=schedule
  play.onclick=()=>{
    if(time>=p.duration) time=0
    setPlaying(!playing)
  }
  get('rod-replay').onclick=()=>{time=0;setPlaying(true);paint()}
  slider.oninput=()=>{time=slider.valueAsNumber;setPlaying(false);paint()}
  get('rod-reset').onclick=()=>{
    Object.assign(p,rodDefaults)
    for(const key of Object.keys(fields) as (keyof RodInputs)[]) sync(key)
    stationary.checked=false
    schedule()
  }
  get('rod-csv').onclick=()=>{
    const rows=['time_s,axis_x_mm,axis_y_mm,force_x_N,force_y_N,rotation_rad',
      ...data.samples.map(({t,x,y,fx,fy,theta})=>[t,x*1000,y*1000,fx,fy,theta].join(','))]
    const url=URL.createObjectURL(new Blob(['\ufeff',rows.join('\r\n')],{type:'text/csv;charset=utf-8'}))
    download(url,'rotor-motion.csv')
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function animate(now:number) {
    if(playing) {
      time=Math.min(p.duration,time+Math.min((now-previous)/1000,.1)*Number(get<HTMLSelectElement>('rod-speed').value))
      paint()
      if(time>=p.duration) setPlaying(false)
    }
    previous=now
    animation=requestAnimationFrame(animate)
  }
  update()
  animation=requestAnimationFrame(animate)
  return ()=>{
    cancelAnimationFrame(animation)
    cancelAnimationFrame(pending)
    charts.forEach(chart=>chart.destroy())
  }
}

