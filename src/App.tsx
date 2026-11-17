import { useState, type FormEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

type Message = { from: 'elise'|'you'; text: string };
const starter: Message[] = [{from:'elise',text:'你好，我是 Elise！今天也要和小貓一起加油哦。🐾'}];
export function App() {
  const [open,setOpen] = useState(false);
  const [messages,setMessages] = useState<Message[]>(starter);
  const [input,setInput] = useState('');
  const [catHappy,setCatHappy] = useState(false);
  const [sleep,setSleep] = useState(false);
  function send(e:FormEvent) {
    e.preventDefault(); const value=input.trim(); if(!value) return;
    setMessages(prev=>[...prev,{from:'you',text:value},{from:'elise',text:'喵～我聽到了！下一版本會連接你選擇的 AI API。'}]); setInput('');
  }
  async function drag(e:React.MouseEvent) {
    if(e.button!==0) return;
    try { await getCurrentWindow().startDragging(); } catch { /* browser preview */ }
  }
  return <div className="desktop">
    <div className="toolbar"><button title="拖動桌寵" onMouseDown={drag} className="grip">⠿ 拖動</button><button title="睡覺模式" onClick={()=>setSleep(x=>!x)}>☾</button><button title="對話" onClick={()=>setOpen(x=>!x)}>☏</button><button title="退出" onClick={()=>getCurrentWindow().close()}>×</button></div>
    {open&&<section className="chat"><header>Elise · 對話 <button onClick={()=>setOpen(false)}>×</button></header><div className="log">{messages.map((m,i)=><p className={m.from} key={i}>{m.text}</p>)}</div><form onSubmit={send}><input aria-label="輸入訊息" placeholder="跟 Elise 說點什麼…" value={input} onChange={e=>setInput(e.target.value)}/><button type="submit">送出</button></form></section>}
    <button className={`character ${sleep?'sleep':''}`} title="點擊 Elise 對話" onClick={()=>setOpen(x=>!x)}><img draggable="false" src="/elise-placeholder.svg" alt="Elise Q版少女示意角色"/>{sleep&&<span className="zzz">Zzz</span>}</button>
    <button className={`cat ${catHappy?'happy':''}`} title="摸摸貓咪" onClick={()=>{setCatHappy(v=>!v);setMessages(prev=>[...prev,{from:'elise',text:'貓咪很喜歡你！🐱'}]);}}><img draggable="false" src="/cat-placeholder.svg" alt="灰白貓咪示意圖"/></button>
  </div>;
}
