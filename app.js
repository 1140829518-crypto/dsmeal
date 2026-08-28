let baseRecipes=[], customRecipes=[], overrides=[], recipes=[];
let category='推荐', meat='全部', keyword='', menu=[], likes=[];
let comboN=3, formMode='add', formRecipeKey=null, formPhotoFile=null, formPhotoUrl='';
let sharedAvatarUrl='';

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
function keyFor(r){return r.source==='custom'?1000000+Number(r.cloud_id):Number(r.id)}
function recipeByKey(id){return recipes.find(r=>keyFor(r)===Number(id))}
function overrideFor(id){return overrides.find(o=>Number(o.recipe_id)===Number(id))}

function applyOverride(r){
  const o=overrideFor(r.id);
  if(!o)return {...r,source:'base'};
  return {
    ...r,
    source:'base',
    name:o.name??r.name,
    category:o.category??r.category,
    meat:o.meat??r.meat,
    time:o.time_text??r.time,
    difficulty:o.difficulty??r.difficulty,
    ingredients:o.ingredients??r.ingredients,
    seasonings:o.seasonings??r.seasonings,
    steps:o.steps??r.steps,
    image_url:o.image_url||'',
    deleted:!!o.deleted
  };
}

function rebuildRecipes(){
  recipes=[...baseRecipes.map(applyOverride).filter(r=>!r.deleted),...customRecipes];
}

async function init(){
  baseRecipes=(await fetch('./data/recipes.json').then(r=>r.json())).map(r=>({...r,source:'base'}));
  rebuildRecipes(); render();
  if(room&&cloudReady){await loadCloudAll(); subscribeAll();}
  $('#recipeCamera')?.addEventListener('change',onPhotoSelected);
  $('#recipeGallery')?.addEventListener('change',onPhotoSelected);
  $('#avatarCamera')?.addEventListener('change',onAvatarSelected);
  $('#avatarGallery')?.addEventListener('change',onAvatarSelected);
  renderAvatar();
}

async function loadCloudAll(){
  await Promise.all([loadMenu(false),loadLikes(false),loadCustom(false),loadOverrides(false),loadAvatar(false)]);
  rebuildRecipes(); render();
}

function list(){
  return recipes.filter(r=>
    (category==='推荐'||r.category===category)&&
    (meat==='全部'||r.meat===meat)&&
    (!keyword||r.name.includes(keyword)||(r.ingredients||[]).some(i=>(i.name||'').includes(keyword)))
  );
}

function img(r,cls='pic'){
  const url=r.image_url||r.image||'';
  if(!url)return `<div class="${cls}">🍳</div>`;
  return `<div class="${cls}"><img src="${url}" alt="${r.name}" onerror="this.remove();this.parentNode.textContent='🍳'"></div>`;
}
function isLiked(k,role){return likes.some(x=>Number(x.recipe_key)===Number(k)&&x.person_slot===role)}
function inMenu(k){return menu.some(x=>Number(x.recipe_key)===Number(k))}

