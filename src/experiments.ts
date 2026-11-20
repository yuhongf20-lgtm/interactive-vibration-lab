import { forcePeak, rates, simulate, steady, tau } from './physics'
export const defaults = {m:2,k:200,c:2,x0:0.1,v0:0,duration:10,f:1,force:10}
export type Inputs = typeof defaults
export type Mode = 'natural'|'free'|'damping'|'forced'|'resonance'|'frf'|'rotor'
export const modes: Record<Mode,string> = {natural:'自然頻率',free:'自由振動',damping:'阻尼比較',forced:'受迫振動',resonance:'共振',frf:'頻率響應',rotor:'旋轉機械偏心'}
export const dampingRatios = [0,0.1,0.3,0.7,1,1.5]
export function experiment(mode: Exclude<Mode, 'rotor'>, p: Inputs, overlay: boolean, stationary: boolean, reference: Inputs) {
  const forced = mode === 'forced' || mode === 'resonance'
  const {wn,cc,z} = rates(p)
  const omega = forced ? tau*p.f : 0
  const amplitude = forced ? p.force : 0
  const response = steady(p,omega,amplitude)
  function trace(label: string, model: Inputs, force = amplitude) {
    const theoretical = steady(model,omega,force)
    const points = simulate(model,p.duration,omega,force)
    return {label,points:stationary && theoretical.amplitude !== null
      ? points.map(point => ({...point,x:theoretical.amplitude! * Math.sin(omega*point.t-theoretical.phase)}))
      : points}
  }
  const series = mode === 'frf' ? [] : [trace('目前設定',p)]
  if (mode === 'damping') series.push(...dampingRatios.map(ratio => trace('ζ = '+ratio,{...p,c:cc*ratio})))
  else if (overlay && !forced && mode !== 'frf') series.push(trace('參考組',reference))
  const peak = forcePeak(z)
  const end = Math.max(3,omega/wn*1.05)
  const axisNatural = 1
  const axisPeak = peak === null ? null : peak*axisNatural
  const coordinate = omega/wn
  const frequencies = [...new Set([...Array.from({length:601},(_,i)=>end*i/600),axisNatural,axisPeak,coordinate]
    .filter((x): x is number => x !== null && x>=0 && x<=end))].sort((a,b)=>a-b)
  function sweep(label:string,c:number) {
    return {label,points:frequencies.map(x=>{
      const w = x*wn
      const force = mode === 'frf' ? 1 : p.force
      // 固定外力 FRF 在零頻率以靜態柔度定義；時域正弦在 ω=0 則恆為零。
      const y = w === 0 ? force/p.k : steady({...p,c},w,force).amplitude
      return {x,y}
    })}
  }
  const frequency = forced || mode === 'frf' ? [sweep('目前阻尼',p.c)] : []
  if (overlay && frequency.length) frequency.push(...[0,0.1,0.3,0.7].map(ratio=>sweep('ζ = '+ratio,cc*ratio)))
  return {series,frequency,omega,amplitude,response,axisNatural,axisPeak,coordinate}
}

