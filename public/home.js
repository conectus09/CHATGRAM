// ===================== DATA =====================
const ME = {name:'You', color:'#5288c1', emoji:'👤'};

const AVATARS = ['👩','👨','🧑','👱','👴','👵','🧔','👮','👩‍💼','🧑‍💻','👩‍🎨','🧑‍🎤'];
const COLORS = ['#e17055','#6c5ce7','#00b894','#fd79a8','#0984e3','#fdcb6e','#74b9ff','#a29bfe','#55efc4','#fab1a0','#81ecec','#dfe6e9'];

const CONTACTS = [
  {id:1, name:'Rahul Kumar', emoji:'👨', color:'#e17055', type:'personal', status:'online', phone:'+91 98765 00001', bio:'Zindagi ek safar hai'},
  {id:2, name:'Priya Sharma', emoji:'👩', color:'#6c5ce7', type:'personal', status:'online', phone:'+91 98765 00002', bio:'Positivity vibes only ✨'},
  {id:3, name:'Arjun Dev', emoji:'🧑', color:'#00b894', type:'personal', status:'last seen 5m ago', phone:'+91 98765 00003', bio:'Developer | Coder'},
  {id:4, name:'Sneha Patel', emoji:'👱', color:'#fd79a8', type:'personal', status:'online', phone:'+91 98765 00004', bio:''},
  {id:5, name:'Tech Talks 🚀', emoji:'💬', color:'#0984e3', type:'group', status:'47 members', phone:'', bio:'Tech discussions daily'},
  {id:6, name:'Coding Hub', emoji:'💻', color:'#6c5ce7', type:'group', status:'120 members', phone:'', bio:'Best coding group'},
  {id:7, name:'News India', emoji:'📰', color:'#e17055', type:'channel', status:'4.2K subscribers', phone:'', bio:'Latest news'},
  {id:8, name:'Vijay Singh', emoji:'🧔', color:'#fdcb6e', type:'personal', status:'last seen 2h ago', phone:'+91 98765 00008', bio:''},
  {id:9, name:'Anita Rao', emoji:'👩‍💼', color:'#81ecec', type:'personal', status:'online', phone:'+91 98765 00009', bio:'Finance Expert'},
  {id:10, name:'Cricket Fans 🏏', emoji:'🏏', color:'#27ae60', type:'group', status:'2.4K members', phone:'', bio:'For all cricket lovers'},
  {id:11, name:'MovieBot', emoji:'🤖', color:'#636e72', type:'bot', status:'bot', phone:'', bio:'Get movie recommendations'},
  {id:12, name:'Saved Messages', emoji:'🔖', color:'#5288c1', type:'personal', status:'', phone:'', bio:''},
];

const MSG_TEMPLATES = [
  'Hello! Kaise ho? 😊','Kal milte hain','Aaj kya plan hai?','Bahut achha!','Haan bhai, sahi keh rahe ho','Kab free ho?','Theek hai, done ✅','Yaar sun, ek baat bataata hoon','Lol 😂 sach mein?','Photo dekho!','Meeting 4 baje hai','Okay noted 👍','Thoda late hoon, wait karo','Happy Birthday! 🎂🎉','Bhai tu bhi naa... 😅'
];

let chats = {};
let currentChatId = null;
let replyToMsg = null;
let editingMsgId = null;
let contextMsgId = null;
let isRecording = false;
let muteState = {};
let pinnedMsgId = null;
let searchResults = [];
let searchIdx = 0;
let pollOptCount = 2;

// Build initial chats
function initChats() {
  CONTACTS.forEach((c, i) => {
    const msgs = [];
    const count = 3 + Math.floor(Math.random()*5);
    for(let j=0;j<count;j++){
      const isOut = Math.random() > 0.5;
      msgs.push({
        id: Date.now() + i*1000 + j,
        text: MSG_TEMPLATES[Math.floor(Math.random()*MSG_TEMPLATES.length)],
        sender: isOut ? 'me' : c.name,
        time: getRandomTime(j, count),
        status: isOut ? (Math.random()>0.5?'read':'delivered') : null,
        reactions:[],
        edited:false,
        forwarded:false,
        replyTo:null,
        pinned:false
      });
    }
    chats[c.id] = {
      contact: c,
      messages: msgs,
      unread: Math.random()>0.5 ? Math.floor(Math.random()*15)+1 : 0,
      muted: false,
      pinned: Math.random()>0.8,
      draft: '',
      lastTypingTime: null
    };
  });
}

