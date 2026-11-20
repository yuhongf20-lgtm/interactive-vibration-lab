import { describe, expect, it } from 'vitest'
import { crossSection, rodDefaults, rodExperiment, rodFrame, rodOperatingPoint } from '../src/rotor'
import { rates, tau } from '../src/physics'

const p = rodDefaults
describe('同一根桿件的質量分布',()=>{
  it('均勻時質心位於軸上，任何分布都維持同一總質量',()=>{
    const uniform=crossSection({...p,uniformity:100})
    expect(uniform).toMatchObject({x:0,y:0,e:0,unbalance:0})
    for(const uniformity of [0,40,80,100]) {
      const section=crossSection({...p,uniformity})
      expect(section.elements).toHaveLength(128)
      expect(section.sum.mass).toBeCloseTo(p.mass,12)
      expect(section.elements.every(element=>element.mass>=0)).toBe(true)
      // 連續圓截面的解析值為 αR/3，離散扇區在本角度解析度的誤差低於 0.2%。
      const expected=(1-uniformity/100)*p.radius/3000
      expect(Math.abs(section.e-expected)).toBeLessThanOrEqual(expected*.002)
    }
  })
  it('質量集中方向旋轉質心，半徑縮放偏心距，桿長不影響純平移',()=>{
    const a=crossSection({...p,direction:0})
    const b=crossSection({...p,direction:90,radius:2*p.radius})
    expect(a.y).toBe(0)
    expect(b.x).toBe(0)
    expect(b.y).toBeCloseTo(2*a.x,12)
    expect(crossSection({...p,length:900}).e).toBe(crossSection(p).e)
  })
  it('固定支撐與轉速時，偏心、力及位移隨密度對比線性變化',()=>{
    const lab=rodExperiment(p,false)
    const [uniform,slight,medium,severe]=lab.comparison
    expect(uniform.force).toBe(0)
    for (const field of ['force','amplitude','peakToPeak','rms'] as const) {
      expect(severe[field]!).toBeCloseTo(5*slight[field]!,12)
      expect(severe[field]!).toBeCloseTo(2*medium[field]!,12)
    }
    expect(severe.section.e).toBeCloseTo(5*slight.section.e,12)
    expect(severe.peakToPeak).toBeCloseTo(2*severe.amplitude!,12)
    expect(severe.rms).toBeCloseTo(severe.amplitude!/Math.SQRT2,12)
    const a=rodOperatingPoint(p,lab.section.unbalance,60)
    const b=rodOperatingPoint(p,lab.section.unbalance,120)
    expect(a.omega).toBeCloseTo(tau,12)
    expect(a.force).toBeCloseTo(p.mass*lab.section.e*tau**2,12)
    expect(b.force/a.force).toBeCloseTo(4,12)
  })
  it('掃描吻合解析解且通過峰值後下降',()=>{
    const {section,sweep,peak}=rodExperiment(p,false)
    for(const {x,y} of sweep) {
      const w=tau*x/60
      expect(y).toBeCloseTo(p.mass*section.e*w*w/Math.hypot(p.k-p.mass*w*w,p.c*w),12)
    }
    expect(sweep.find(({x})=>x===peak)!.y!).toBeGreaterThan(sweep.at(-1)!.y!)
  })
  it.each([{uniformity:100},{rpm:0}])('零激振仍保留初始 x、y 位移',change=>{
    const {samples,point}=rodExperiment({...p,...change,x0:5,y0:-3},false)
    expect(point.force).toBe(0)
    expect(samples[0]).toMatchObject({x:.005,y:-.003,fx:0,fy:0})
    expect(samples.at(-1)!.x).not.toBe(.005)
  })
  it('共振時保留二維有限時間解，掃描留空',()=>{
    const rpm=rates({m:p.mass,k:p.k,c:0,x0:0,v0:0}).fn*60
    const lab=rodExperiment({...p,rpm,c:0},true)
    expect(lab.steadyView).toBe(false)
    expect(lab.point.amplitude).toBeNull()
    expect(lab.sweep.find(({x})=>x===rpm)!.y).toBeNull()
    expect(lab.samples.every(({x,y})=>Number.isFinite(x)&&Number.isFinite(y))).toBe(true)
    expect(Math.hypot(lab.samples.at(-1)!.x,lab.samples.at(-1)!.y)).toBeGreaterThan(lab.section.e)
  })
  it('兩軸 RK4 穩態、質心相位及軌跡取樣一致',()=>{
    const full=rodExperiment(p,false), steady=rodExperiment(p,true)
    const point=rodFrame(full.samples,2.54)
    const reference=rodFrame(steady.samples,point.t)
    expect(point).toBe(full.samples.find(sample=>sample.t===point.t))
    expect(point.x).toBeCloseTo(reference.x,8)
    expect(point.y).toBeCloseTo(reference.y,8)
    expect(Math.hypot(reference.x,reference.y)).toBeCloseTo(steady.point.amplitude!,12)
    expect(Math.atan2(full.samples[0].fy,full.samples[0].fx)).toBeCloseTo(full.section.phase,12)
    expect(point.theta).toBeCloseTo(full.point.omega*point.t,12)
  })
})
