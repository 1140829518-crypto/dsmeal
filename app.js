let baseRecipes=[], customRecipes=[], recipes=[];
let category='推荐', meat='全部', keyword='', menu=[], likes=[];
let comboN=3;

const $=s=>document.querySelector(s);
const SUPABASE_URL='https://jkfzokddawrqyjhnvzfh.supabase.co';
const SUPABASE_KEY='sb_publishable_zbxYrbxAkuottcSEWV_BEw_8FBIhBye';

const cloudReady=!SUPABASE_URL.startsWith('PASTE_')&&!SUPABASE_KEY.startsWith('PASTE_');
let room=localStorage.getItem('recipe-room')||'';
let myRole=localStorage.getItem('recipe-role')||'A';
let cloud=null;
if(cloudReady) cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const cats=['推荐','炒菜','炖煮','蒸菜','凉拌','煎炸','汤'];
const meats=['全部','猪肉','牛肉','鸡肉','排骨','鱼虾','鸡蛋','素菜','汤','其他'];

function otherRole(){return myRole==='A'?'B':'A'}
function keyFor(r){return r.source==='custom' ? 1000000+Number(r.cloud_id) : Number(r.id)}
function recipeByKey(id){return recipes.find(r=>keyFor(r)===Number(id))}
function rebuildRecipes(){recipes=[...baseRecipes,...customRecipes]}

async function init(){
  baseRecipes=(await fetch('./data/recipes.json').then(r=>r.json())).map(r=>({...r,source:'base'}));
  rebuildRecipes();
  render();
  if(room&&cloudReady){
    await loadCloudAll();
    subscribeAll();
  }
}

async function loadCloudAll(){
  await Promise.all([loadMenu(false),loadLikes(false),loadCustom(false)]);
  rebuildRecipes();
  render();
}

function list(){
  return recipes.filter(r=>
    (category==='推荐'||r.category===category)&&
    (meat==='全部'||r.meat===meat)&&
    (!keyword||r.name.includes(keyword)||(r.ingredients||[]).some(i=>(i.name||'').includes(keyword)))
  );
}

function img(r,cls='pic'){
  if(r.source==='custom') return `<div class="${cls}">🍳</div>`;
  return `<div class="${cls}"><img src="${r.image}" alt="${r.name}" onerror="this.remove();this.parentNode.textContent='🍳'"></div>`;
}

function isLiked(recipeKey,role){return likes.some(x=>Number(x.recipe_key)===Number(recipeKey)&&x.person_slot===role)}
function inMenu(recipeKey){return menu.some(x=>Number(x.recipe_key)===Number(recipeKey))}