function getRandomTime(idx, total) {
  const now = new Date();
  const mins = (total - idx) * 8;
  const d = new Date(now - mins*60000);
  return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

function now() {
  return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

// ===================== RENDER CHAT LIST =====================
function renderChatList(filter='', tab='all') {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';

  let items = Object.values(chats);

  // Sort: pinned first, then by last message time
  items.sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0));

  // Tab filter
  if(tab==='unread') items=items.filter(c=>c.unread>0);
  else if(tab==='personal') items=items.filter(c=>c.contact.type==='personal');
  else if(tab==='groups') items=items.filter(c=>c.contact.type==='group');
  else if(tab==='channels') items=items.filter(c=>c.contact.type==='channel');
  else if(tab==='bots') items=items.filter(c=>c.contact.type==='bot');

  // Search filter
  if(filter) items=items.filter(c=>c.contact.name.toLowerCase().includes(filter.toLowerCase()));

  items.forEach(chat => {
    const c = chat.contact;
    const lastMsg = chat.messages[chat.messages.length-1];
    const div = document.createElement('div');
    div.className='chat-item'+(currentChatId===c.id?' active':'');
    div.onclick=()=>openChat(c.id);

    const isOnline = c.status==='online';
    const tick = lastMsg&&lastMsg.sender==='me' ? (lastMsg.status==='read'?'✓✓':'✓') : '';
    const tickClass = lastMsg&&lastMsg.sender==='me' ? (lastMsg.status==='read'?'read':'delivered') : '';
    const preview = lastMsg ? (lastMsg.sender==='me'?'You: ':'')+lastMsg.text : '';

    div.innerHTML=`
      <div class="avatar" style="background:${c.color}20;color:${c.color};">
        ${c.emoji}
        ${isOnline?'<div class="online-dot"></div>':''}
      </div>
      <div class="chat-info">
        <div class="chat-top">
          <div class="chat-name">${c.name}${c.type==='channel'?'<span style="font-size:11px;color:var(--text-muted);margin-left:4px;">📢</span>':''}${c.type==='bot'?'<span style="font-size:11px;color:var(--accent);margin-left:4px;">BOT</span>':''}</div>
          <div style="display:flex;align-items:center;gap:4px;">
            ${chat.pinned?'<span class="pinned-icon">📌</span>':''}
            <div class="chat-time">${lastMsg?lastMsg.time:''}</div>
          </div>
        </div>
        <div class="chat-bottom">
          <div class="chat-preview">
            ${tick?`<span class="tick-icon ${tickClass}">${tick}</span>`:''}
            ${preview}
          </div>
          ${chat.unread?`<div class="unread-badge${chat.muted?' muted':''}">${chat.unread>99?'99+':chat.unread}</div>`:''}
        </div>
      </div>`;
    list.appendChild(div);
  });
}

let currentTab = 'all';
function filterTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderChatList(document.getElementById('search-input').value, tab);
}

function filterChats(val) {
  renderChatList(val, currentTab);
}

// ===================== OPEN CHAT =====================
function openChat(id) {
  currentChatId = id;
  const chat = chats[id];
  chat.unread = 0;

  document.getElementById('empty-state')&&(document.getElementById('empty-state').style.display='none');
  const cv = document.getElementById('chat-view');
  cv.style.display='flex';

  // Header
  const c = chat.contact;
  const av = document.getElementById('header-avatar');
  av.textContent = c.emoji;
  av.style.background = c.color+'30';
  av.style.color = c.color;
  document.getElementById('header-name').textContent = c.name;
  document.getElementById('header-status').textContent = c.status;

  renderMessages();
  renderChatList(document.getElementById('search-input').value, currentTab);
  scrollToBottom(true);

  // Mute label
  document.getElementById('mute-label').textContent = chat.muted ? 'Unmute Notifications' : 'Mute Notifications';

  // Pinned
  const pinned = chat.messages.find(m=>m.pinned);
  if(pinned) showPinned(pinned);
  else hidePinned();

  // Simulate typing occasionally
  simulateTyping();
}

function renderMessages() {
  if(!currentChatId) return;
  const chat = chats[currentChatId];
  const area = document.getElementById('messages-area');
  area.innerHTML = '';

  // Date separator
  const sep = document.createElement('div');
  sep.className='date-sep';
  sep.innerHTML='<span>Today</span>';
  area.appendChild(sep);

  // System msg
  if(chat.contact.type==='group'){
    addSystemMsg(area, `You joined ${chat.contact.name}`);
  }

  let prevSender = null;
  chat.messages.forEach((msg,i)=>{
    const isOut = msg.sender==='me';
    const grouped = msg.sender===prevSender;
    renderMessage(area, msg, isOut, grouped, i);
    prevSender = msg.sender;
  });
}

function renderMessage(area, msg, isOut, grouped, idx) {
  const wrap = document.createElement('div');
  wrap.className=`msg-wrap ${isOut?'out':'in'}${grouped?' grouped':''}${idx===0?' first':''}`;
  wrap.dataset.id=msg.id;

  let avatarHtml = '';
  if(!isOut) {
    const c = chats[currentChatId].contact;
    avatarHtml=`<div class="msg-avatar${grouped?' hidden':''}" style="background:${c.color}20;color:${c.color}">${c.emoji}</div>`;
  }

  let replyHtml='';
  if(msg.replyTo){
    replyHtml=`<div class="msg-reply" onclick="scrollToMsg(${msg.replyTo.id})">
      <div class="reply-name">${msg.replyTo.sender}</div>
      <div class="reply-text">${msg.replyTo.text}</div>
    </div>`;
  }

  let fwdHtml='';
  if(msg.forwarded){
    fwdHtml=`<div class="msg-forwarded">↩ Forwarded</div>`;
  }

  let reactHtml='';
  if(msg.reactions&&msg.reactions.length){
    const grouped={};
    msg.reactions.forEach(r=>{grouped[r]=(grouped[r]||0)+1;});
    reactHtml=`<div class="msg-reactions">${Object.entries(grouped).map(([e,c])=>`<div class="reaction-pill" onclick="addReaction('${e}',${msg.id})">${e}<span class="reaction-count">${c}</span></div>`).join('')}</div>`;
  }

  let tickHtml='';
  if(isOut){
    const t=msg.status==='read'?'✓✓':msg.status==='delivered'?'✓✓':'✓';
    const cls=msg.status==='read'?'read':msg.status==='delivered'?'delivered':'sent';
    tickHtml=`<span class="msg-tick ${cls}">${t}</span>`;
  }

  wrap.innerHTML=`
    ${avatarHtml}
    <div class="msg-bubble" id="msg-${msg.id}" oncontextmenu="showContextMenu(event,${msg.id})" ondblclick="setReply(${msg.id})">
      ${!isOut&&!grouped&&chats[currentChatId].contact.type==='group'?`<div class="msg-sender" style="color:${COLORS[msg.id%COLORS.length]}">${msg.sender}</div>`:''}
      ${fwdHtml}${replyHtml}
      <div class="msg-text">${formatText(msg.text)}</div>
      ${reactHtml}
      <div class="msg-meta">
        ${msg.edited?'<span class="msg-edited">edited</span>':''}
        <span class="msg-time">${msg.time}</span>
        ${tickHtml}
      </div>
    </div>`;

  area.appendChild(wrap);
}

