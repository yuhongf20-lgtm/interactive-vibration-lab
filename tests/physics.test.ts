import { describe, expect, it } from 'vitest'
import { defaults, experiment } from '../src/experiments'
import { forcePeak, free, rates, sampleAt, simulate, steady, tau } from '../src/physics'

const s = defaults
describe('單自由度系統', () => {
  it('計算自然頻率、臨界阻尼及參數變化', () => {
    const n = rates(s)
    expect(n).toMatchObject({wn:10,cc:40,z:.05})
    expect(n.fn).toBeCloseTo(10/tau)
    expect(n.period).toBeCloseTo(tau/10)
    expect(n.wd).toBeCloseTo(10*Math.sqrt(1-.05**2))
    expect(rates({...s,m:4}).fn).toBeLessThan(n.fn)
    expect(rates({...s,k:400}).fn).toBeGreaterThan(n.fn)
    expect(()=>rates({...s,m:0})).toThrow()
  })
  it.each([0,2,40,60])('各阻尼維持初始條件 (%d N·s/m)', c => {
    const model = {...s,c,v0:.37}
    expect(free(model,0)).toBeCloseTo(model.x0,12)
    expect((free(model,1e-6)-free(model,-1e-6))/2e-6).toBeCloseTo(model.v0,7)
    if(c>=40) expect(rates(model).wd).toBeNull()
  })
  it('臨界與過阻尼封閉解', () => {
    expect(free({...s,c:40},.2)).toBeCloseTo(.3*Math.exp(-2),12)
    const a = (-30+Math.sqrt(500))/2, b = (-30-Math.sqrt(500))/2
    expect(free({...s,c:60},.2)).toBeCloseTo(.1*(a*Math.exp(b*.2)-b*Math.exp(a*.2))/(a-b),12)
  })
  it('能量守恆與耗散', () => {
    for(const c of [0,2,40,60]){
      const energy = (t:number) => {
        const model={...s,c}
        const v=(free(model,t+1e-5)-free(model,t-1e-5))/2e-5
        return (model.k*free(model,t)**2 + model.m*v*v)/2
      }
      let previous=energy(0)
      for(let i=1;i<200;i++){
        const now=energy(i/40)
        expect(now).toBeLessThanOrEqual(previous+1e-7)
        if(!c) expect(now).toBeCloseTo(1,7)
        previous=now
      }
    }
  })
  it('RK4 的末段與理論穩態吻合', () => {
    const model={...s,c:12}
    const theory=steady(model,8,15)
    const series=simulate(model,12,8,15)
    for(const point of series.filter(({t},i)=>t>10 && i%20===0)) {
      expect(point.x).toBeCloseTo(theory.amplitude!*Math.sin(8*point.t-theory.phase),5)
    }
  })
  it('無阻尼共振在有限時間位移增長且掃描有缺值', () => {
    const model={...s,c:0,f:10/tau,x0:0}
    const lab=experiment('resonance',model,true,false,model)
    const points=lab.series[0].points
    expect(points.every(({x})=>Number.isFinite(x))).toBe(true)
    expect(lab.response.amplitude).toBeNull()
    expect(lab.frequency[0].points.find(({x})=>x===1)?.y).toBeNull()
    expect(Math.abs(sampleAt(points,4*tau/10).x)).toBeGreaterThan(Math.abs(sampleAt(points,tau/10).x)*3)
  })
  it('固定力峰值偏低，重阻尼無內部峰值', () => {
    const model={...s,c:12}
    const peak=forcePeak(rates(model).z)!
    expect(peak).toBeCloseTo(Math.sqrt(.82))
    expect(steady(model,10*peak,1).amplitude!).toBeGreaterThan(steady(model,10,1).amplitude!)
    expect(forcePeak(.8)).toBeNull()
  })
})
