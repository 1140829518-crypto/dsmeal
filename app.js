let recipes=[], category='推荐', meat='全部', keyword='', favorites=JSON.parse(localStorage.getItem('favorites')||'[]'), menu=[];
const $=s=>document.querySelector(s);
const SUPABASE_URL='https://jkfzokddawrqyjhnvzfh.supabase.co', SUPABASE_KEY='sb_publishable_zbxYrbxAkuottcSEWV_BEw_8FBIhBye';
const cloudReady=!SUPABASE_URL.startsWith('PASTE_')&&!SUPABASE_KEY.startsWith('PASTE_');
const room=localStorage.getItem('recipe-room')||''; let cloud=null;
if(cloudReady) cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const cats=['推荐','炒菜','炖煮','蒸菜','凉拌','煎炸','汤'], meats=['全部','猪肉','牛肉','鸡肉','排骨','鱼虾','鸡蛋','素菜','汤'];

async function init(){recipes=await fetch('./data/recipes.json').then(r=>r.json());render();if(room&&cloudReady){await loadMenu();subscribe();}}
function list(){return recipes.filter(r=>(category==='推荐'||r.category===category)&&(meat==='全部'||r.meat===meat)&&(!keyword||r.name.includes(keyword)||r.ingredients.some(i=>i.name.includes(keyword))));}
function img(r,cls='pic'){return `<div class="${cls}"><img src="${r.image}" alt="${r.name}" onerror="this.remove();this.parentNode.textContent='🍳'"></div>`}
function render(){
 $('#cats').innerHTML=cats.map(x=>`<button class="pill ${x===category?'on':''}" data-c="${x}">${x}</button>`).join('');
 $('#meats').innerHTML=meats.map(x=>`<button class="pill ${x===meat?'on':''}" data-m="${x}">${x}</button>`).join('');
 const a=list(); $('#count').textContent=a.length+' 道';
 $('#grid').innerHTML=a.map(r=>`<article class="card">${img(r)}<div class="ct"><button class="heart" data-f="${r.id}">${favorites.includes(r.id)?'♥':'♡'}</button><b data-open="${r.id}">${r.name}</b><div class="meta">🕐 ${r.time} · ⭐ ${r.difficulty}</div></div></article>`).join('');
 document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{category=b.dataset.c;render()});document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{meat=b.dataset.m;render()});
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRecipe(+b.dataset.open));
 document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>fav(+b.dataset.f));
 $('#menubadge').textContent=menu.length; $('#sync').textContent=room?(cloudReady?'已同步 ✓':'待配置云同步'):'未设置共享码';
}
function fav(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('favorites',JSON.stringify(favorites));render()}
function openRecipe(id){const r=recipes.find(x=>x.id===id);$('#detail').innerHTML=`<button class="close" onclick="closeOv('detailOv')">×</button>${img(r,'detailpic')}<h2>${r.name}</h2><div class="tags"><span>🕐 ${r.time}</span><span>⭐ ${r.difficulty}</span>${r.tags.map(x=>`<span>${x}</span>`).join('')}</div><h3>🥩 食材</h3>${r.ingredients.map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount}</b></div>`).join('')}<h3>🧂 调料</h3>${r.seasonings.map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount}</b></div>`).join('')}<h3>👨‍🍳 做法</h3><ol class="steps">${r.steps.map((x,i)=>`<li><b>${i+1}</b><span><strong>${x.title}</strong><br>${x.content}</span></li>`).join('')}</ol><button class="primary full" onclick="toggleMenu(${id})">${menu.some(x=>x.id===id)?'✓ 已加入今日菜单':'+ 加入今日菜单'}</button>`;show('detailOv')}
function show(id){$('#'+id).classList.add('show')}function closeOv(id){$('#'+id).classList.remove('show')}
async function loadMenu(){const {data}=await cloud.from('shared_menu').select('recipe_id').eq('room_code',room).order('created_at');menu=(data||[]).map(x=>recipes.find(r=>r.id===x.recipe_id)).filter(Boolean);render()}
function subscribe(){cloud.channel('menu-'+room).on('postgres_changes',{event:'*',schema:'public',table:'shared_menu',filter:'room_code=eq.'+room},loadMenu).subscribe()}
async function toggleMenu(id){if(!room){setRoom();return}if(!cloudReady){alert('请先配置 Supabase');return}if(menu.some(x=>x.id===id))await cloud.from('shared_menu').delete().eq('room_code',room).eq('recipe_id',id);else await cloud.from('shared_menu').insert({room_code:room,recipe_id:id});await loadMenu();openRecipe(id)}
function setRoom(){let c=prompt('两台手机输入同一个家庭码（4-12位字母或数字）',room);if(c===null)return;c=c.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,12);if(c.length<4)return alert('至少4位');localStorage.setItem('recipe-room',c);location.reload()}
function openMenu(){if(!menu.length){$('#menuBody').innerHTML='<p>今天还没选菜。</p>'}else $('#menuBody').innerHTML=menu.map(r=>`<div class="line"><span>${r.name}</span><button onclick="toggleMenu(${r.id});setTimeout(openMenu,250)">移除</button></div>`).join('');show('menuOv')}
let comboN=3;
function chooser(){show('chooseOv')}
function makeCombo(){let mains=recipes.filter(r=>r.category!=='汤'), soups=recipes.filter(r=>r.category==='汤'), out=[];let pool=[...mains].sort(()=>Math.random()-.5);out=pool.slice(0,comboN);if(comboN===4)out=[...pool.slice(0,3),soups[Math.floor(Math.random()*soups.length)]];$('#combo').innerHTML=out.map(r=>`<div>🍽️ <b>${r.name}</b> · ${r.time}</div>`).join('');$('#combo').dataset.ids=out.map(x=>x.id).join(',')}
async function addCombo(){for(const id of ($('#combo').dataset.ids||'').split(',').filter(Boolean).map(Number)){if(!menu.some(x=>x.id===id)&&cloudReady&&room)await cloud.from('shared_menu').insert({room_code:room,recipe_id:id})}if(cloudReady&&room)await loadMenu();closeOv('chooseOv')}
$('#search').oninput=e=>{keyword=e.target.value.trim();render()};init();