function render(){
  $('#cats').innerHTML=cats.map(x=>`<button class="pill ${x===category?'on':''}" data-c="${x}">${x}</button>`).join('');
  $('#meats').innerHTML=meats.map(x=>`<button class="pill ${x===meat?'on':''}" data-m="${x}">${x}</button>`).join('');
  const a=list();
  $('#count').textContent=a.length+' 道';

  $('#grid').innerHTML=a.map(r=>{
    const k=keyFor(r), mine=isLiked(k,myRole), theirs=isLiked(k,otherRole()), added=inMenu(k);
    return `<article class="card">
      <div data-open="${k}">${img(r)}</div>
      <div class="ct">
        <div class="title-row">
          <div class="name" data-open="${k}">${r.name}</div>
          <div class="card-actions">
            <button class="mini ${added?'menu-on':''}" data-menu="${k}" title="加入今日菜单">${added?'✓':'＋'}</button>
            <button class="mini ${mine?'star-on':''}" data-self="${k}" title="我喜欢">${mine?'⭐':'☆'}</button>
            <button class="mini ${theirs?'heart-on':''}" data-partner="${k}" title="TA喜欢">${theirs?'❤️':'♡'}</button>
          </div>
        </div>
        <div class="meta">🕐 ${r.time||'20分钟'} · ⭐ ${r.difficulty||'简单'}</div>
        ${r.source==='custom'?'<div class="custom-note">📱 你们手机添加的菜谱</div>':''}
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{category=b.dataset.c;render()});
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{meat=b.dataset.m;render()});
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRecipe(+b.dataset.open));
  document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleMenu(+b.dataset.menu)});
  document.querySelectorAll('[data-self]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleLike(+b.dataset.self,myRole)});
  document.querySelectorAll('[data-partner]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleLike(+b.dataset.partner,otherRole())});

  $('#menubadge').textContent=menu.length;
  $('#sync').textContent=room?(cloudReady?`已同步✓ · ${myRole}`:'待配置云同步'):'未设置共享码';
}

function openRecipe(recipeKey){
  const r=recipeByKey(recipeKey);
  if(!r)return;
  const mine=isLiked(recipeKey,myRole), theirs=isLiked(recipeKey,otherRole()), added=inMenu(recipeKey);
  $('#detail').innerHTML=`
    <button class="close" onclick="closeOv('detailOv')">×</button>
    ${img(r,'detailpic')}
    <h2>${r.name}</h2>
    <div class="tags">
      <span>🕐 ${r.time||'20分钟'}</span>
      <span>⭐ ${r.difficulty||'简单'}</span>
      ${(r.tags||[]).map(x=>`<span>${x}</span>`).join('')}
      ${r.source==='custom'?'<span>📱 手机添加</span>':''}
    </div>

    <div class="detail-actions">
      <button class="self" onclick="toggleLike(${recipeKey},myRole);setTimeout(()=>openRecipe(${recipeKey}),180)">${mine?'⭐ 我喜欢':'☆ 我喜欢'}</button>
      <button class="partner" onclick="toggleLike(${recipeKey},otherRole());setTimeout(()=>openRecipe(${recipeKey}),180)">${theirs?'❤️ TA喜欢':'♡ TA喜欢'}</button>
      <button class="menu" onclick="toggleMenu(${recipeKey});setTimeout(()=>openRecipe(${recipeKey}),180)">${added?'✓ 已加菜单':'＋ 加菜单'}</button>
    </div>

    <h3>🥩 食材</h3>
    ${(r.ingredients||[]).map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount||'适量'}</b></div>`).join('')}

    <h3>🧂 调料</h3>
    ${(r.seasonings||[]).map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount||'适量'}</b></div>`).join('')}

    <h3>👨‍🍳 做法</h3>
    <ol class="steps">${(r.steps||[]).map((x,i)=>`<li><b>${i+1}</b><span><strong>${x.title||('步骤 '+(i+1))}</strong><br>${x.content||''}</span></li>`).join('')}</ol>

    ${r.source==='custom'?`<button class="danger full" onclick="deleteCustomRecipe(${r.cloud_id})">删除这道自定义菜谱</button>`:''}
  `;
  show('detailOv');
}

function show(id){$('#'+id).classList.add('show')}
function closeOv(id){$('#'+id).classList.remove('show')}

function openSetup(){
  $('#roomInput').value=room;
  selectRole(myRole);
  show('setupOv');
}
function selectRole(role){
  myRole=role;
  $('#roleA')?.classList.toggle('on',role==='A');
  $('#roleB')?.classList.toggle('on',role==='B');
}
function saveSetup(){
  let c=$('#roomInput').value.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,12);
  if(c.length<4)return alert('共享码至少4位');
  localStorage.setItem('recipe-room',c);
  localStorage.setItem('recipe-role',myRole);
  location.reload();
}

async function loadMenu(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('shared_menu').select('recipe_id').eq('room_code',room).order('created_at');
  if(error){console.error(error);return}
  menu=(data||[]).map(x=>({recipe_key:Number(x.recipe_id)}));
  if(doRender)render();
}

async function toggleMenu(recipeKey){
  if(!room){openSetup();return}
  if(!cloudReady)return alert('Supabase 未配置');
  if(inMenu(recipeKey)){
    await cloud.from('shared_menu').delete().eq('room_code',room).eq('recipe_id',recipeKey);
  }else{
    await cloud.from('shared_menu').insert({room_code:room,recipe_id:recipeKey});
  }
  await loadMenu();
}

function openMenu(){
  if(!menu.length){
    $('#menuBody').innerHTML='<p class="help">今天还没选菜。</p>';
    $('#clearMenuBtn').style.display='none';
  }else{
    $('#clearMenuBtn').style.display='block';
    $('#menuBody').innerHTML=menu.map(m=>{
      const r=recipeByKey(m.recipe_key);
      return r?`<div class="line"><span>${r.name}</span><button onclick="toggleMenu(${m.recipe_key});setTimeout(openMenu,250)">移除</button></div>`:'';
    }).join('');
  }
  show('menuOv');
}

async function clearMenu(){
  if(!room||!cloudReady)return;
  if(!confirm('确定一键移除今日菜单里的全部菜吗？'))return;
  await cloud.from('shared_menu').delete().eq('room_code',room);
  await loadMenu();
  openMenu();
}

async function loadLikes(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('recipe_likes').select('recipe_id,person_slot').eq('room_code',room);
  if(error){console.error(error);return}
  likes=(data||[]).map(x=>({recipe_key:Number(x.recipe_id),person_slot:x.person_slot}));
  if(doRender)render();
}

async function toggleLike(recipeKey,role){
  if(!room){openSetup();return}
  if(!cloudReady)return alert('Supabase 未配置');
  if(isLiked(recipeKey,role)){
    await cloud.from('recipe_likes').delete().eq('room_code',room).eq('recipe_id',recipeKey).eq('person_slot',role);
  }else{
    await cloud.from('recipe_likes').insert({room_code:room,recipe_id:recipeKey,person_slot:role});
  }
  await loadLikes();
}

async function loadCustom(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('custom_recipes').select('*').eq('room_code',room).order('created_at');
  if(error){console.error(error);return}
  customRecipes=(data||[]).map(x=>({
    id:1000000+Number(x.id),
    cloud_id:Number(x.id),
    source:'custom',
    name:x.name,
    category:x.category,
    meat:x.meat,
    time:x.time_text,
    difficulty:x.difficulty,
    ingredients:x.ingredients||[],
    seasonings:x.seasonings||[],
    steps:x.steps||[],
    tags:['自定义','两人共享']
  }));
  rebuildRecipes();
  if(doRender)render();
}

function openAddRecipe(){
  if(!room){openSetup();return}
  show('addOv');
}

function parseLineItems(text){
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
    const m=line.match(/^(.+?)\s+([^\s].*)$/);
    return m?{name:m[1].trim(),amount:m[2].trim()}:{name:line,amount:'适量'};
  });
}

function parseSteps(text){
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>({title:'步骤 '+(i+1),content:line}));
}

async function saveCustomRecipe(){
  if(!cloudReady||!room)return alert('请先完成双人同步设置');
  const name=$('#newName').value.trim();
  if(!name)return alert('先填写菜名');

  const payload={
    room_code:room,
    name,
    category:$('#newCategory').value,
    meat:$('#newMeat').value,
    time_text:$('#newTime').value.trim()||'20分钟',
    difficulty:$('#newDifficulty').value,
    ingredients:parseLineItems($('#newIngredients').value),
    seasonings:parseLineItems($('#newSeasonings').value),
    steps:parseSteps($('#newSteps').value),
    created_by:myRole
  };

  const {error}=await cloud.from('custom_recipes').insert(payload);
  if(error){console.error(error);return alert('保存失败：'+error.message)}

  $('#newName').value='';
  $('#newIngredients').value='';
  $('#newSeasonings').value='';
  $('#newSteps').value='';
  closeOv('addOv');
  await loadCustom();
  alert('保存成功，两台手机都会看到');
}

async function deleteCustomRecipe(cloudId){
  if(!confirm('确定删除这道自定义菜谱吗？两台手机都会删除。'))return;
  const recipeKey=1000000+Number(cloudId);
  await cloud.from('shared_menu').delete().eq('room_code',room).eq('recipe_id',recipeKey);
  await cloud.from('recipe_likes').delete().eq('room_code',room).eq('recipe_id',recipeKey);
  await cloud.from('custom_recipes').delete().eq('room_code',room).eq('id',cloudId);
  closeOv('detailOv');
  await loadCloudAll();
}

function subscribeAll(){
  cloud.channel('room-'+room)
    .on('postgres_changes',{event:'*',schema:'public',table:'shared_menu',filter:'room_code=eq.'+room},()=>loadMenu())
    .on('postgres_changes',{event:'*',schema:'public',table:'recipe_likes',filter:'room_code=eq.'+room},()=>loadLikes())
    .on('postgres_changes',{event:'*',schema:'public',table:'custom_recipes',filter:'room_code=eq.'+room},()=>loadCustom())
    .subscribe();
}

function chooser(){show('chooseOv');makeCombo()}

function makeCombo(){
  let mains=recipes.filter(r=>r.category!=='汤');
  let soups=recipes.filter(r=>r.category==='汤');
  let pool=[...mains].sort(()=>Math.random()-.5);
  let out=comboN===4?[...pool.slice(0,3),soups[Math.floor(Math.random()*soups.length)]]:pool.slice(0,comboN);
  out=out.filter(Boolean);
  $('#combo').innerHTML=out.map(r=>`<div>🍽️ <b>${r.name}</b> · ${r.time||'20分钟'}</div>`).join('');
  $('#combo').dataset.ids=out.map(keyFor).join(',');
}

async function addCombo(){
  if(!room){openSetup();return}
  const ids=($('#combo').dataset.ids||'').split(',').filter(Boolean).map(Number);
  for(const id of ids){
    if(!inMenu(id))await cloud.from('shared_menu').insert({room_code:room,recipe_id:id});
  }
  await loadMenu();
  closeOv('chooseOv');
}

$('#search').oninput=e=>{keyword=e.target.value.trim();render()};
init();
