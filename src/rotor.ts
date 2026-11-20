import { rates, rotorPeak, rpmToOmega, sampleAt, simulate, steady, tau } from './physics'

export const rodDefaults = {
  mass: 2, length: 400, radius: 20, uniformity: 60, direction: 30,
  rpm: 300, k: 12000, c: 30, duration: 3, x0: 0, y0: 0,
}
export type RodInputs = typeof rodDefaults
export const distributions = [
  {label:'完全均勻', uniformity:100}, {label:'輕微不均勻', uniformity:80},
  {label:'中度不均勻', uniformity:50}, {label:'嚴重不均勻', uniformity:0},
]
export const sectorCount = 32
export const ringCount = 4

export function crossSection(p: RodInputs) {
  const radius = p.radius / 1000
  const direction = p.direction * tau / 360
  const contrast = 1-p.uniformity/100
  const step = tau/sectorCount
  const elements = Array.from({length:ringCount*sectorCount},(_,i)=>{
    const inner = Math.sqrt(Math.floor(i/sectorCount)/ringCount)
    const outer = Math.sqrt((Math.floor(i/sectorCount)+1)/ringCount)
    const angle = (i%sectorCount+.5)*step
    // 等面積環形扇區以幾何形心集中質量。密度權重沿圓周變化，各扇區均沿桿長延伸。
    const r = 2*(outer**3-inner**3)/(3*(outer**2-inner**2))*Math.sin(step/2)/(step/2)
    const weight = 1+contrast*Math.cos(angle-direction)
    return {inner,outer,angle,weight,x:radius*r*Math.cos(angle),y:radius*r*Math.sin(angle)}
  })
  const totalWeight = elements.reduce((sum,element)=>sum+element.weight,0)
  const masses = elements.map(element=>({...element,mass:p.mass*element.weight/totalWeight}))
  const sum = masses.reduce((acc,{mass,x,y})=>({mass:acc.mass+mass,mx:acc.mx+mass*x,my:acc.my+mass*y}),{mass:0,mx:0,my:0})
  // 對稱或均勻時，將浮點加總殘差歸零，避免產生虛假的激振與共振奇點。
  const clean = (value:number) => Math.abs(value)<radius*1e-14 ? 0 : value
  const x = clean(sum.mx/sum.mass), y = clean(sum.my/sum.mass)
  const e = Math.hypot(x,y)
  return {elements:masses,sum,x,y,e,phase:Math.atan2(y,x),unbalance:p.mass*e}
}

export function rodOperatingPoint(p:RodInputs, unbalance:number, rpm=p.rpm) {
  const omega = rpmToOmega(rpm)
  const force = unbalance*omega**2
  const system = {m:p.mass,k:p.k,c:p.c,x0:0,v0:0}
  const response = steady(system,omega,force)
  const amplitude = response.amplitude
  return {omega,force,system,response,amplitude, peakToPeak:amplitude===null?null:2*amplitude,
    rms:amplitude===null?null:amplitude/Math.SQRT2}
}

export function rodExperiment(p:RodInputs, stationary:boolean) {
  const section = crossSection(p)
  const point = rodOperatingPoint(p,section.unbalance)
  const {omega,force,system,amplitude,response} = point
  const steadyView = stationary && amplitude!==null
  // x 用 cos，y 用 sin。兩軸使用相同積分步長、相同質心初相角與同一組支撐參數。
  const x = simulate({...system,x0:p.x0/1000},p.duration,omega,force,section.phase+Math.PI/2)
  const y = simulate({...system,x0:p.y0/1000},p.duration,omega,force,section.phase)
  const samples = x.map((sample,i)=>{
    const theta = omega*sample.t
    const angle = theta+section.phase-response.phase
    return {t:sample.t,theta,x:steadyView?amplitude*Math.cos(angle):sample.x,
      y:steadyView?amplitude*Math.sin(angle):y[i].x,fx:sample.force,fy:y[i].force}
  })
  const comparison = distributions.map(item=>{
    const distribution = crossSection({...p,uniformity:item.uniformity})
    return {...item,section:distribution,...rodOperatingPoint(p,distribution.unbalance)}
  })
  const {fn,z} = rates(system)
  const natural = fn*60
  const ratio = rotorPeak(z)
  const peak = ratio===null || section.e===0 ? null : natural*ratio
  const speeds = [...new Set([...Array.from({length:601},(_,i)=>5*i),p.rpm,natural,peak]
    .filter((value):value is number=>value!==null && value>=0 && value<=3000))].sort((a,b)=>a-b)
  const sweep = speeds.map(rpm=>({x:rpm,y:rodOperatingPoint(p,section.unbalance,rpm).amplitude}))
  return {section,point,samples,comparison,sweep,natural,peak,steadyView}
}

export type RodSample = ReturnType<typeof rodExperiment>['samples'][number]
export function rodFrame(samples:RodSample[], time:number) {
  return sampleAt(samples,time)
}