function addSystemMsg(area, text) {
  const div=document.createElement('div');
  div.className='sys-msg';
  div.innerHTML=`<span>${text}</span>`;
  area.appendChild(div);
}

function formatText(text) {
  // Bold
  text=text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>');
  // Italic
  text=text.replace(/_(.*?)_/g,'<i>$1</i>');
  // Code
  text=text.replace(/`(.*?)`/g,'<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;font-size:13px;">$1</code>');
  // URLs
  text=text.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank">$1</a>');
  return text;
}

// ===================== SEND MESSAGE =====================
function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if(!text || !currentChatId) return;

  const chat = chats[currentChatId];
  const msg = {
    id: Date.now(),
    text,
    sender:'me',
    time:now(),
    status:'sent',
    reactions:[],
    edited:false,
    forwarded:false,
    replyTo: replyToMsg ? {id:replyToMsg.id, sender:replyToMsg.sender, text:replyToMsg.text} : null,
    pinned:false
  };

  // If editing
  if(editingMsgId) {
    const m=chat.messages.find(m=>m.id===editingMsgId);
    if(m){m.text=text;m.edited=true;}
    cancelEdit();
    renderMessages();
    scrollToBottom();
    renderChatList(document.getElementById('search-input').value, currentTab);
    input.value='';
    updateSendBtn('');
    return;
  }

  chat.messages.push(msg);
  cancelReply();
  input.value='';
  updateSendBtn('');
  input.style.height='auto';

  renderMessages();
  scrollToBottom();
  renderChatList(document.getElementById('search-input').value, currentTab);

  // Simulate reply after delay
  setTimeout(()=>{
    msg.status='delivered';
    renderMessages();
  },800);
  setTimeout(()=>{
    msg.status='read';
    renderMessages();
    simulateReply();
  },2000+Math.random()*3000);
}

function simulateReply() {
  if(!currentChatId) return;
  const chat = chats[currentChatId];
  const c = chat.contact;
  if(c.type==='channel') return;

  // Show typing
  const ti = document.getElementById('typing-indicator');
  ti.textContent = (c.type==='group'?c.name+' is typing...':'typing...');
  ti.classList.add('show');

  setTimeout(()=>{
    ti.classList.remove('show');
    const reply = {
      id:Date.now(),
      text:MSG_TEMPLATES[Math.floor(Math.random()*MSG_TEMPLATES.length)],
      sender:c.name,
      time:now(),
      status:null,
      reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false
    };
    chat.messages.push(reply);
    renderMessages();
    scrollToBottom();
    renderChatList(document.getElementById('search-input').value, currentTab);

    // Notification if not in this chat
    showNotification(c, reply.text);
  }, 1500+Math.random()*1500);
}

function simulateTyping() {
  if(!currentChatId) return;
  const chat = chats[currentChatId];
  const c = chat.contact;
  if(c.type==='channel') return;
  if(Math.random()<0.3){
    setTimeout(()=>{
      const ti = document.getElementById('typing-indicator');
      if(currentChatId===chat.contact.id){
        ti.textContent = 'typing...';
        ti.classList.add('show');
        setTimeout(()=>ti.classList.remove('show'),2000);
      }
    }, 1000+Math.random()*2000);
  }
}

// ===================== REPLY =====================
function setReply(msgId) {
  if(!currentChatId) return;
  const chat=chats[currentChatId];
  const msg=chat.messages.find(m=>m.id===msgId);
  if(!msg) return;
  replyToMsg=msg;
  document.getElementById('rp-name').textContent=msg.sender==='me'?'You':msg.sender;
  document.getElementById('rp-text').textContent=msg.text;
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('msg-input').focus();
}

function cancelReply(){
  replyToMsg=null;
  document.getElementById('reply-preview').classList.remove('show');
}

// ===================== EDIT =====================
function startEdit(msgId){
  if(!currentChatId) return;
  const chat=chats[currentChatId];
  const msg=chat.messages.find(m=>m.id===msgId);
  if(!msg||msg.sender!=='me') return;
  editingMsgId=msgId;
  document.getElementById('ep-text').textContent=msg.text;
  document.getElementById('edit-preview').classList.add('show');
  const input=document.getElementById('msg-input');
  input.value=msg.text;
  input.focus();
  updateSendBtn(msg.text);
}

