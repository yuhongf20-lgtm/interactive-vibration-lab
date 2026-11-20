import { tau } from './physics'

export function harmonicSignal(rpm:number, amplitudes:number[]) {
  const rotation = rpm/60
  const duration = 2/rotation
  const time = Array.from({length:257},(_,i)=>{
    const t=i*duration/256
    return {t,v:amplitudes.reduce((sum,a,j)=>sum+a*Math.sin(tau*(j+1)*rotation*t),0)}
  })
  // 等間距取兩圈，捨去重複的尾端。每階剛好落在 DFT 的整數頻率格點。
  const spectrum=amplitudes.map((_,j)=>{
    const order=j+1
    let real=0,imag=0
    for(let i=0;i<256;i++){
      const angle=tau*order*rotation*time[i].t
      real+=time[i].v*Math.cos(angle)
      imag-=time[i].v*Math.sin(angle)
    }
    return {hz:order*rotation,peak:2*Math.hypot(real,imag)/256}
  })
  return {time,spectrum,duration}
}
