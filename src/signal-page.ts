import { harmonicSignal } from './lesson-signal'
import { print } from './lesson-math'

const settings=[1800,3,.6,.25]
export function mountSignal(root:HTMLElement) {
  const labels=['轉速 (rpm)','1× 峰值 (mm/s)','2× 峰值 (mm/s)','3× 峰值 (mm/s)']
  root.innerHTML=`<h2>振動訊號分析</h2><p>這是合成的振動速度訊號。改變轉速或倍頻強度，看看兩圈時間波形與頻譜如何變化。</p>
    <div class="layout"><fieldset class="lesson-inputs panel"><legend>訊號設定</legend>${labels.map((label,i)=>
    `<label>${label}<input type="number" min="${i?0:60}" max="${i?20:3000}" step="${i?.05:1}" value="${settings[i]}"></label>`).join('')}</fieldset>
    <div class="results"><section class="panel"><h3>兩圈的時間波形</h3><div id="signal-time"></div></section>
    <section class="panel"><h3>倍頻振幅</h3><div id="signal-spectrum"></div><p id="signal-peaks"></p></section></div></div>
    <p>等間距取樣 256 點，再對訊號做離散傅立葉投影，求出 1×、2×、3× 的單邊峰值。這些成分可以協助比對轉速和歷史資料。</p>
    <nav aria-label="回到教材"><a href="#handout/14">返回第 14 單元</a></nav>`
  function refresh() {
    const [rpm,...amplitude]=settings
    const {time,spectrum,duration}=harmonicSignal(rpm,amplitude)
    const waveMax=Math.max(.1,...time.map(({v})=>Math.abs(v)))
    const peakMax=Math.max(.1,...spectrum.map(({peak})=>peak))
    const wave=time.map(({t,v})=>`${48+406*t/duration},${83-53*v/waveMax}`).join(' ')
    root.querySelector('#signal-time')!.innerHTML=`<svg viewBox="0 0 480 170" role="img" aria-label="合成振動速度時間波形">
      <path d="M48 22V143H454 M48 83H454" class="lesson-axis"/><polyline points="${wave}" class="lesson-wave"/>
      <text x="48" y="16">速度 (mm/s)</text><text x="31" y="88">0</text>
      <text x="48" y="164">0 s</text><text x="353" y="164">${print(duration)} s</text></svg>`
    root.querySelector('#signal-spectrum')!.innerHTML=`<svg viewBox="0 0 480 170" role="img" aria-label="振動速度倍頻比較圖">
      <path d="M48 22V134H454" class="lesson-axis"/><text x="48" y="16">峰值 (mm/s)</text>
      ${spectrum.map(({hz,peak},i)=>{
        const x=140+110*i
        return `<path d="M${x} 134v${-95*peak/peakMax}" stroke="#39dac5" stroke-width="12"/>
        <text x="${x-27}" y="156">${print(hz)} Hz</text>`
      }).join('')}</svg>`
    root.querySelector('#signal-peaks')!.textContent=spectrum.map(({hz,peak},i)=>`${i+1}× · ${print(hz)} Hz · ${print(peak<1e-12?0:peak)} mm/s`).join('　')
  }
  root.querySelectorAll('input').forEach((input,i)=>{
    input.oninput=()=>{
      if(Number.isFinite(input.valueAsNumber)&&!input.validity.rangeUnderflow&&!input.validity.rangeOverflow){
        settings[i]=input.valueAsNumber
        refresh()
      }
    }
    input.onchange=()=>{input.value=String(settings[i])}
  })
  refresh()
}
