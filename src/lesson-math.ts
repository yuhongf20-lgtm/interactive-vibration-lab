import { rates, rpmToOmega, steady, tau } from './physics'
import type { RodInputs } from './rotor'
import { crossSection, rodDefaults, rodOperatingPoint } from './rotor'

type Input = {name:string;unit:string;value:number;min:number;max:number;step:number}
const input = (name:string,unit:string,value:number,min:number,max:number,step:number):Input => ({name,unit,value,min,max,step})
export const print = (value:number) => Number(value.toPrecision(4)).toString()
const frac = (a:string,b:string) => `<span class="lesson-frac"><span>${a}</span><span>${b}</span></span>`
const root = (a:string) => `√<span class="lesson-radical">${a}</span>`
const sq = (a:string) => `${a}<sup>2</sup>`
const result = (name:string,v:number,unit:string) => `<strong>${name} = ${print(v)} ${unit}</strong>`
const frequency = (m:number,k:number) => rates({m,k,c:0,x0:0,v0:0})
function naturalSteps(m:number,k:number) {
  const {wn,fn,period}=frequency(m,k)
  return [`k/m = ${k}/${m} = ${print(k/m)} s<sup>−2</sup>。`,
    `ω<sub>n</sub> = ${root(print(k/m))} = ${print(wn)} rad/s。`,
    result('f<sub>n</sub>',fn,'Hz')+`，即 ${frac(print(wn),'2π')}。每次往返約 ${print(period)} s。`]
}
const naturalFormula = `ω<sub>n</sub> = ${root(frac('k','m'))}，f<sub>n</sub> = ${frac('ω<sub>n</sub>','2π')}`
const speedFormula = `f<sub>r</sub> = ${frac('n','60')}，ω = 2πf<sub>r</sub>`
const displacementDenominator = root(sq('(k − mω<sup>2</sup>)')+' + '+sq('(cω)'))
type Example = {intro:string;formula:string;symbols:string;inputs:Input[];compute:(v:number[],rod?:RodInputs)=>string[]}

