import { print } from './lesson-math'
import { crossSection, rodDefaults } from './rotor'
import { tau } from './physics'

const axis = '<path d="M35 20V130H306 M35 78H306" class="lesson-axis"/>'
function wave(amplitude:number,decay=0,cycles=2) {
  const points = Array.from({length:129},(_,i)=>{
    const s=i/128
    return `${35+270*s},${78-amplitude*Math.exp(-decay*s)*Math.sin(tau*cycles*s)}`
  }).join(' ')
  return axis+`<polyline points="${points}" class="lesson-wave"/><text x="21" y="19">x</text><text x="304" y="148">t</text>`
}
function spring(car=false,offset=0) {
  const y=55+offset
  const top=car ? 31 : 28
  const step=(y-top)/7
  const segments=Array.from({length:6},(_,i)=>`l${i===0?-9:i%2?18:-18} ${step}`).join(' ')
  return `<path d="M65 ${top}h109 M98 ${top} ${segments} l9 ${step}" class="lesson-axis"/>
    <path d="M139 ${top}V${y-10}m-8 0h16m-16-7v14h16v-14" class="lesson-axis"/>
    <rect x="65" y="${y}" width="109" height="28" rx="6" class="machine"/>
    <text x="108" y="${y+19}">${car?'mᵤ':'m'}</text>
    <text x="78" y="${y-7}">${car?'kₛ':'k'}</text><text x="158" y="${y-7}">${car?'cₛ':'c'}</text>
    ${car?`<path d="M57 31 77 12h77l27 19z M121 ${y+28}v8l-8 7 16 7-16 7 8 7v5 M45 126h154" class="lesson-axis"/>
    <text x="110" y="27">mₛ</text><text x="147" y="115">kₜ</text><text x="211" y="132">路面</text>`:
    `<path d="M185 69H287" stroke-dasharray="4 4" class="lesson-axis"/><text x="215" y="63">平衡點</text>
      <path d="M205 80v34l-5-6m5 6 5-6" class="lesson-wave"/><text x="221" y="112">向下為正</text>`}`
}
function sweep(damping:number) {
  const curve=Array.from({length:121},(_,i)=>{
    const r=2.6*i/120
    const h=1/Math.hypot(1-r*r,2*damping*r)
    return `${35+270*i/120},${128-Math.min(100,h*24)}`
  }).join(' ')
  return `<path d="M35 20V130H305 M139 31V129" class="lesson-axis"/><polyline points="${curve}" class="lesson-wave"/>
    <text x="10" y="17">柔度</text><text x="125" y="148">r = 1</text><text x="304" y="148">r</text>`
}
function rotor(id:number,values:number[]) {
  const section=id===15?crossSection({...rodDefaults,uniformity:values[0],direction:values[2]}):undefined
  const angle=section?.phase??.62
  const distance=section ? section.e/(rodDefaults.radius/1000)*39 : id===13?19:0
  const x=255+distance*Math.cos(angle),y=77-distance*Math.sin(angle)
  const arcPaths=section ? section.elements.filter(element=>element.inner===0).map(({angle,weight})=>{
    const side=Math.PI/32
    const point=(a:number)=>`${255+39*Math.cos(a)},${77-39*Math.sin(a)}`
    return `<path d="M255,77 L${point(angle-side)} A39 39 0 0 0 ${point(angle+side)} Z" fill="hsl(${183-145*(weight-1)} 66% 43%)"/>`
  }).join('') : ''
  return `<path d="M38 77h160" class="lesson-axis"/><rect x="69" y="63" width="96" height="28" rx="6" class="machine"/>
    <rect x="46" y="65" width="20" height="34" class="machine"/><rect x="169" y="65" width="20" height="34" class="machine"/>
    <circle cx="255" cy="77" r="39" class="machine"/>${arcPaths}
    <path d="M255 77L${x} ${y}" class="lesson-wave"/><circle cx="${x}" cy="${y}" r="4" fill="#ffba75"/>
    <circle cx="255" cy="77" r="3" fill="#39dac5"/><text x="243" y="97">O</text>
    ${distance||section?`<text x="${x+6}" y="${y-7}">G</text>`:''}
    <text x="43" y="122">軸承</text><text x="224" y="134">旋轉截面</text>`
}
export function lessonDiagram(id:number,values:number[]) {
  const [a,b,c]=values
  let body:string
  let caption:string
  if (id===14) {
    const max=Math.max(1,b,c)
    body='<path d="M35 20V130H314" class="lesson-axis"/>'+
      [b,c].map((value,i)=>`<path d="M${95+16*i} 130v${-90*value/max}" stroke="${i?'#ffba75':'#39dac5'}" stroke-width="8"/>`).join('')+
      [1,2,3].map((order,i)=>`<text x="${69+82*i}" y="149">${print(a*order/60)} Hz</text>`).join('')+
      '<text x="39" y="21">速度峰值 (mm/s)</text><text x="171" y="35">上週／本週 1×</text>'
    caption='依目前輸入繪製假設的 1× 峰值，並標出 2×、3× 的頻率位置。'
  } else if (id>=11) {
    body=rotor(id,values)
    caption=id===15?'暖色表示較密的區域。O 到 G 的連線是偏心距。':id===13?'圖中標記表示等效偏心方向。':'軸承支撐旋轉軸；每轉一圈可對應一次週期。'
  } else if (id===10 || id===9) {
    body=sweep(id===9?Math.max(.025,c/(2*Math.sqrt(a*b))):.16)
    caption='頻率響應形狀示意。完整掃頻與奇點可在互動實驗中查看。'
  } else if (id>=2 && id<=5) {
    body=spring(id===4,id===2?b*2:10)
    caption=id===4?'車身、懸吊、輪組與輪胎組成四分之一車模型。':'位移以平衡點為基準。'
  } else {
    const cycles=id===7?2:id===1?b/10:2
    body=wave(id===1?Math.min(55,12+a*430):45,id===8?2+a*b*.18:0,cycles)
    caption=id===8?'阻尼使波峰隨時間降低。':'垂直方向是位移，水平方向是時間。'
  }
  return `<svg viewBox="0 0 330 154" role="img" aria-label="${caption}">${body}</svg><figcaption>${caption}</figcaption>`
}
