import { modes } from './experiments'
import { lessonText } from './lesson-text'
import { examples } from './lesson-math'
import { lessonDiagram } from './lesson-diagram'
import { mountRod } from './rotor-page'
import type { RodInputs } from './rotor'

export function handoutUnit(hash:string):number|null {
  if(hash==='#handout') return active
  const match=/^#handout\/(\d{1,2})$/.exec(hash)
  const id=Number(match?.[1])
  return id>=1 && id<=lessonText.length?id:null
}
function readProgress() {
  try {
    const value=JSON.parse(sessionStorage.getItem('vibration-handout')??'{}')
    return value && typeof value==='object'?value:{}
  } catch { return {} }
}
const saved=readProgress()
let active=Number.isInteger(saved.unit)&&saved.unit>=1&&saved.unit<=lessonText.length?saved.unit:1
const positions:Record<number,number>=saved.positions&&typeof saved.positions==='object'?saved.positions:{}
const answers=examples.map(ex=>ex.inputs.map(input=>input.value))
const number=(id:number)=>String(id).padStart(2,'0')
const url=(id:number)=>'#handout/'+number(id)

export function mountHandout(root:HTMLElement,id:number,rod:RodInputs) {
  active=id
  const lesson=lessonText[id-1], example=examples[id-1], values=answers[id-1]
  const extended=id===15
  root.innerHTML=`<h2>振動學互動講義</h2><div class="lesson-layout">
    <nav class="panel lesson-toc" aria-label="講義單元目錄"><h3>單元目錄</h3>
    ${lessonText.map(({title},i)=>`<a href="${url(i+1)}"${i+1===id?' aria-current="page"':''}>${number(i+1)}｜${title}</a>`).join('')}</nav>
    <article class="panel lesson-article">
      <h2>${number(id)}｜${lesson.title}</h2>
      ${extended?'<p class="lesson-note">擴充教材</p>':''}
      <h3>先弄懂這個觀念</h3>${lesson.concept.map(text=>`<p>${text}</p>`).join('')}
      <div class="lesson-formula">${example.formula}</div><p class="lesson-note">${example.symbols}</p>
      <h3>帶入例子，一步一步算</h3><p>${example.intro}</p>
      ${extended?'<p>在下方旋轉桿件調整已知條件，這裡的計算會同步更新。</p>':`
        <fieldset class="lesson-inputs"><legend>已知條件</legend>
        ${example.inputs.map(({name,unit,min,max,step},i)=>`<label>${name}${unit?' ('+unit+')':''}
          <input type="number" data-input="${i}" value="${values[i]}" min="${min}" max="${max}" step="${step}"></label>`).join('')}</fieldset>`}
      <ol id="lesson-calculation" aria-live="polite"></ol>
      <p><strong>想清楚</strong>　${lesson.takeaway}</p>
      <nav class="lesson-pagination" aria-label="前後單元">
        ${id>1?`<a href="${url(id-1)}">← 上一單元</a>`:''}
        ${id<lessonText.length?`<a href="${url(id+1)}">下一單元 →</a>`:''}
      </nav>
    </article>
    <aside class="panel lesson-visual"><h3>看圖理解</h3><figure id="lesson-figure"></figure>
      <div class="lesson-links">${lesson.links.map(mode=>`<a href="#${mode}">開啟互動實驗 · ${mode==='signal'?'振動訊號分析':modes[mode]}</a>`).join('')}</div>
    </aside>
    ${extended?'<section id="lesson-rotor" aria-label="同一根桿件的互動模擬"></section>':''}</div>`
  const calculation=root.querySelector('#lesson-calculation')!
  const figure=root.querySelector('#lesson-figure')!
  function refresh() {
    calculation.innerHTML=example.compute(values,extended?rod:undefined).map(line=>`<li>${line}</li>`).join('')
    figure.innerHTML=lessonDiagram(id,values)
  }
  for(const field of root.querySelectorAll<HTMLInputElement>('input[data-input]')) {
    const index=Number(field.dataset.input)
    field.oninput=()=>{
      if(Number.isFinite(field.valueAsNumber) && !field.validity.rangeOverflow && !field.validity.rangeUnderflow) {
        values[index]=field.valueAsNumber
        refresh()
      }
    }
    field.onchange=()=>{field.value=String(values[index])}
  }
  const stopRod=extended?mountRod(root.querySelector('#lesson-rotor')!,rod,()=>{
    values[0]=rod.uniformity
    values[1]=rod.rpm
    values[2]=rod.direction
    refresh()
  }):undefined
  refresh()
  const page=root.querySelector('.lesson-article')!
  // 切換到實驗前記住閱讀位置；返回同一單元時恢復原高度。
  const frame=requestAnimationFrame(()=>{
    const previous=positions[id]
    if(typeof previous==='number') window.scrollTo(0,previous)
    else if(window.matchMedia('(max-width: 760px)').matches) page.scrollIntoView()
    else window.scrollTo(0,0)
  })
  function remember() {
    positions[id]=window.scrollY
    try { sessionStorage.setItem('vibration-handout',JSON.stringify({unit:id,positions})) } catch { /* 同頁導航仍可保留進度 */ }
  }
  root.addEventListener('click',remember)
  window.addEventListener('pagehide',remember)
  return ()=>{
    remember()
    cancelAnimationFrame(frame)
    stopRod?.()
    root.removeEventListener('click',remember)
    window.removeEventListener('pagehide',remember)
  }
}
