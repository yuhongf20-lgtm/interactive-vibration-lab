export interface System { m: number; k: number; c: number; x0: number; v0: number }
export interface Sample { t: number; x: number; force: number }
export const tau = 2 * Math.PI
export const rpmToOmega = (rpm: number) => rpm * tau / 60

export function rates({m, k, c}: System) {
  if (![m,k,c].every(Number.isFinite) || m <= 0 || k <= 0 || c < 0) throw new RangeError('質量與剛度須為正，阻尼須為非負')
  const wn = Math.sqrt(k/m), cc = 2 * Math.sqrt(k*m), z = c/cc
  return {wn, fn: wn/tau, period: tau/wn, cc, z, wd: z < 1 ? wn*Math.sqrt(1-z*z) : null}
}

export function free(s: System, t: number) {
  const {wn, z, wd} = rates(s)
  const {x0, v0} = s
  const decay = z*wn
  if (Math.abs(z-1) < 1e-10) return Math.exp(-decay*t)*(x0+(v0+decay*x0)*t)
  if (wd !== null) return Math.exp(-decay*t)*(x0*Math.cos(wd*t)+(v0+decay*x0)*Math.sin(wd*t)/wd)
  // 以根的乘積求慢根，避免高阻尼時相減造成精度損失。
  const fast = -wn*(z+Math.sqrt(z*z-1)), slow = wn*wn/fast
  const a = (v0-fast*x0)/(slow-fast)
  return a*Math.exp(slow*t)+(x0-a)*Math.exp(fast*t)
}

export function steady(s: System, omega: number, force: number) {
  const {wn} = rates(s)
  const elastic = s.k-s.m*omega*omega, viscous = s.c*omega
  const singular = s.c === 0 && Math.abs(omega/wn-1) < 1e-12
  return {
    amplitude: force === 0 || omega === 0 ? 0 : singular ? null : force/Math.hypot(elastic, viscous),
    phase: Math.atan2(viscous, elastic), elastic, viscous,
  }
}

export function forcePeak(z: number) {
  return z < 1/Math.sqrt(2) ? Math.sqrt(1-2*z*z) : null
}

export function rotorPeak(z: number) {
  return z < 1/Math.sqrt(2) ? 1/Math.sqrt(1-2*z*z) : null
}

export function simulate(s: System, duration: number, omega = 0, force = 0, phase = 0): Sample[] {
  if (![s.x0,s.v0,duration,omega,force,phase].every(Number.isFinite) || duration <= 0 || omega < 0) throw new RangeError('模擬時間與初始條件超出範圍')
  const {wn} = rates(s)
  // RK4 同時解析激振、自然振動及高阻尼造成的快速衰減。
  const count = Math.max(1000, Math.ceil(duration * Math.max(wn, omega, s.c/s.m) * 16))
  if (count > 250000) throw new RangeError('模擬步數過多，請縮短模擬時間')
  const h = duration/count
  const input = (t: number) => force*Math.sin(omega*t+phase)
  const acceleration = (t: number, x: number, v: number) => (input(t)-s.c*v-s.k*x)/s.m
  let x = s.x0, v = s.v0
  const points: Sample[] = []
  for (let i=0; i<=count; i++) {
    const t = i*h
    if (!force || !omega) {
      points.push({t,x:free(s,t),force:0})
      continue
    }
    points.push({t,x,force:input(t)})
    const a = acceleration(t,x,v)
    const v2 = v+h*a/2, b = acceleration(t+h/2,x+h*v/2,v2)
    const v3 = v+h*b/2, d = acceleration(t+h/2,x+h*v2/2,v3)
    const v4 = v+h*d, e = acceleration(t+h,x+h*v3,v4)
    x += h*(v+2*v2+2*v3+v4)/6
    v += h*(a+2*b+2*d+e)/6
  }
  return points
}

// 動畫以波形與 CSV 的同一份物理資料取樣。
export function sampleAt<T extends {t:number}>(points: T[], time: number) {
  const last = points.length-1
  const index = Math.max(0,Math.min(last,Math.round(time/points[last].t*last)))
  return points[index]
}

