const mark = '../desktop/handoff-mark.png';
const brand = `<span class="brand"><img src="${mark}" alt="Handoff logo">Handoff</span>`;
const chrome = '<div class="chrome"><i></i><i></i><i></i><span>Handoff</span></div>';
const header = (extra = '<span class="pill"><i class="dot"></i> On this device</span>') => `${chrome}<div class="appbar">${brand}${extra}</div>`;
const folder = '<i class="folder-glyph" aria-hidden="true"></i>';
const profiles = { Work: 'Google account · work', Personal: 'Google account · personal' };
const assignments = { Studio: 'Work', Research: 'Work', Personal: 'Personal' };
const spaces = [['Studio', 12], ['Research', 8], ['Personal', 6]];
const profileButton = (space, selected, open = false) => `<div class="select-wrap"><button class="profile-select" data-menu="${space}" aria-expanded="${open}" aria-label="Choose Chrome profile for ${space}"><span class="avatar">${selected[0]}</span><span><strong>${selected}</strong><small>${profiles[selected]}</small></span><span class="chevron">⌄</span></button><div class="account-menu" data-options="${space}" ${open ? '' : 'hidden'}><div class="menu-label">Chrome profiles · demo accounts</div>${Object.entries(profiles).map(([name, account]) => `<button class="account-option ${name === selected ? 'chosen' : ''}" data-space="${space}" data-profile="${name}"><span class="avatar">${name[0]}</span><span><strong>${name}</strong><small>${account}</small></span>${name === selected ? '<span class="tick">✓</span>' : ''}</button>`).join('')}<button class="account-option" data-check-account><span class="avatar">↗</span><span><strong>Check account in Chrome</strong><small>Confirm the account in this profile</small></span></button></div></div>`;
const browser = (name, position, tab1, tab2) => `<div class="mini-browser" style="${position}"><div class="browser-toolbar"><span class="browser-tab">${tab1}</span><span class="browser-tab">${tab2}</span><span class="avatar">${name[0]}</span></div><div class="browser-content"><span class="eyebrow">${name} profile</span><h3 style="margin-top:12px">A place for everything.</h3><p>Tabs opened in your chosen Chrome profile.</p><div class="browser-lines"><i></i><i></i><i></i></div></div></div>`;
const frames = [
  {
    title: 'Your work comes with you.', short: 'Intro', time: '00—06',
    caption: 'Spaces and tab cards drift toward the blue mark. The movement settles as the opening line rises into view. Black stays black; the logo carries the color.',
    body: `<div class="orbit two"></div><div class="orbit"></div><div class="connector" style="left:400px;top:350px;width:300px;rotate:15deg"></div><div class="connector" style="left:880px;top:430px;width:260px;rotate:-17deg"></div>
      <div class="float-tag" style="left:196px;top:218px;rotate:-8deg">${folder}Studio <b>12 tabs</b></div><div class="float-tag" style="left:329px;top:407px;rotate:5deg"><span class="favicon">F</span>Design references <span class="small-arrow">↗</span></div><div class="float-tag" style="right:205px;top:216px;rotate:7deg">${folder}Research <b>8 tabs</b></div><div class="float-tag" style="right:223px;top:448px;rotate:-6deg"><span class="favicon">G</span>Personal <b>6 tabs</b></div>
      <img class="intro-logo" src="${mark}" alt="Blue Handoff mark"><h1 class="intro-title">New browser. <span>Same world.</span></h1><p class="intro-sub">Your Spaces, folders and tabs. Ready for what’s next.</p>`,
  },
  {
    title: 'Start with your sidebar.', short: 'Source', time: '06—12',
    caption: 'The mark becomes the compact app header. A sidebar file lands in the source card; counts appear, then Preview sidebar expands the same window.',
    body: `<h1 class="headline">One file.<br><span>Your whole sidebar.</span></h1><p class="subtitle">A small window.<br>A simple place to start.</p><div class="fact-stack"><div class="eyebrow">Ready to bring along</div><div class="fact-row"><b>01</b> Spaces <small>3 found</small></div><div class="fact-row"><b>02</b> Nested folders <small>6 found</small></div><div class="fact-row"><b>03</b> Pinned & Today tabs <small>26 found</small></div></div>
      <div class="window compact-window">${header('<small>Compact view</small>')}<div class="body"><h2>Take your sidebar<br>with you.</h2><div class="source-card"><span class="file-icon">JSON</span><span><strong>StorableSidebar.json</strong><small>Example sidebar · ready to preview</small></span><button class="text-button" data-example>Change</button></div><div class="field"><span class="muted">Spaces</span><span>All 3 Spaces　⌄</span></div><div class="field"><span class="muted">Destination</span><span>Choose a browser　↗</span></div><button class="secondary full" data-goto="3">Preview sidebar <span>↗</span></button><button class="primary full" data-goto="4">Choose destination <span>→</span></button><p class="lockline">⌑　Your sidebar file stays on this device.</p></div></div>`,
  },
  {
    title: 'Keep the familiar structure.', short: 'Library', time: '12—20',
    caption: 'Compact expands into the library. Folder rows unfold in sequence and selected Spaces remain checked. The action follows the selection count.',
    body: `<h1 class="headline center-head">Everything, <span>just where you left it.</span></h1><p class="center-sub">Preview your library. Choose what comes along.</p><div class="window library-window">${header('<button class="secondary" data-goto="2" style="font-size:12px;padding:9px 13px">↙ Compact view</button>')}<div class="filebar">▧　StorableSidebar.json <small>3 Spaces · 6 folders · 26 tabs</small></div><div class="library"><aside class="sidebar"><div class="eyebrow">Your Spaces</div>${spaces.map(([name, count], i) => `<label class="space ${i === 0 ? 'active' : ''}"><input type="checkbox" checked data-count="${count}" aria-label="Include ${name}">${name}<small>${count}</small></label>`).join('')}</aside><div class="files"><h3>Studio</h3><p>12 tabs · 2 folders</p><div class="tree-row">⌄ ${folder} Design references <small>7 tabs</small></div><div class="tree-row indent"><span class="favicon">C</span>Color studies</div><div class="tree-row indent"><span class="favicon">I</span>Interface patterns</div><div class="tree-row indent"><span class="favicon">T</span>Typography notes <small>+ 4 more</small></div><div class="tree-row" style="margin-top:10px">› ${folder} Projects <small>5 tabs</small></div></div></div><div class="appfooter"><span id="selection-count">3 Spaces · 26 tabs selected</span><span class="tiny">Pinned + Today</span><button class="primary" data-goto="4">Choose destination →</button></div></div>`,
  },
  {
    title: 'Choose the right account.', short: 'Accounts', time: '20—30',
    caption: 'Select Chrome, then assign each Space to an existing browser profile. The chooser opens close to the row. “Check account” lets the user confirm which Google account is active in Chrome.',
    body: `<h1 class="headline center-head">Your Spaces. <span>The right accounts.</span></h1><p class="center-sub">Choose the Chrome profile for each Space.</p><div class="window profile-window">${header('<span class="pill">Destination</span>')}<div class="profile-body"><div class="browser-choice"><span>Open in</span>${['Chrome','Brave','Edge'].map((name,i) => `<button class="browser-option ${i === 0 ? 'active' : ''}" ${i ? 'data-other-browser' : 'data-chrome'}><img alt="" src="../naumu/brand/browsers/${name.toLowerCase()}.png">${name}</button>`).join('')}</div><div class="profile-table-head"><span>Arc Space</span><span>Destination profile</span></div>${spaces.map(([name,count],i) => `<div class="profile-row"><span class="space-title"><span class="space-square">${name[0]}</span><span>${name}<small>${count} tabs</small></span></span>${profileButton(name,assignments[name],i === 0)}</div>`).join('')}<p class="account-note">Uses sessions already in the chosen Chrome profile. Arc login sessions aren’t transferred.</p></div><div class="appfooter"><span class="tiny">One window per Space</span><button class="primary" data-goto="5">Keep folders & continue →</button></div></div><p class="profile-note">Google accounts shown here are illustrative. Confirm the active account in your browser.</p>`,
  },
  {
    title: 'Bring the details along.', short: 'Keep folders', time: '30—38',
    caption: 'Folders fold into a bookmarks file for each destination profile. A short password-import note keeps the promise precise: browser sessions and passwords are separate from the sidebar file.',
    body: `<h1 class="headline">Keep the folders.<br><span>Keep your bearings.</span></h1><p class="subtitle">Save a bookmarks file for each profile.<br>Import it in that browser to keep<br>your nested folders.</p><div class="fact-stack" style="top:490px"><div class="eyebrow">Your handoff includes</div><div class="fact-row"><b>✓</b> Selected Spaces & tabs</div><div class="fact-row"><b>✓</b> Nested bookmark folders</div><div class="fact-row"><b>✓</b> A local copy you control</div></div><div class="window export-window">${header('<span class="pill">Final step</span>')}<div class="body"><h2>A home for your folders.</h2><p class="tiny">Save first. Import into the matching profile.</p><div class="export-row"><span class="avatar">W</span><span><strong>Work bookmarks</strong><small>Studio + Research · 20 tabs</small></span><button class="secondary" data-save="Work">Save HTML ↓</button></div><div class="export-row"><span class="avatar">P</span><span><strong>Personal bookmarks</strong><small>Personal · 6 tabs</small></span><button class="secondary" data-save="Personal">Save HTML ↓</button></div><div class="notice"><strong>What about passwords?</strong>Use Arc’s password export and your destination browser’s import. Handoff doesn’t read or move your passwords.</div><button class="primary full" data-goto="6">Preview opening 26 tabs →</button><p class="lockline">Existing Chrome sessions stay in their profiles.</p></div></div>`,
  },
  {
    title: 'A clean handoff.', short: 'Ready', time: '38—45',
    caption: 'Three windows settle into their chosen profiles. The windows recede; the blue mark and closing line remain. End on a quiet hold for the website loop.',
    body: `<img class="end-mark" src="${mark}" alt="Blue Handoff logo"><h1 class="end-head">Pick up where you left off.</h1><p class="end-sub">Your sidebar, ready for its next chapter.</p>${browser('Work','left:145px;top:459px;rotate:-4deg','Studio · 12 tabs','Design references')}${browser('Work','left:575px;top:438px;z-index:3','Research · 8 tabs','Reading list')}${browser('Personal','left:1005px;top:459px;rotate:4deg','Personal · 6 tabs','Everyday')}<p class="done-badge"><b>26 tabs</b>　·　<b>3 windows</b>　·　<b>2 chosen profiles</b></p>`,
  },
];
document.querySelector('#storyboard').innerHTML = frames.map((frame, i) => `<section class="shot" id="${i+1}" aria-label="Frame ${i+1}: ${frame.title}"><div class="frame-wrap"><div class="frame" data-frame="${i+1}"><div class="frame-label"><b>0${i+1}</b> ${frame.short}</div><div class="frame-time">${frame.time} s</div>${frame.body}<div class="film-brand brand"><img src="${mark}" alt="">Handoff</div><div class="scene-foot">FILM CONCEPT / SAMPLE DATA</div></div></div><div class="caption"><strong>0${i+1} — ${frame.title}</strong><p>${frame.caption}</p><span class="duration">${frame.time}s</span></div></section>`).join('');
document.querySelector('.timeline').innerHTML = frames.map((frame,i) => `<a href="#${i+1}" data-goto="${i+1}">${i+1} <span>${frame.short}</span></a>`).join('');
const resize = () => document.querySelectorAll('.frame-wrap').forEach(wrap => { wrap.firstElementChild.style.transform = `scale(${wrap.clientWidth / 1600})`; });
new ResizeObserver(resize).observe(document.querySelector('main'));
resize();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function goto(id) { const shot = document.getElementById(id); shot.scrollIntoView({behavior: reduced ? 'instant' : 'smooth', block:'start'}); history.replaceState(null,'',`#${id}`); }
let toastTimer;
function toast(message) { const el = document.querySelector('.toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 6000); }
document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-goto]');
  if (nav) { event.preventDefault(); goto(nav.dataset.goto); }
  const chooser = event.target.closest('[data-menu]');
  if (chooser) { const menu = chooser.nextElementSibling; menu.hidden = !menu.hidden; chooser.setAttribute('aria-expanded',String(!menu.hidden)); }
  const option = event.target.closest('[data-profile]');
  if (option) {
    assignments[option.dataset.space] = option.dataset.profile;
    option.closest('.select-wrap').outerHTML = profileButton(option.dataset.space,option.dataset.profile);
    updateAssignments();
  }
  if (event.target.closest('[data-check-account]')) toast('Storyboard preview: the desktop app opens an empty Chrome window in this profile so you can confirm its account.');
  if (event.target.closest('[data-example]')) toast('These frames use an example sidebar. Real file import is available in the existing Handoff prototype.');
  if (event.target.closest('[data-other-browser]')) toast('This storyboard follows Chrome. The desktop app also supports profile selection for Brave, Edge and Vivaldi.');
  const save = event.target.closest('[data-save]');
  if (save) toast(`Storyboard preview: save a bookmarks HTML file for the ${save.dataset.save} profile, then import it in that profile.`);
});
function updateAssignments() {
  const rows = Object.keys(profiles).map(profile => {
    const included = spaces.filter(([name]) => assignments[name] === profile);
    if (!included.length) return '';
    return `<div class="export-row"><span class="avatar">${profile[0]}</span><span><strong>${profile} bookmarks</strong><small>${included.map(([name]) => name).join(' + ')} · ${included.reduce((n,[,count])=>n+count,0)} tabs</small></span><button class="secondary" data-save="${profile}">Save HTML ↓</button></div>`;
  }).join('');
  document.querySelectorAll('.export-row').forEach(row=>row.remove());
  document.querySelector('.export-window .notice').insertAdjacentHTML('beforebegin',rows);
  document.querySelectorAll('.mini-browser').forEach((window,i) => { const name = assignments[spaces[i][0]]; window.querySelector('.eyebrow').textContent = `${name} profile`; window.querySelector('.avatar').textContent = name[0]; });
  document.querySelector('.done-badge').innerHTML = `<b>26 tabs</b>　·　<b>3 windows</b>　·　<b>${new Set(Object.values(assignments)).size} chosen profiles</b>`;
}
document.querySelectorAll('[data-count]').forEach(input=>input.addEventListener('change',()=>{
  const selected=[...document.querySelectorAll('[data-count]:checked')];
  document.querySelector('#selection-count').textContent=`${selected.length} Spaces · ${selected.reduce((n,input)=>n+Number(input.dataset.count),0)} tabs selected`;
  document.querySelector('.library-window .appfooter .primary').disabled = selected.length === 0;
  toast('Selection preview updated. The six film frames use the full 26-tab example for continuity.');
}));
const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting) {
    const id=entry.target.id;
    entry.target.querySelector('.frame').classList.add('animate');
    document.querySelectorAll('.timeline a').forEach(a=>a.classList.toggle('active',a.dataset.goto===id));
  }
}),{threshold:.45});
document.querySelectorAll('.shot').forEach(shot=>observer.observe(shot));
let playing=false,timer;
document.querySelector('#play').addEventListener('click',()=>{
  clearTimeout(timer);playing=!playing;
  document.querySelector('#play').textContent=playing?'Stop sequence':'Play sequence';
  if(!playing)return;
  let id=1;const advance=()=>{goto(String(id));if(id++<6)timer=setTimeout(advance,5000);else timer=setTimeout(()=>{playing=false;document.querySelector('#play').textContent='Play sequence';},5000);};advance();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelectorAll('.account-menu').forEach(menu=>{menu.hidden=true;menu.previousElementSibling.setAttribute('aria-expanded','false');});}});
if (/^#[1-6]$/.test(location.hash)) requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