function render(){
  $('#cats').innerHTML=cats.map(x=>`<button class="pill ${x===category?'on':''}" data-c="${x}">${x}</button>`).join('');
  $('#meats').innerHTML=meats.map(x=>`<button class="pill ${x===meat?'on':''}" data-m="${x}">${x}</button>`).join('');
  const a=list(); $('#count').textContent=a.length+' 道';

  $('#grid').innerHTML=a.map(r=>{
    const k=keyFor(r), mine=isLiked(k,myRole), theirs=isLiked(k,otherRole()), added=inMenu(k);
    return `<article class="card">
      <div data-open="${k}">${img(r)}</div>
      <div class="ct">
        <div class="title-row">
          <div class="name" data-open="${k}">${r.name}</div>
          <div class="card-actions">
            <button class="mini ${added?'menu-on':''}" data-menu="${k}" title="今日菜单">${added?'✓':'＋'}</button>
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

function openRecipe(k){
  const r=recipeByKey(k); if(!r)return;
  const mine=isLiked(k,myRole), theirs=isLiked(k,otherRole()), added=inMenu(k);
  $('#detail').innerHTML=`
    <button class="close" onclick="closeOv('detailOv')">×</button>
    ${img(r,'detailpic')}
    <h2>${r.name}</h2>
    <div class="tags"><span>🕐 ${r.time||'20分钟'}</span><span>⭐ ${r.difficulty||'简单'}</span>${(r.tags||[]).map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="detail-actions">
      <button class="self" onclick="toggleLike(${k},myRole);setTimeout(()=>openRecipe(${k}),180)">${mine?'⭐ 我喜欢':'☆ 我喜欢'}</button>
      <button class="partner" onclick="toggleLike(${k},otherRole());setTimeout(()=>openRecipe(${k}),180)">${theirs?'❤️ TA喜欢':'♡ TA喜欢'}</button>
      <button class="menu" onclick="toggleMenu(${k});setTimeout(()=>openRecipe(${k}),180)">${added?'✓ 已加菜单':'＋ 加菜单'}</button>
    </div>
    <div class="detail-admin">
      <button class="edit-btn" onclick="openRecipeForm(${k})">✏️ 编辑菜谱</button>
      <button class="delete-btn" onclick="deleteRecipe(${k})">🗑 删除菜谱</button>
    </div>
    <h3>🥩 食材</h3>${(r.ingredients||[]).map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount||'适量'}</b></div>`).join('')}
    <h3>🧂 调料</h3>${(r.seasonings||[]).map(x=>`<div class="line"><span>${x.name}</span><b>${x.amount||'适量'}</b></div>`).join('')}
    <h3>👨‍🍳 做法</h3><ol class="steps">${(r.steps||[]).map((x,i)=>`<li><b>${i+1}</b><span><strong>${x.title||('步骤 '+(i+1))}</strong><br>${x.content||''}</span></li>`).join('')}</ol>`;
  show('detailOv');
}

function show(id){$('#'+id).classList.add('show')}
function closeOv(id){$('#'+id).classList.remove('show')}

function openSetup(){
  $('#roomInput').value=room; selectRole(myRole); show('setupOv');
}
function selectRole(role){
  myRole=role; $('#roleA')?.classList.toggle('on',role==='A'); $('#roleB')?.classList.toggle('on',role==='B');
}
function saveSetup(){
  let c=$('#roomInput').value.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,12);
  if(c.length<4)return alert('共享码至少4位');
  localStorage.setItem('recipe-room',c); localStorage.setItem('recipe-role',myRole); location.reload();
}

async function loadMenu(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('shared_menu').select('recipe_id').eq('room_code',room).order('created_at');
  if(error){console.error(error);return}
  menu=(data||[]).map(x=>({recipe_key:Number(x.recipe_id)})); if(doRender)render();
}
async function toggleMenu(k){
  if(!room){openSetup();return}
  if(inMenu(k))await cloud.from('shared_menu').delete().eq('room_code',room).eq('recipe_id',k);
  else await cloud.from('shared_menu').insert({room_code:room,recipe_id:k});
  await loadMenu();
}
async function clearMenu(){
  if(!confirm('确定一键移除今日菜单里的全部菜吗？'))return;
  await cloud.from('shared_menu').delete().eq('room_code',room); await loadMenu(); openMenu();
}
function openMenu(){
  if(!menu.length){$('#menuBody').innerHTML='<p class="help">今天还没选菜。</p>';$('#clearMenuBtn').style.display='none'}
  else{$('#clearMenuBtn').style.display='block';$('#menuBody').innerHTML=menu.map(m=>{const r=recipeByKey(m.recipe_key);return r?`<div class="line"><span>${r.name}</span><button onclick="toggleMenu(${m.recipe_key});setTimeout(openMenu,250)">移除</button></div>`:''}).join('')}
  show('menuOv');
}

async function loadLikes(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('recipe_likes').select('recipe_id,person_slot').eq('room_code',room);
  if(error){console.error(error);return}
  likes=(data||[]).map(x=>({recipe_key:Number(x.recipe_id),person_slot:x.person_slot})); if(doRender)render();
}
async function toggleLike(k,role){
  if(isLiked(k,role))await cloud.from('recipe_likes').delete().eq('room_code',room).eq('recipe_id',k).eq('person_slot',role);
  else await cloud.from('recipe_likes').insert({room_code:room,recipe_id:k,person_slot:role});
  await loadLikes();
}

async function loadOverrides(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('recipe_overrides').select('*').eq('room_code',room);
  if(error){console.error(error);return}
  overrides=data||[]; rebuildRecipes(); if(doRender)render();
}

async function loadCustom(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('custom_recipes').select('*').eq('room_code',room).order('created_at');
  if(error){console.error(error);return}
  customRecipes=(data||[]).map(x=>({
    id:1000000+Number(x.id),cloud_id:Number(x.id),source:'custom',
    name:x.name,category:x.category,meat:x.meat,time:x.time_text,difficulty:x.difficulty,
    ingredients:x.ingredients||[],seasonings:x.seasonings||[],steps:x.steps||[],
    image_url:x.image_url||'',tags:['自定义','两人共享']
  }));
  rebuildRecipes(); if(doRender)render();
}

function linesFromItems(arr){return (arr||[]).map(x=>`${x.name} ${x.amount||''}`.trim()).join('\n')}
function linesFromSteps(arr){return (arr||[]).map(x=>x.content||'').join('\n')}

function resetRecipeForm(){
  formMode='add'; formRecipeKey=null; formPhotoFile=null; formPhotoUrl='';
  $('#formTitle').textContent='＋ 添加菜谱'; $('#formName').value=''; $('#formCategory').value='炒菜'; $('#formMeat').value='猪肉';
  $('#formTime').value='20分钟'; $('#formDifficulty').value='简单'; $('#formIngredients').value=''; $('#formSeasonings').value=''; $('#formSteps').value='';
  if($('#recipeCamera')) $('#recipeCamera').value=''; if($('#recipeGallery')) $('#recipeGallery').value=''; renderPhotoPreview();
}

function openRecipeForm(k=null){
  if(!room){openSetup();return}
  resetRecipeForm();
  if(k!==null){
    const r=recipeByKey(k); if(!r)return;
    formMode='edit'; formRecipeKey=k; formPhotoUrl=r.image_url||((r.source==='base'&&r.image)?r.image:'');
    $('#formTitle').textContent='✏️ 编辑菜谱';
    $('#formName').value=r.name||''; $('#formCategory').value=r.category||'炒菜'; $('#formMeat').value=r.meat||'其他';
    $('#formTime').value=r.time||'20分钟'; $('#formDifficulty').value=r.difficulty||'简单';
    $('#formIngredients').value=linesFromItems(r.ingredients); $('#formSeasonings').value=linesFromItems(r.seasonings); $('#formSteps').value=linesFromSteps(r.steps);
    renderPhotoPreview();
    closeOv('detailOv');
  }
  show('formOv');
}

function renderPhotoPreview(){
  const box=$('#photoPreview');
  if(formPhotoFile){const u=URL.createObjectURL(formPhotoFile);box.innerHTML=`<img src="${u}">`;return}
  if(formPhotoUrl){box.innerHTML=`<img src="${formPhotoUrl}">`;return}
  box.textContent='📷';
}
function onPhotoSelected(e){formPhotoFile=e.target.files?.[0]||null;renderPhotoPreview()}
function removeFormPhoto(){formPhotoFile=null;formPhotoUrl='';if($('#recipeCamera'))$('#recipeCamera').value='';if($('#recipeGallery'))$('#recipeGallery').value='';renderPhotoPreview()}

function parseLineItems(text){
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
    const m=line.match(/^(.+?)\s+([^\s].*)$/); return m?{name:m[1].trim(),amount:m[2].trim()}:{name:line,amount:'适量'};
  });
}
function parseSteps(text){return text.split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>({title:'步骤 '+(i+1),content:line}))}