function cancelEdit(){
  editingMsgId=null;
  document.getElementById('edit-preview').classList.remove('show');
  document.getElementById('msg-input').value='';
  updateSendBtn('');
}

// ===================== CONTEXT MENU =====================
function showContextMenu(e, msgId) {
  e.preventDefault();
  contextMsgId=msgId;
  const menu=document.getElementById('context-menu');
  const chat=currentChatId?chats[currentChatId]:null;
  const msg=chat?chat.messages.find(m=>m.id===msgId):null;

  // Show/hide edit option
  const editItem=document.getElementById('ctx-edit');
  if(editItem) editItem.style.display=(msg&&msg.sender==='me')?'flex':'none';

  menu.classList.add('show');
  let x=e.clientX, y=e.clientY;
  const mw=menu.offsetWidth||210, mh=menu.offsetHeight||340;
  if(x+mw>window.innerWidth) x=window.innerWidth-mw-8;
  if(y+mh>window.innerHeight) y=window.innerHeight-mh-8;
  menu.style.left=x+'px';
  menu.style.top=y+'px';
}

function ctxAction(action) {
  closeContextMenu();
  if(!currentChatId||!contextMsgId) return;
  const chat=chats[currentChatId];
  const msg=chat.messages.find(m=>m.id===contextMsgId);
  if(!msg) return;

  switch(action){
    case 'reply': setReply(contextMsgId); break;
    case 'edit': startEdit(contextMsgId); break;
    case 'copy':
      navigator.clipboard.writeText(msg.text).catch(()=>{});
      toast('Text copied!'); break;
    case 'forward':
      buildForwardList();
      openModal('forwardModal'); break;
    case 'pin':
      msg.pinned=!msg.pinned;
      if(msg.pinned) showPinned(msg);
      else hidePinned();
      renderMessages();
      toast(msg.pinned?'Message pinned':'Message unpinned'); break;
    case 'select':
      document.getElementById('msg-'+contextMsgId)?.classList.toggle('selected'); break;
    case 'save':
      toast('Saved to bookmarks! 🔖'); break;
    case 'delete':
      openModal('deleteMessageModal'); break;
  }
}

function addReaction(emoji, msgId) {
  closeContextMenu();
  const id=msgId||contextMsgId;
  if(!id||!currentChatId) return;
  const chat=chats[currentChatId];
  const msg=chat.messages.find(m=>m.id===id);
  if(!msg) return;
  if(!msg.reactions.includes(emoji)) msg.reactions.push(emoji);
  else msg.reactions=msg.reactions.filter(r=>r!==emoji);
  renderMessages();
}

function closeContextMenu(){
  document.getElementById('context-menu').classList.remove('show');
}

// ===================== 3 DOTS MENU =====================
function toggleDotsMenu(e){
  e.stopPropagation();
  const m=document.getElementById('dots-menu');
  m.classList.toggle('show');
}
function closeDotsMenu(){
  document.getElementById('dots-menu').classList.remove('show');
}

function dotsAction(action){
  closeDotsMenu();
  if(!currentChatId) return;
  const chat=chats[currentChatId];
  switch(action){
    case 'search': toggleSearchBar(); break;
    case 'mute':
      chat.muted=!chat.muted;
      document.getElementById('mute-label').textContent=chat.muted?'Unmute Notifications':'Mute Notifications';
      toast(chat.muted?'Notifications muted 🔇':'Notifications unmuted 🔔');
      renderChatList(document.getElementById('search-input').value, currentTab); break;
    case 'pin':
      chat.pinned=!chat.pinned;
      toast(chat.pinned?'Chat pinned 📌':'Chat unpinned');
      renderChatList(document.getElementById('search-input').value, currentTab); break;
    case 'archive': toast('Chat archived 📦'); break;
    case 'wallpaper': toast('Wallpaper settings coming soon!'); break;
    case 'export': toast('Chat export started... 📤'); break;
    case 'report': toast('Chat reported ⚠️'); break;
    case 'delete': openModal('deleteChatModal'); break;
    case 'block': toast('User blocked 🚫'); break;
  }
}

// ===================== SEARCH IN CHAT =====================
function toggleSearchBar(){
  const bar=document.getElementById('header-search-bar');
  const actions=document.getElementById('normal-header-actions');
  const showing=bar.classList.toggle('show');
  actions.style.display=showing?'none':'flex';
  if(showing) document.getElementById('header-search-input').focus();
  else{
    document.getElementById('header-search-input').value='';
    searchResults=[];
    clearSearchHighlights();
  }
}

function searchInChat(q){
  clearSearchHighlights();
  searchResults=[];
  searchIdx=0;
  if(!q||!currentChatId) {
    document.getElementById('search-results-count').textContent='0 results';
    return;
  }
  const chat=chats[currentChatId];
  chat.messages.forEach(m=>{
    if(m.text.toLowerCase().includes(q.toLowerCase())) searchResults.push(m.id);
  });
  document.getElementById('search-results-count').textContent=searchResults.length+' results';
  if(searchResults.length) highlightSearch(0);
}

function highlightSearch(idx){
  clearSearchHighlights();
  if(!searchResults.length) return;
  searchIdx=(idx+searchResults.length)%searchResults.length;
  const el=document.getElementById('msg-'+searchResults[searchIdx]);
  if(el){
    el.classList.add('selected');
    el.scrollIntoView({behavior:'smooth',block:'center'});
  }
  document.getElementById('search-results-count').textContent=(searchIdx+1)+'/'+searchResults.length;
}

