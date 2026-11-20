import { harmonicSignal } from '../src/lesson-signal'
import { describe, expect, it } from 'vitest'
import { examples } from '../src/lesson-math'
import { lessonText } from '../src/lesson-text'
import { modes } from '../src/experiments'

const example=(id:number,values?:number[])=>{
  const model=examples[id-1]
  return model.compute(values??model.inputs.map(input=>input.value)).join(' ')
}
describe('互動講義',()=>{
  it('保留 14 個原稿單元，所有單元都有公式、例題和有效實驗入口',()=>{
    expect(lessonText).toHaveLength(15)
    expect(examples).toHaveLength(15)
    expect(lessonText[0].title).toBe('從生活現象開始認識振動')
    expect(lessonText[13].title).toBe('振動訊號如何用來判斷設備健康？')
    expect(lessonText[14].title).toContain('桿件質量分布')
    lessonText.forEach(({links},i)=>{
      expect(links.length).toBeGreaterThan(0)
      expect(links.every(mode=>mode==='signal'||Object.hasOwn(modes,mode))).toBe(true)
      expect(examples[i].formula).not.toBe('')
      expect(example(i+1)).not.toMatch(/NaN|Infinity/)
    })
  })
  it('保留原稿預設值的週期、回復力、能量和加速度',()=>{
    expect(example(1)).toContain('0.3142 s')
    expect(example(2)).toContain('−100')
    expect(example(2,[100,-2])).toContain('= 2 N')
    expect(example(3)).toContain('9 J')
    expect(example(4)).toContain('1.007 Hz')
    expect(example(5)).toContain('1.6 m/s²')
  })
  it('保留自然頻率、簡諧位移、包絡線與共振的案例',()=>{
    expect(example(6)).toContain('1.592 Hz')
    expect(example(7)).toContain('= 0.01 m')
    expect(example(8)).toContain('0.6767 mm')
    expect(example(9)).toContain('0.5 m')
    expect(example(9,[1,100,0,10,10])).toContain('沒有有限穩態振幅')
    expect(example(10)).toContain('30 mm')
  })
  it('保留轉速與倍頻、平方激振力，並區分擴充模型的偏心距及響應',()=>{
    expect(example(11)).toContain('188.5 rad/s')
    expect(example(12)).toContain('0.05 s')
    expect(example(13)).toContain('20 N')
    expect(example(14)).toContain('3× = 90 Hz')
    expect(example(15,[100,300,30])).toContain('X = 0 mm')
    expect(example(15,[60,0,30])).toContain('X = 0 mm')
    expect(example(15)).not.toContain('X = 0 mm')
  })
})

it('從合成的兩圈訊號求出三個正確的單邊峰值',()=>{
  const {spectrum,time}=harmonicSignal(1650,[3,.7,.25])
  expect(time).toHaveLength(257)
  expect(spectrum.map(({hz})=>hz)).toEqual([27.5,55,82.5])
  spectrum.forEach(({peak},i)=>expect(peak).toBeCloseTo([3,.7,.25][i],12))
})