async function compressPhoto(file){
  try{
    const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)});
    const im=await new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=dataUrl});
    const max=1200, scale=Math.min(1,max/im.width), w=Math.round(im.width*scale), h=Math.round(im.height*scale);
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
    const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',0.82));
    return blob||file;
  }catch(e){return file}
}

async function uploadPhoto(file){
  if(!file)return formPhotoUrl||'';
  return uploadImageFile(file,'recipes');
}


function renderAvatar(){
  const box=$('#avatarContent');
  const preview=$('#avatarPreview');
  const content=sharedAvatarUrl?`<img src="${sharedAvatarUrl}" alt="头像">`:'👩‍🍳';
  if(box) box.innerHTML=content;
  if(preview) preview.innerHTML=content;
}
async function loadAvatar(doRender=true){
  if(!cloudReady||!room)return;
  const {data,error}=await cloud.from('app_profile').select('avatar_url').eq('room_code',room).maybeSingle();
  if(error){console.error(error);return}
  sharedAvatarUrl=data?.avatar_url||'';
  if(doRender)renderAvatar();
}
function openAvatarEditor(){
  if(!room){openSetup();return}
  renderAvatar(); show('avatarOv');
}
async function uploadImageFile(file,folder='recipes'){
  const blob=await compressPhoto(file);
  const path=`${room}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const {error}=await cloud.storage.from('recipe-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(error)throw error;
  return cloud.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
}
async function onAvatarSelected(e){
  const file=e.target.files?.[0]; if(!file)return;
  try{
    $('#avatarPreview').textContent='上传中…';
    const url=await uploadImageFile(file,'avatar');
    const {error}=await cloud.from('app_profile').upsert(
      {room_code:room,avatar_url:url,updated_at:new Date().toISOString()},
      {onConflict:'room_code'}
    );
    if(error)throw error;
    sharedAvatarUrl=url; renderAvatar(); closeOv('avatarOv');
    alert('头像已保存，两台手机都会同步');
  }catch(err){console.error(err);renderAvatar();alert('头像保存失败：'+(err.message||err))}
  finally{e.target.value=''}
}
async function resetAvatar(){
  if(!confirm('恢复默认厨师头像吗？'))return;
  const {error}=await cloud.from('app_profile').upsert(
    {room_code:room,avatar_url:null,updated_at:new Date().toISOString()},
    {onConflict:'room_code'}
  );
  if(error)return alert('恢复失败：'+error.message);
  sharedAvatarUrl=''; renderAvatar(); closeOv('avatarOv');
}

async function saveRecipeForm(){
  const btn=$('#saveRecipeBtn'); btn.classList.add('saving'); btn.textContent='正在保存…';
  try{
    const name=$('#formName').value.trim(); if(!name)throw new Error('请填写菜名');
    const imageUrl=await uploadPhoto(formPhotoFile);
    const data={
      name,category:$('#formCategory').value,meat:$('#formMeat').value,
      time_text:$('#formTime').value.trim()||'20分钟',difficulty:$('#formDifficulty').value,
      ingredients:parseLineItems($('#formIngredients').value),seasonings:parseLineItems($('#formSeasonings').value),
      steps:parseSteps($('#formSteps').value),image_url:imageUrl||null
    };
    if(formMode==='add'){
      const {error}=await cloud.from('custom_recipes').insert({room_code:room,...data,created_by:myRole});
      if(error)throw error;
      await loadCustom();
    }else{
      const r=recipeByKey(formRecipeKey);
      if(r.source==='custom'){
        const {error}=await cloud.from('custom_recipes').update(data).eq('room_code',room).eq('id',r.cloud_id);
        if(error)throw error; await loadCustom();
      }else{
        const payload={room_code:room,recipe_id:r.id,...data,deleted:false};
        const {error}=await cloud.from('recipe_overrides').upsert(payload,{onConflict:'room_code,recipe_id'});
        if(error)throw error; await loadOverrides();
      }
    }
    closeOv('formOv'); alert('保存成功，两台手机都会同步');
  }catch(e){console.error(e);alert('保存失败：'+(e.message||e))}
  finally{btn.classList.remove('saving');btn.textContent='保存并同步'}
}

async function deleteRecipe(k){
  const r=recipeByKey(k); if(!r)return;
  if(!confirm(`确定删除“${r.name}”吗？两台手机都会看不到。`))return;
  await cloud.from('shared_menu').delete().eq('room_code',room).eq('recipe_id',k);
  await cloud.from('recipe_likes').delete().eq('room_code',room).eq('recipe_id',k);
  if(r.source==='custom'){
    const {error}=await cloud.from('custom_recipes').delete().eq('room_code',room).eq('id',r.cloud_id); if(error)return alert(error.message);
    await loadCustom(false);
  }else{
    const {error}=await cloud.from('recipe_overrides').upsert({room_code:room,recipe_id:r.id,deleted:true},{onConflict:'room_code,recipe_id'});
    if(error)return alert(error.message); await loadOverrides(false);
  }
  await Promise.all([loadMenu(false),loadLikes(false)]); rebuildRecipes();render();closeOv('detailOv');
}

function subscribeAll(){
  cloud.channel('room-v2-'+room)
    .on('postgres_changes',{event:'*',schema:'public',table:'shared_menu',filter:'room_code=eq.'+room},()=>loadMenu())
    .on('postgres_changes',{event:'*',schema:'public',table:'recipe_likes',filter:'room_code=eq.'+room},()=>loadLikes())
    .on('postgres_changes',{event:'*',schema:'public',table:'custom_recipes',filter:'room_code=eq.'+room},()=>loadCustom())
    .on('postgres_changes',{event:'*',schema:'public',table:'recipe_overrides',filter:'room_code=eq.'+room},()=>loadOverrides())
    .on('postgres_changes',{event:'*',schema:'public',table:'app_profile',filter:'room_code=eq.'+room},()=>loadAvatar())
    .subscribe();
}

function chooser(){show('chooseOv');makeCombo()}
function makeCombo(){
  const mains=recipes.filter(r=>r.category!=='汤'),soups=recipes.filter(r=>r.category==='汤'),pool=[...mains].sort(()=>Math.random()-.5);
  let out=comboN===4?[...pool.slice(0,3),soups[Math.floor(Math.random()*soups.length)]]:pool.slice(0,comboN);out=out.filter(Boolean);
  $('#combo').innerHTML=out.map(r=>`<div>🍽️ <b>${r.name}</b> · ${r.time||'20分钟'}</div>`).join('');$('#combo').dataset.ids=out.map(keyFor).join(',');
}
async function addCombo(){
  const ids=($('#combo').dataset.ids||'').split(',').filter(Boolean).map(Number);
  for(const id of ids)if(!inMenu(id))await cloud.from('shared_menu').insert({room_code:room,recipe_id:id});
  await loadMenu();closeOv('chooseOv');
}

$('#search').oninput=e=>{keyword=e.target.value.trim();render()};
init();