function clearSearchHighlights(){
  document.querySelectorAll('.msg-bubble.selected').forEach(e=>e.classList.remove('selected'));
}

function navSearch(dir){ highlightSearch(searchIdx+dir); }

// ===================== EMOJI PICKER =====================
const EMOJIS = {
  smileys:['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  people:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸'],
  animals:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊'],
  food:['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍜','🍝','🍛','🍲','🥘','🍣','🍱','🍤','🍙','🍚','🍘','🍥','🧁','🎂','🍰','🍩','🍪','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉'],
  travel:['✈️','🚀','🛸','🚁','🛶','⛵','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🏎️','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🚨','🚥','🚦','🛑','🚧','🗺️','🌍','🌎','🌏','🧭','🏔️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'],
  objects:['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🔫','🪃','🛡️','🔧','🪛','🔩','⚙️','🗜️','🔗'],
  symbols:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕'],
  flags:['🏳️','🏴','🏁','🚩','🏴‍☠️','🇮🇳','🇺🇸','🇬🇧','🇦🇺','🇨🇦','🇩🇪','🇫🇷','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇷🇺','🇮🇹','🇪🇸','🇲🇽','🇦🇷','🇿🇦','🇳🇬','🇪🇬','🇸🇦','🇦🇪','🇵🇰','🇧🇩','🇹🇷','🇮🇩','🇹🇭','🇻🇳','🇵🇭','🇳🇱','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇺🇦','🇨🇭','🇦🇹','🇵🇹','🇬🇷']
};

let currentEmojiCat='smileys';
function renderEmojis(emojis){
  const grid=document.getElementById('emoji-grid');
  grid.innerHTML='';
  emojis.forEach(e=>{
    const btn=document.createElement('button');
    btn.className='emoji-btn';
    btn.textContent=e;
    btn.onclick=()=>insertEmoji(e);
    grid.appendChild(btn);
  });
}
function switchEmojiCat(cat,btn){
  currentEmojiCat=cat;
  document.querySelectorAll('.emoji-cat').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderEmojis(EMOJIS[cat]);
  document.getElementById('emoji-search').value='';
}
function searchEmoji(q){
  if(!q){renderEmojis(EMOJIS[currentEmojiCat]);return;}
  const all=Object.values(EMOJIS).flat();
  renderEmojis(all.filter(e=>e.includes(q)));
}
function insertEmoji(e){
  const input=document.getElementById('msg-input');
  input.value+=e;
  input.focus();
  updateSendBtn(input.value);
}
function toggleEmojiPicker(){
  const p=document.getElementById('emoji-picker');
  p.classList.toggle('show');
  document.getElementById('sticker-panel').classList.remove('show');
  document.getElementById('attach-menu').classList.remove('show');
  if(p.classList.contains('show')) renderEmojis(EMOJIS.smileys);
}
function toggleEmojiForReaction(){
  closeContextMenu();
  toggleEmojiPicker();
}

// ===================== STICKERS =====================
const STICKERS=['😸','🐶','🦁','🐸','🦊','🦄','🐼','🦋','🐙','🦈','🐲','🦉','🦩','🦚','🐬','🦭','🐳','🦅','🐝','🌸','🌺','🌻','🌹','🌷','🍀','🎋','🎄','🎃','⭐','🌟','💫','🎆','🎇','🎉','🎊','🎈','🎁','🎀','🎯','🎮','🎲','♟️','🎭','🎨','🖼️','🎬','🎤','🎵','🎶','🎸','🎹'];
function renderStickers(){
  const g=document.getElementById('sticker-grid');
  g.innerHTML='';
  STICKERS.forEach(s=>{
    const btn=document.createElement('button');
    btn.className='sticker-btn';
    btn.textContent=s;
    btn.onclick=()=>sendSticker(s);
    g.appendChild(btn);
  });
}
function sendSticker(s){
  if(!currentChatId) return;
  document.getElementById('sticker-panel').classList.remove('show');
  const chat=chats[currentChatId];
  const msg={id:Date.now(),text:s,sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false};
  chat.messages.push(msg);
  renderMessages();scrollToBottom();
  renderChatList(document.getElementById('search-input').value,currentTab);
}

// ===================== ATTACH MENU =====================
function toggleAttachMenu(){
  const m=document.getElementById('attach-menu');
  m.classList.toggle('show');
  document.getElementById('emoji-picker').classList.remove('show');
  document.getElementById('sticker-panel').classList.remove('show');
}
function attachAction(type){
  document.getElementById('attach-menu').classList.remove('show');
  if(type==='poll'){openModal('pollModal');return;}
  if(type==='sticker'){document.getElementById('sticker-panel').classList.toggle('show');renderStickers();return;}
  const labels={photo:'📷 Photo sent',video:'🎥 Video sent',file:'📄 File sent',location:'📍 Location shared',contact:'👤 Contact shared',music:'🎵 Music sent',gif:'🎞️ GIF sent'};
  toast(labels[type]||'Sent!');
  if(!currentChatId) return;
  const chat=chats[currentChatId];
  const emojis={photo:'📷 [Photo]',video:'🎥 [Video]',file:'📎 [File]',location:'📍 [Location]',contact:'👤 [Contact]',music:'🎵 [Audio]',gif:'🎞️ [GIF]'};
  const msg={id:Date.now(),text:emojis[type]||'[Attachment]',sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false};
  chat.messages.push(msg);
  renderMessages();scrollToBottom();
  renderChatList(document.getElementById('search-input').value,currentTab);
}

