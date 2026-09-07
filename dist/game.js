(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const ui = {menu:$('#menu'),hud:$('#hud'),results:$('#results'),pauseMenu:$('#pauseMenu'),score:$('#score'),accuracy:$('#accuracy'),combo:$('#combo'),health:$('#healthBar')};
  const TAU=Math.PI*2;
  let W=0,H=0,dpr=1,state='menu',difficulty='normal',audio=null,startTime=0,pauseAt=0,pausedTotal=0,objects=[],effects=[],cursor={x:0,y:0,down:false},raf=0;
  let stats={score:0,combo:0,maxCombo:0,health:100,total:0,weighted:0,c300:0,c100:0,c50:0,miss:0};
  const settings={normal:{preempt:1150,window:[75,145,230],radius:48,interval:610},hard:{preempt:900,window:[60,120,190],radius:43,interval:480},insane:{preempt:720,window:[48,95,155],radius:39,interval:370}};

  function resize(){dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  function now(){return audio ? (audio.currentTime*1000-startTime-pausedTotal) : 0}
  function reset(){stats={score:0,combo:0,maxCombo:0,health:100,total:0,weighted:0,c300:0,c100:0,c50:0,miss:0};effects=[];generateMap();updateHud()}
  function generateMap(){
    const s=settings[difficulty], count=difficulty==='insane'?62:difficulty==='hard'?52:44; objects=[];
    let seed=1871; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<count;i++){
      const margin=s.radius+34; const x=margin+rnd()*(Math.max(320,W)-margin*2); const y=90+margin+rnd()*(Math.max(500,H)-170-margin*2);
      objects.push({x,y,time:1700+i*s.interval+(i%8===7?220:0),number:i+1,hit:false,result:null});
    }
  }
  function start(){
    audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();reset();state='playing';ui.menu.classList.add('hidden');ui.results.classList.add('hidden');ui.pauseMenu.classList.add('hidden');ui.hud.classList.remove('hidden');startTime=audio.currentTime*1000;pausedTotal=0;scheduleMusic();loop();
  }
  function scheduleMusic(){
    const s=settings[difficulty];objects.forEach((o,i)=>{const t=audio.currentTime+o.time/1000;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=i%4===0?'triangle':'sine';osc.frequency.setValueAtTime(i%4===0?110:220+(i%5)*22,t);gain.gain.setValueAtTime(i%4===0?.11:.04,t);gain.gain.exponentialRampToValueAtTime(.001,t+.12);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+.13)});
  }
  function hitSound(result){const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;osc.type='sine';osc.frequency.setValueAtTime(result===300?880:result===100?660:440,t);gain.gain.setValueAtTime(.09,t);gain.gain.exponentialRampToValueAtTime(.001,t+.08);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(t+.09)}
  function attempt(){
    if(state!=='playing')return;const t=now(),s=settings[difficulty];let best=null,dist=Infinity;
    for(const o of objects){if(o.hit)continue;const dt=Math.abs(t-o.time),d=Math.hypot(cursor.x-o.x,cursor.y-o.y);if(dt<=s.window[2]&&d<=s.radius*1.2&&d<dist){best=o;dist=d}}
    if(!best)return;const delta=Math.abs(t-best.time);let result=delta<=s.window[0]?300:delta<=s.window[1]?100:50;judge(best,result);hitSound(result);
  }
  function judge(o,result){o.hit=true;o.result=result;stats.total++;stats.weighted+=result;stats['c'+result]++;stats.combo++;stats.maxCombo=Math.max(stats.maxCombo,stats.combo);stats.health=Math.min(100,stats.health+(result===300?4:result===100?2:1));stats.score+=Math.round(result*(1+stats.combo/25));effects.push({x:o.x,y:o.y,result,born:performance.now()});updateHud()}
  function miss(o){o.hit=true;o.result=0;stats.total++;stats.miss++;stats.combo=0;stats.health=Math.max(0,stats.health-11);effects.push({x:o.x,y:o.y,result:0,born:performance.now()});updateHud()}
  function updateHud(){const acc=stats.total?stats.weighted/(stats.total*300)*100:100;ui.score.textContent=String(stats.score).padStart(8,'0');ui.accuracy.textContent=acc.toFixed(2)+'%';ui.combo.textContent=stats.combo+'x';ui.health.style.width=stats.health+'%'}
  function draw(){
    ctx.clearRect(0,0,W,H);if(state==='menu'){drawAmbient();return}const t=now(),s=settings[difficulty];
    for(const o of objects){if(o.hit)continue;const until=o.time-t;if(until>s.preempt||until<-s.window[2])continue;const alpha=Math.min(1,(s.preempt-until)/260);const approach=1+Math.max(0,until)/s.preempt*2.6;drawCircle(o,s.radius,approach,alpha)}
    const n=performance.now();effects=effects.filter(e=>n-e.born<650);for(const e of effects)drawEffect(e,n-e.born);
    ctx.beginPath();ctx.arc(cursor.x,cursor.y,8,0,TAU);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(cursor.x,cursor.y,3,0,TAU);ctx.fillStyle=cursor.down?'#ff69ac':'#fff';ctx.fill();
  }
  function drawAmbient(){const t=performance.now()/1000;for(let i=0;i<7;i++){const x=W*(.12+i*.14)+Math.sin(t*.45+i)*28,y=H*(.2+(i%3)*.27)+Math.cos(t*.4+i)*22;ctx.beginPath();ctx.arc(x,y,18+i*3,0,TAU);ctx.strokeStyle=`rgba(255,105,172,${.05+i*.008})`;ctx.lineWidth=4;ctx.stroke()}}
  function drawCircle(o,r,approach,a){ctx.save();ctx.globalAlpha=a;ctx.beginPath();ctx.arc(o.x,o.y,r*approach,0,TAU);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(o.x,o.y,r,0,TAU);ctx.fillStyle=o.number%2?'#e94f98':'#52bde9';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.stroke();ctx.beginPath();ctx.arc(o.x,o.y,r-8,0,TAU);ctx.strokeStyle='#ffffff33';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(r*.68)}px Segoe UI`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.number,o.x,o.y+1);ctx.restore()}
  function drawEffect(e,age){const p=age/650;ctx.save();ctx.globalAlpha=1-p;ctx.fillStyle=e.result===300?'#7ee8ff':e.result===100?'#8dff82':e.result===50?'#ffd867':'#ff6b7f';ctx.font=`900 ${28+p*12}px Segoe UI`;ctx.textAlign='center';ctx.fillText(e.result||'miss',e.x,e.y-18-p*18);ctx.restore()}
  function loop(){cancelAnimationFrame(raf);const frame=()=>{if(state==='playing'){const t=now(),s=settings[difficulty];objects.forEach(o=>{if(!o.hit&&t>o.time+s.window[2])miss(o)});if(stats.health<=0||objects.every(o=>o.hit)){finish();return}}draw();raf=requestAnimationFrame(frame)};frame()}
  function finish(){state='results';cancelAnimationFrame(raf);ui.hud.classList.add('hidden');ui.results.classList.remove('hidden');const acc=stats.total?stats.weighted/(stats.total*300)*100:0;const grade=acc>=98?'S':acc>=92?'A':acc>=82?'B':acc>=70?'C':'D';$('#grade').textContent=grade;$('#grade').className='grade '+grade;$('#resultScore').textContent=String(stats.score).padStart(8,'0');$('#resultAccuracy').textContent=`Accuracy ${acc.toFixed(2)}% · Max combo ${stats.maxCombo}x`;$('#count300').textContent=stats.c300;$('#count100').textContent=stats.c100;$('#count50').textContent=stats.c50;$('#countMiss').textContent=stats.miss;draw()}
  function pause(){if(state!=='playing')return;state='paused';pauseAt=audio.currentTime*1000;ui.pauseMenu.classList.remove('hidden');audio.suspend()}
  function resume(){if(state!=='paused')return;audio.resume();pausedTotal+=audio.currentTime*1000-pauseAt;state='playing';ui.pauseMenu.classList.add('hidden');loop()}
  function quit(){state='menu';cancelAnimationFrame(raf);ui.hud.classList.add('hidden');ui.results.classList.add('hidden');ui.pauseMenu.classList.add('hidden');ui.menu.classList.remove('hidden');draw()}
  function point(e){const p=e.touches?.[0]||e;cursor.x=p.clientX;cursor.y=p.clientY}
  addEventListener('pointermove',point);canvas.addEventListener('pointerdown',e=>{point(e);cursor.down=true;attempt()});addEventListener('pointerup',()=>cursor.down=false);
  addEventListener('keydown',e=>{if((e.key==='z'||e.key==='x')&&!e.repeat){cursor.down=true;attempt()}if(e.key==='Escape'){state==='playing'?pause():state==='paused'&&resume()}});addEventListener('keyup',e=>{if(e.key==='z'||e.key==='x')cursor.down=false});
  document.querySelectorAll('.diff').forEach(b=>b.onclick=()=>{document.querySelectorAll('.diff').forEach(x=>x.classList.remove('active'));b.classList.add('active');difficulty=b.dataset.diff});
  $('#play').onclick=start;$('#again').onclick=start;$('#pause').onclick=pause;$('#resume').onclick=resume;$('#retry').onclick=start;document.querySelectorAll('.quit').forEach(b=>b.onclick=quit);draw();
})();