export const examples:Example[] = [
  {
    intro:'塑膠尺壓住一端，撥動另一端。用正弦波近似尺端位移。',
    formula:`x(t) = A sin(ωt)，v = ${frac('dx','dt')}，a = ${frac('d<sup>2</sup>x','dt<sup>2</sup>')}`,
    symbols:'x、A 為位移及振幅（m），v 為速度（m/s），a 為加速度（m/s²），ω 為角頻率（rad/s）。',
    inputs:[input('振幅 A','m',.02,.001,.1,.001),input('角頻率 ω','rad/s',20,1,100,1)],
    compute:([a,w])=>[`x(t) = ${a} sin(${w}t) m，正向最遠移動 ${print(a*100)} cm。`,
      `f = ${frac(String(w),'2π')} = ${print(w/tau)} Hz。`,result('T',tau/w,'s')+'，即一次完整來回的時間。'],
  },
  {
    intro:'掛在彈簧上的重物從靜態平衡點拉開。以向下為正。',
    formula:'F<sub>s</sub> = −ky',
    symbols:'Fₛ 是相對平衡點的回復力（N），k 是剛度（N/m），y 是帶正負號的位移（m）。',
    inputs:[input('彈簧剛度 k','N/m',100,10,2000,10),input('離開平衡點 y','cm',2,-10,10,.5)],
    compute:([k,y])=>[`y = ${y} ÷ 100 = ${print(y/100)} m。`,`F<sub>s</sub> = −${k} × (${print(y/100)}) N。`,
      result('F<sub>s</sub>',-k*y/100,'N')+`，${y>0?'方向向上':y<0?'方向向下':'在平衡點，額外回復力為零'}。`],
  },
  {
    intro:'觀察質量塊在某一瞬間的動能、彈簧位能及阻尼力。',
    formula:`E<sub>k</sub> = ${frac('1','2')}mv<sup>2</sup>，E<sub>p</sub> = ${frac('1','2')}kx<sup>2</sup>，F<sub>c</sub> = −cv`,
    symbols:'m（kg）、v（m/s）、k（N/m）、x（m）、c（N·s/m）。兩種能量皆用 J，力用 N。',
    inputs:[input('質量 m','kg',2,.1,20,.1),input('速度 v','m/s',3,-10,10,.1),input('剛度 k','N/m',200,10,2000,10),
      input('變形 x','m',.1,-.2,.2,.01),input('阻尼 c','N·s/m',5,0,200,1)],
    compute:([m,v,k,x,c])=>[`E<sub>k</sub> = ½ × ${m} × ${sq('('+v+')')} = ${print(m*v*v/2)} J。`,
      `E<sub>p</sub> = ½ × ${k} × ${sq('('+x+')')} = ${print(k*x*x/2)} J。`,
      `F<sub>c</sub> = −${c} × (${v}) = ${print(-c*v)} N。只要有阻尼且速度非零，阻尼力就與速度反向。`],
  },
  {
    intro:'只看車身上下動，用一個等效質量與一組懸吊剛度估算。',
    formula:naturalFormula,
    symbols:'m（kg）與 k（N/m）是車身簡化值。圖中 mₛ、mᵤ 為車身和輪組質量，kₛ、cₛ 為懸吊，kₜ 為輪胎剛度。',
    inputs:[input('車身等效質量 m','kg',500,100,3000,10),input('等效剛度 k','N/m',20000,1000,100000,1000)],
    compute:naturalStepsFromValues,
  },
  {
    intro:'固定同一瞬間的位置與速度，比較有無外力的加速度。',
    formula:'ma + cv + kx = F(t)，自由振動時 F(t) = 0',
    symbols:'ma、cv、kx 和 F 均用 N，a 用 m/s²。',
    inputs:[input('質量 m','kg',1,.1,20,.1),input('阻尼 c','N·s/m',2,0,200,1),input('剛度 k','N/m',100,10,2000,10),
      input('位移 x','m',.01,-.2,.2,.01),input('速度 v','m/s',.2,-2,2,.1),input('瞬時外力 F','N',3,-100,100,1)],
    compute:([m,c,k,x,v,F])=>[`cv = ${c} × (${v}) = ${print(c*v)} N，kx = ${k} × (${x}) = ${print(k*x)} N。`,
      `自由 a = ${frac('0 − ('+print(c*v)+') − ('+print(k*x)+')',String(m))} = ${print((-c*v-k*x)/m)} m/s²。`,
      `受迫 a = ${frac(F+' − ('+print(c*v)+') − ('+print(k*x)+')',String(m))} = ${print((F-c*v-k*x)/m)} m/s²。外力帶來 ${print(F/m)} m/s² 的加速度變化。`],
  },
  {
    intro:'由質量和剛度找出系統自身節奏，再思考外力接近此節奏的情形。',
    formula:naturalFormula+`，T = ${frac('1','f<sub>n</sub>')}`,
    symbols:'ωₙ 用 rad/s，fₙ 用 Hz，T 用 s。阻尼會影響實際共振峰。',
    inputs:[input('質量 m','kg',4,1,20,1),input('剛度 k','N/m',400,10,2000,10)],
    compute:naturalStepsFromValues,
  },
  {
    intro:'初相位 φ = 0，從正弦波的零位移起點開始。',
    formula:`mẍ + kx = 0，x(t) = X sin(ω<sub>n</sub>t + φ)，T = ${frac('2π','ω<sub>n</sub>')}`,
    symbols:'X（m）是振幅，φ（rad）是初相位，t（s）是觀察時間。',
    inputs:[input('自然頻率 fₙ','Hz',5,.1,20,.1),input('振幅 X','m',.01,.001,.2,.001),input('觀察時間 t','s',.05,0,2,.01)],
    compute:([f,x,t])=>[`ω<sub>n</sub> = 2π × ${f} = ${print(tau*f)} rad/s，T = 1/${f} = ${print(1/f)} s。`,
      `相位 ω<sub>n</sub>t = ${print(tau*f)} × ${t} = ${print(tau*f*t)} rad。`,
      `x(${t}) = ${x} sin(${print(tau*f*t)}) = ${print(x*Math.sin(tau*f*t))} m，是當時相對平衡點的位置。`],
  },
  {
    intro:'從指定的欠阻尼包絡線幅值出發，計算一段時間後還剩多少。',
    formula:`ζ = ${frac('c','2'+root('km'))}，ω<sub>d</sub> = ω<sub>n</sub>${root('1 − ζ<sup>2</sup>')}，包絡線比例 = e<sup>−ζωₙt</sup>`,
    symbols:'ζ 無因次，ωₙ、ωd 用 rad/s。例題只用 0 < ζ < 1。',
    inputs:[input('自然角頻率 ωₙ','rad/s',10,1,60,1),input('阻尼比 ζ','',.2,.01,.99,.01),
      input('初始包絡幅值','mm',5,.1,30,.1),input('經過時間 t','s',1,0,10,.1)],
    compute:([w,z,a,t])=>[`1 − ζ<sup>2</sup> = 1 − ${sq(String(z))} = ${print(1-z*z)}。`,
      `ω<sub>d</sub> = ${w}${root(print(1-z*z))} = ${print(w*Math.sqrt(1-z*z))} rad/s。`,
      `經 ${t} s，比例 e<sup>−${print(z*w*t)}</sup> = ${print(Math.exp(-z*w*t))}。`,
      `包絡線幅值 = ${a} × ${print(Math.exp(-z*w*t))} = ${print(a*Math.exp(-z*w*t))} mm。`],
  },
  {
    intro:'線性振動系統受到正弦外力，求理論穩態振幅。',
    formula:`mẍ + cẋ + kx = F<sub>0</sub> sin(ωt)，X = ${frac('F<sub>0</sub>',displacementDenominator)}`,
    symbols:'F₀ 用 N，分母用 N/m，X 用 m。本例的理論振幅可能超過實機允許行程。',
    inputs:[input('質量 m','kg',1,.1,20,.1),input('剛度 k','N/m',100,10,2000,10),input('阻尼 c','N·s/m',2,0,200,1),
      input('外力幅值 F₀','N',10,0,100,1),input('角頻率 ω','rad/s',10,.1,60,.1)],
    compute:([m,k,c,F,w])=>{
      const a=steady({m,k,c,x0:0,v0:0},w,F)
      return [`k − mω<sup>2</sup> = ${k} − ${m} × ${sq(String(w))} = ${print(a.elastic)} N/m。`,
        `cω = ${c} × ${w} = ${print(a.viscous)} N/m，分母 = ${print(Math.hypot(a.elastic,a.viscous))} N/m。`,
        a.amplitude===null?'無阻尼精確共振，沒有有限穩態振幅。':F===0?'外力為 0 N，此激振的振幅為 0 m。':
          `X = ${frac(String(F),print(Math.hypot(a.elastic,a.viscous)))} = ${print(a.amplitude)} m。`]
    },
  },
  {
    intro:'把低頻柔度與掃頻上另一個頻率的柔度比較，施力大小維持固定。',
    formula:`|H(ω)| = ${frac('1',displacementDenominator)}，X = F<sub>0</sub>|H(ω)|，r = ${frac('ω','ω<sub>n</sub>')}`,
    symbols:'|H| 是位移除以力（m/N）；低頻極限為 1/k，r 無因次。',
    inputs:[input('剛度 k','N/m',1000,10,3000,10),input('外力幅值 F₀','N',10,0,100,1),input('另一頻率的柔度','m/N',.003,.0001,.1,.0001)],
    compute:([k,F,H])=>[`低頻 |H| ≈ 1/${k} = ${print(1/k)} m/N。`,
      `低頻 X ≈ ${F} × ${print(1/k)} = ${print(F/k)} m = ${print(1000*F/k)} mm。`,
      `另一頻率的 X = ${F} × ${H} = ${print(1000*F*H)} mm。不同頻率會有不同的放大程度。`],
  },
  {
    intro:'把馬達面板上的 rpm 換成頻譜常用的 Hz。',
    formula:speedFormula,symbols:'n（rpm）以每分鐘計，fᵣ（Hz）以每秒計。',
    inputs:[input('馬達轉速 n','rpm',1800,60,3000,10)],
    compute:([n])=>[`f<sub>r</sub> = ${frac(String(n),'60')} = ${print(n/60)} Hz。`,
      `ω = 2π × ${print(n/60)} = ${print(rpmToOmega(n))} rad/s。`,
      `${print(n/60)} Hz 的峰對應每圈一次的成分，需和其他量測線索一起看。`],
  },
  {
    intro:'比較風扇在兩個轉速的每圈時間與轉頻。',
    formula:`f<sub>r</sub> = ${frac('n','60')}，T<sub>r</sub> = ${frac('1','f<sub>r</sub>')}`,
    symbols:'n 為轉速（rpm），Tᵣ 為每轉一圈的時間（s）。',
    inputs:[input('原轉速','rpm',1200,60,3000,10),input('另一轉速','rpm',1500,60,3000,10)],
    compute:([n,b])=>[`原轉頻為 ${n}/60 = ${print(n/60)} Hz。`,
      `每圈時間 T<sub>r</sub> = 1/${print(n/60)} = ${print(60/n)} s。`,
      `另一轉速的轉頻為 ${b}/60 = ${print(b/60)} Hz。若波形隨每圈重複，它的重複時間也會跟著變。`],
  },
  {
    intro:'沿用原講義的等效偏心質量例題，比較兩種角速度。',
    formula:'F<sub>0</sub> = m<sub>e</sub>eω<sup>2</sup>，F(t) = F<sub>0</sub> sin(ωt)',
    symbols:'mₑ 為等效不平衡質量（kg），e 為其力臂（m），mₑe 是此例的等效不平衡量（kg·m）。',
    inputs:[input('等效偏心質量 mₑ','kg',.05,.01,2,.01),input('力臂 e','m',.01,.001,.05,.001),
      input('原角速度 ω','rad/s',100,1,300,1),input('另一角速度','rad/s',200,1,300,1)],
    compute:([m,e,w,b])=>[`eω<sup>2</sup> = ${e} × ${sq(String(w))} = ${print(e*w*w)} m/s²。`,
      `F<sub>0</sub> = ${m} × ${print(e*w*w)} = ${print(m*e*w*w)} N。`,
      `改成 ${b} rad/s 後，力幅值為 ${m} × ${e} × ${sq(String(b))} = ${print(m*e*b*b)} N，是原先的 ${print((b/w)**2)} 倍。`],
  },
  {
    intro:'用講義中的假設量測示範，依運轉速度找出 1、2、3 倍轉頻並比較歷史振幅。',
    formula:`f<sub>r</sub> = ${frac('n','60')}，f<sub>j</sub> = j f<sub>r</sub>`,
    symbols:'j 是倍頻階數。此例峰值是振動速度（mm/s），頻率用 Hz。',
    inputs:[input('馬達轉速','rpm',1800,60,3000,10),input('上週 1× 峰值','mm/s',1,.1,20,.1),input('本週 1× 峰值','mm/s',3,0,20,.1)],
    compute:([n,a,b])=>[`1× = ${n}/60 = ${print(n/60)} Hz，2× = ${print(n/30)} Hz，3× = ${print(n/20)} Hz。`,
      `1× 峰值從 ${a} mm/s 變成 ${b} mm/s，為原先 ${print(b/a)} 倍。`,
      '比較前先核對轉速、負載、測點和量測方向，再判讀成分的變化。'],
  },
  {
    intro:'用等面積元素離散同一根桿件，研究固定總質量時的質心與振動。',
    formula:`x<sub>G</sub> = ${frac('Σ(m<sub>i</sub>x<sub>i</sub>)','Σm<sub>i</sub>')}，
      y<sub>G</sub> = ${frac('Σ(m<sub>i</sub>y<sub>i</sub>)','Σm<sub>i</sub>')}，
      e = ${root('x<sub>G</sub><sup>2</sup> + y<sub>G</sub><sup>2</sup>')}，U = Me，F<sub>0</sub> = Meω<sup>2</sup>，
      X = ${frac('F<sub>0</sub>',displacementDenominator.replace('mω','Mω'))}`,
    symbols:'mᵢ、M 用 kg，xᵢ、yᵢ、xG、yG、e 用 m 代入，U 用 kg·m，X 是單軸穩態位移振幅。',
    inputs:[input('分布均勻程度','%',60,0,100,1),input('轉速','rpm',300,0,3000,10),input('集中方向','°',30,0,360,1)],
    compute:([uniformity,rpm,direction],rod)=>{
      const p=rod??{...rodDefaults,uniformity,rpm,direction}
      const g=crossSection(p)
      const a=rodOperatingPoint(p,g.unbalance)
      return [`固定 M = ${p.mass} kg、半徑 ${p.radius} mm、k = ${p.k} N/m、c = ${p.c} N·s/m。將 ${g.elements.length} 個元素歸一化，Σm<sub>i</sub> = ${print(g.sum.mass)} kg。`,
        `Σm<sub>i</sub>x<sub>i</sub> = ${print(g.sum.mx)} kg·m，Σm<sub>i</sub>y<sub>i</sub> = ${print(g.sum.my)} kg·m，除以總質量後，G = (${print(g.x*1000)}, ${print(g.y*1000)}) mm。`,
        `e = ${root(sq('('+print(g.x*1000)+')')+' + '+sq('('+print(g.y*1000)+')'))} = ${print(g.e*1000)} mm，U = ${print(g.unbalance*1000)} kg·mm。`,
        `ω = 2π × ${p.rpm}/60 = ${print(a.omega)} rad/s，F<sub>0</sub> = ${print(g.unbalance)} × ${sq(print(a.omega))} = ${print(a.force)} N。`,
        a.amplitude===null?'理想共振點無有限穩態振幅。':a.force===0?'此設定的激振力為零，單軸穩態振幅 X = 0 mm。':
          `動態剛度 = ${root(sq('('+print(a.response.elastic)+')')+' + '+sq('('+print(a.response.viscous)+')'))} = ${print(Math.hypot(a.response.elastic,a.response.viscous))} N/m，
          X = ${frac(print(a.force),print(Math.hypot(a.response.elastic,a.response.viscous)))} m = ${print(a.amplitude*1000)} mm。`]
    },
  },
]

function naturalStepsFromValues([m,k]:number[]) { return naturalSteps(m,k) }