// ===================== POLL =====================
function addPollOption(){
  pollOptCount++;
  const div=document.getElementById('poll-options');
  const inp=document.createElement('input');
  inp.className='modal-input';inp.type='text';
  inp.placeholder=`Option ${pollOptCount}`;inp.id=`poll-opt-${pollOptCount}`;
  div.appendChild(inp);
}
function sendPoll(){
  const q=document.getElementById('poll-question').value.trim();
  if(!q){toast('Enter a question!');return;}
  const opts=[];
  for(let i=1;i<=pollOptCount;i++){
    const v=document.getElementById(`poll-opt-${i}`)?.value.trim();
    if(v) opts.push(v);
  }
  if(opts.length<2){toast('Add at least 2 options!');return;}
  closeModal('pollModal');
  if(!currentChatId) return;
  const chat=chats[currentChatId];
  const pollText=`📊 Poll: ${q}\n${opts.map((o,i)=>`${['🔵','🟢','🟡','🟠','🔴'][i]||'⚫'} ${o}`).join('\n')}`;
  const msg={id:Date.now(),text:pollText,sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false};
  chat.messages.push(msg);
  renderMessages();scrollToBottom();
  renderChatList(document.getElementById('search-input').value,currentTab);
}

// ===================== VOICE =====================
function toggleVoice(){
  if(!currentChatId) return;
  isRecording=!isRecording;
  const btn=document.getElementById('voice-btn-main');
  if(isRecording){
    btn.style.background='var(--red)';
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="20" height="20"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    toast('🎙️ Recording...');
  } else {
    btn.style.background='var(--accent)';
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="20" height="20"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    const chat=chats[currentChatId];
    const dur=Math.floor(2+Math.random()*15);
    const msg={id:Date.now(),text:`🎙️ Voice message (0:${String(dur).padStart(2,'0')})`,sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false};
    chat.messages.push(msg);
    renderMessages();scrollToBottom();
    renderChatList(document.getElementById('search-input').value,currentTab);
  }
}

// ===================== CALL =====================
function initiateCall(type){
  if(!currentChatId) return;
  const c=chats[currentChatId].contact;
  document.getElementById('call-avatar').textContent=c.emoji;
  document.getElementById('call-avatar').style.background=c.color+'30';
  document.getElementById('call-name').textContent=c.name;
  document.getElementById('call-status').textContent=type==='video'?'📹 Video Calling...':'📞 Voice Calling...';
  openModal('callModal');
  setTimeout(()=>{
    document.getElementById('call-status').textContent=type==='video'?'📹 Video Connected':'📞 Connected';
  },2000);
}
function endCall(){ closeModal('callModal'); toast('Call ended'); }
function toggleCallMic(){ toast('Microphone toggled'); }
function toggleSpeaker(){ toast('Speaker toggled'); }

// ===================== PINNED MESSAGE =====================
function showPinned(msg){
  document.getElementById('pinned-text').textContent=msg.text;
  document.getElementById('pinned-bar').classList.add('show');
  pinnedMsgId=msg.id;
}
function hidePinned(){
  document.getElementById('pinned-bar').classList.remove('show');
  pinnedMsgId=null;
}
function scrollToPinned(){
  if(pinnedMsgId){
    const el=document.getElementById('msg-'+pinnedMsgId);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('highlight');}
  }
}

// ===================== DELETE =====================
function confirmDeleteMessage(){
  closeModal('deleteMessageModal');
  if(!currentChatId||!contextMsgId) return;
  const chat=chats[currentChatId];
  chat.messages=chat.messages.filter(m=>m.id!==contextMsgId);
  renderMessages();
  renderChatList(document.getElementById('search-input').value,currentTab);
  toast('Message deleted');
}
function confirmDeleteChat(){
  closeModal('deleteChatModal');
  if(!currentChatId) return;
  delete chats[currentChatId];
  currentChatId=null;
  document.getElementById('chat-view').style.display='none';
  document.getElementById('empty-state').style.display='flex';
  renderChatList(document.getElementById('search-input').value,currentTab);
  toast('Chat deleted');
}

// ===================== FORWARD =====================
function buildForwardList(){
  const list=document.getElementById('forward-list');
  list.innerHTML='';
  Object.values(chats).forEach(chat=>{
    const c=chat.contact;
    const div=document.createElement('div');
    div.className='forward-chat-item';
    div.innerHTML=`<input type="checkbox" value="${c.id}"><div class="forward-avatar" style="background:${c.color}20;color:${c.color}">${c.emoji}</div><div class="forward-name">${c.name}</div>`;
    list.appendChild(div);
  });
}
function confirmForward(){
  const checked=[...document.querySelectorAll('#forward-list input:checked')].map(i=>i.value);
  closeModal('forwardModal');
  if(!checked.length||!contextMsgId) return;
  const srcChat=chats[currentChatId];
  const msg=srcChat.messages.find(m=>m.id===contextMsgId);
  if(!msg) return;
  checked.forEach(id=>{
    if(chats[id]){
      chats[id].messages.push({id:Date.now()+Math.random(),text:msg.text,sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:true,replyTo:null,pinned:false});
    }
  });
  toast(`Forwarded to ${checked.length} chat(s) ↩`);
  renderMessages();
}

