const API_BASE = 'https://coraldep.onrender.com';

async function fetchJSON(path){
  try{
    const res = await fetch(API_BASE + path, {cache: 'no-store'});
    if(!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
}

async function refresh(){
  const healthEl = document.getElementById('health');
  const health = await fetchJSON('/api/health');
  healthEl.textContent = health ? 'Backend: online' : 'Backend: unreachable';

  const fd = await fetchJSON('/api/focus-debt');
  const fdEl = document.getElementById('focus-content');
  if(fd && (fd.completed !== undefined)){
    const planned = fd.planned ?? 0;
    const completed = fd.completed ?? 0;
    const pct = planned > 0 ? Math.round((completed/planned)*100) : 0;
    fdEl.innerHTML = `<div class="big">${pct}%</div><div class="muted">${completed}/${planned} completed</div>`;
  } else {
    fdEl.textContent = 'No data';
  }

  const briefing = await fetchJSON('/api/briefing');
  const list = document.getElementById('signals-list');
  list.innerHTML = '';
  if(briefing && briefing.sources){
    // build a tiny list: show up to 5 recent items across sources (title + source)
    const rows = [];
    Object.entries(briefing.sources).forEach(([k, v]) => {
      try{ const items = (v.rows || []).slice(0,6); items.forEach(it => rows.push({src:k, title: it.summary || it.title || it.text || it.content || JSON.stringify(it).slice(0,80), ts: it.updated_at || it.ts || it.timestamp || it.due_date})); }catch(e){}
    });
    rows.sort((a,b)=> (new Date(b.ts||0)) - (new Date(a.ts||0)));
    rows.slice(0,5).forEach(r=>{
      const li = document.createElement('li');
      li.innerHTML = `<div style="font-weight:600">${escapeHtml(r.title)}</div><div style="font-size:11px;color:#6b6b6b">${r.src}</div>`;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = '<li>No recent items</li>';
  }
}

function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

window.addEventListener('DOMContentLoaded', ()=>{
  refresh();
  setInterval(refresh, 5000);
  document.getElementById('open-briefing').addEventListener('click', ()=>{
    chrome.tabs.create({url: 'http://localhost:5173/?panel=briefing'});
  });
  document.getElementById('open-focus').addEventListener('click', ()=>{
    chrome.tabs.create({url: 'http://localhost:5173/?panel=today'});
  });
});
