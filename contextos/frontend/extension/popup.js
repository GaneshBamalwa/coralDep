const APP_BASE = 'http://localhost:5173/';
const API_BASE = 'https://coraldep.onrender.com';
const API_HEALTH = `${API_BASE}/api/health`;

function openPanel(panel){
  const url = APP_BASE + (panel ? `?panel=${encodeURIComponent(panel)}` : '');
  chrome.tabs.create({ url });
}

async function checkBackend(){
  const el = document.getElementById('status');
  try{
    const res = await fetch(API_HEALTH, {cache: 'no-store'});
    if(res.ok) el.textContent = 'Backend: online';
    else el.textContent = 'Backend: unreachable';
  }catch(e){ el.textContent = 'Backend: unreachable'; }
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.nav button').forEach(b => {
    b.addEventListener('click', (e)=>{
      const panel = e.currentTarget.getAttribute('data-panel');
      openPanel(panel);
    });
  });
  document.getElementById('open-app').addEventListener('click', ()=>openPanel());
  const info = document.getElementById('install-instructions');
  info.href = 'https://developer.chrome.com/docs/extensions/mv3/getstarted/';
  info.textContent = 'Extension install help';
  checkBackend();
});