// ===================== INFO PANEL =====================
function openInfoPanel(){
  if(!currentChatId) return;
  const c=chats[currentChatId].contact;
  const panel=document.getElementById('info-panel');
  panel.classList.add('open');
  const body=document.getElementById('info-panel-body');
  body.innerHTML=`
    <div class="info-avatar-wrap">
      <div class="info-big-avatar" style="background:${c.color}20;color:${c.color};font-size:2.5rem;">${c.emoji}</div>
    </div>
    <div class="info-name">${c.name}</div>
    <div class="info-status">${c.status}</div>
    ${c.phone?`<div class="info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.37 2 2 0 0 1 3.59 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91"/></svg><div><div class="info-row-text">${c.phone}</div><div class="info-row-label">Mobile</div></div></div>`:''}
    ${c.bio?`<div class="info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><div><div class="info-row-text">${c.bio}</div><div class="info-row-label">Bio</div></div></div>`:''}
    <div class="info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><div><div class="info-row-text">${c.type==='group'?'Group':c.type==='channel'?'Channel':c.type==='bot'?'Bot':'Contact'}</div><div class="info-row-label">Type</div></div></div>

    <div class="info-section-title">SHARED MEDIA</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:16px;">
      ${['📷','🎥','📎','🎵','🔗','📊'].map(e=>`<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:20px 8px;text-align:center;font-size:1.5rem;cursor:pointer;">${e}</div>`).join('')}
    </div>

    <div class="info-section-title">ACTIONS</div>
    <div class="info-action" onclick="initiateCall('voice');closeInfoPanel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.37 2 2 0 0 1 3.59 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91"/></svg>
      Voice Call
    </div>
    <div class="info-action" onclick="initiateCall('video');closeInfoPanel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      Video Call
    </div>
    <div class="info-action" onclick="dotsAction('mute')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      Mute Notifications
    </div>
    <div class="info-action" onclick="dotsAction('pin')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>
      Pin Chat
    </div>
    <div class="info-separator" style="height:1px;background:rgba(255,255,255,0.04);margin:8px 0;"></div>
    <div class="info-action danger" onclick="dotsAction('block');closeInfoPanel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      Block ${c.name}
    </div>
    <div class="info-action danger" onclick="dotsAction('delete');closeInfoPanel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Delete Chat
    </div>
  `;
}
function closeInfoPanel(){
  document.getElementById('info-panel').classList.remove('open');
}

// ===================== LEFT MENU =====================
function toggleLeftMenu(){
  document.getElementById('left-menu').classList.toggle('open');
  const ov=document.getElementById('menu-overlay');
  ov.style.display=document.getElementById('left-menu').classList.contains('open')?'block':'none';
}
function closeLeftMenu(){
  document.getElementById('left-menu').classList.remove('open');
  document.getElementById('menu-overlay').style.display='none';
}

// ===================== MODALS =====================
function openModal(id){
  document.getElementById(id).classList.add('show');
}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
}
document.querySelectorAll('.modal-overlay').forEach(el=>{
  el.addEventListener('click',function(e){
    if(e.target===this) this.classList.remove('show');
  });
});

// ===================== SAVED MESSAGES =====================
function showSavedMessages(){
  closeLeftMenu();
  openChat(12);
}

// ===================== GROUP / CHANNEL =====================
function createGroup(){
  const name=document.getElementById('group-name-input').value.trim();
  if(!name){toast('Enter group name!');return;}
  closeModal('newGroupModal');
  const id=Date.now();
  const c={id,name,emoji:'👥',color:COLORS[Math.floor(Math.random()*COLORS.length)],type:'group',status:'1 member',phone:'',bio:''};
  CONTACTS.push(c);
  chats[id]={contact:c,messages:[{id:Date.now()+1,text:'Group created',sender:'me',time:now(),status:'sent',reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false}],unread:0,muted:false,pinned:false,draft:''};
  renderChatList(document.getElementById('search-input').value,currentTab);
  openChat(id);
  toast(`Group "${name}" created! 🎉`);
}
function createChannel(){
  const name=document.getElementById('channel-name-input').value.trim();
  if(!name){toast('Enter channel name!');return;}
  closeModal('newChannelModal');
  const id=Date.now();
  const c={id,name,emoji:'📢',color:COLORS[Math.floor(Math.random()*COLORS.length)],type:'channel',status:'0 subscribers',phone:'',bio:''};
  CONTACTS.push(c);
  chats[id]={contact:c,messages:[],unread:0,muted:false,pinned:false,draft:''};
  renderChatList(document.getElementById('search-input').value,currentTab);
  openChat(id);
  toast(`Channel "${name}" created! 📢`);
}

// ===================== CONTACTS SEARCH =====================
function searchContacts(q){
  const res=document.getElementById('contact-results');
  res.innerHTML='';
  if(!q) return;
  CONTACTS.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())).forEach(c=>{
    const div=document.createElement('div');
    div.className='forward-chat-item';
    div.innerHTML=`<div class="forward-avatar" style="background:${c.color}20;color:${c.color}">${c.emoji}</div><div class="forward-name">${c.name}</div>`;
    div.onclick=()=>{closeModal('newChatModal');openChat(c.id);};
    res.appendChild(div);
  });
}

// ===================== SETTINGS =====================
function saveSettings(){ closeModal('settingsModal'); toast('Settings saved ✅'); }

// ===================== NOTIFICATIONS =====================
function showNotification(contact, text){
  const wrap=document.getElementById('notification-wrap');
  const n=document.createElement('div');
  n.className='notification';
  n.innerHTML=`<div class="notif-avatar" style="background:${contact.color}20;color:${contact.color}">${contact.emoji}</div><div class="notif-info"><div class="notif-name">${contact.name}</div><div class="notif-text">${text}</div></div>`;
  n.onclick=()=>{openChat(contact.id);n.remove();};
  wrap.appendChild(n);
  setTimeout(()=>{n.style.animation='notifSlide 0.3s ease reverse';setTimeout(()=>n.remove(),300);},4000);
}

// ===================== SCROLL =====================
function scrollToBottom(instant){
  const area=document.getElementById('messages-area');
  area.scrollTo({top:area.scrollHeight,behavior:instant?'auto':'smooth'});
}

function scrollToMsg(id){
  const el=document.getElementById('msg-'+id);
  if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('highlight');setTimeout(()=>el.classList.remove('highlight'),1500);}
}

function handleScroll(){
  const area=document.getElementById('messages-area');
  const btn=document.getElementById('scroll-to-bottom');
  const fromBottom=area.scrollHeight-area.scrollTop-area.clientHeight;
  btn.classList.toggle('show',fromBottom>200);
}

// ===================== INPUT =====================
function handleInput(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
  updateSendBtn(el.value);
}

function updateSendBtn(val){
  const hasText=val.trim().length>0;
  document.getElementById('send-btn').style.display=hasText?'flex':'none';
  document.getElementById('voice-btn-main').style.display=hasText?'none':'flex';
}

function handleKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  if(e.key==='Escape'){cancelReply();cancelEdit();}
}

// ===================== THEME =====================
let isDark=true;
function toggleTheme(){
  isDark=!isDark;
  const toggle=document.getElementById('menu-darkmode');
  const thumb=document.getElementById('menu-darkmode-thumb');
  if(isDark){
    document.documentElement.style.setProperty('--bg-primary','#17212b');
    document.documentElement.style.setProperty('--bg-secondary','#0e1621');
    document.documentElement.style.setProperty('--bg-chat','#1c2733');
    document.documentElement.style.setProperty('--text-primary','#d1d5db');
    toggle.classList.remove('light');
    thumb.textContent='🌙';
  } else {
    document.documentElement.style.setProperty('--bg-primary','#f5f5f5');
    document.documentElement.style.setProperty('--bg-secondary','#e8e8e8');
    document.documentElement.style.setProperty('--bg-chat','#dce3e9');
    document.documentElement.style.setProperty('--bg-message-out','#effdde');
    document.documentElement.style.setProperty('--bg-message-in','#ffffff');
    document.documentElement.style.setProperty('--text-primary','#111');
    document.documentElement.style.setProperty('--text-secondary','#555');
    document.documentElement.style.setProperty('--text-muted','#888');
    toggle.classList.add('light');
    thumb.textContent='☀️';
  }
}

// ===================== TOAST =====================
function toast(msg){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e2d3d;color:#d1d5db;padding:8px 18px;border-radius:20px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.4);white-space:nowrap;animation:notifSlide 0.3s ease;`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(()=>t.remove(),300);},2500);
}

// ===================== CLOSE MENUS ON CLICK =====================
document.addEventListener('click',function(e){
  if(!e.target.closest('#context-menu')&&!e.target.closest('.msg-bubble')) closeContextMenu();
  if(!e.target.closest('#dots-menu')&&!e.target.closest('.header-btn[onclick*="toggleDotsMenu"]')) closeDotsMenu();
  if(!e.target.closest('#emoji-picker')&&!e.target.closest('#emoji-in-input-btn')) document.getElementById('emoji-picker').classList.remove('show');
  if(!e.target.closest('#attach-menu')&&!e.target.closest('.input-action-btn')) document.getElementById('attach-menu').classList.remove('show');
  if(!e.target.closest('#sticker-panel')&&!e.target.closest('.attach-item')) document.getElementById('sticker-panel').classList.remove('show');
});

// ===================== RESPONSIVE =====================
function backToList(){
  document.getElementById('sidebar').classList.remove('hide');
  document.getElementById('chat-view').style.display='none';
}

// ===================== SIMULATE BACKGROUND MESSAGES =====================
function startBackgroundActivity(){
  setInterval(()=>{
    const ids=Object.keys(chats).filter(id=>parseInt(id)!==currentChatId);
    if(!ids.length) return;
    const id=ids[Math.floor(Math.random()*ids.length)];
    const chat=chats[id];
    if(chat.contact.type==='channel'&&Math.random()<0.7) return;
    const msg={id:Date.now(),text:MSG_TEMPLATES[Math.floor(Math.random()*MSG_TEMPLATES.length)],sender:chat.contact.name,time:now(),status:null,reactions:[],edited:false,forwarded:false,replyTo:null,pinned:false};
    chat.messages.push(msg);
    chat.unread=(chat.unread||0)+1;
    renderChatList(document.getElementById('search-input').value,currentTab);
    if(!chat.muted) showNotification(chat.contact,msg.text);
  },8000+Math.random()*7000);
}

// ===================== INIT =====================
initChats();
renderChatList();
startBackgroundActivity();

// Open first chat by default
openChat(1);
