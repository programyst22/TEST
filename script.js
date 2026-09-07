const qs=(s,c=document)=>c.querySelector(s),qsa=(s,c=document)=>[...c.querySelectorAll(s)];
qsa('.words').forEach(el=>{const nodes=el.innerHTML.split(/(<br\s*\/?\s*>|\s+)/);el.innerHTML=nodes.map(x=>/^<br/i.test(x)?x:/^\s+$/.test(x)?x:`<span class="word">${x}</span>`).join('')});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');if(e.target.classList.contains('words'))qsa('.word',e.target).forEach((w,i)=>setTimeout(()=>w.classList.add('in'),i*70));io.unobserve(e.target)}}),{threshold:.14});qsa('.reveal,.words').forEach(x=>io.observe(x));
const hv=qs('#heroVideo'),hc=qs('.heroContent');addEventListener('scroll',()=>{const y=Math.min(scrollY/(innerHeight*.8),1);hv.style.transform='none';hv.style.filter=`brightness(${1-y*.18})`;hc.style.transform=`translateY(${-y*60}px)`;hc.style.opacity=1-y*.72},{passive:true});
qsa('.featureItem').forEach((item, index) => {
  const button = qs('button', item), answer = qs('.featureAnswer', item);
  answer.id = 'feature-answer-' + index;
  button.setAttribute('aria-controls', answer.id);
  button.setAttribute('aria-expanded', String(item.classList.contains('open')));
  answer.setAttribute('aria-hidden', String(!item.classList.contains('open')));
  button.addEventListener('click', () => {
    qsa('.featureItem').forEach(other => {
      const selected = other === item;
      other.classList.toggle('open', selected);
      qs('button', other).setAttribute('aria-expanded', String(selected));
      qs('.featureAnswer', other).setAttribute('aria-hidden', String(!selected));
    });
    const im = qs('#featureImage');
    im.onload = () => { im.style.opacity = '1'; };
    im.onerror = () => { im.style.opacity = '1'; };
    im.alt = item.dataset.alt;
    im.src = item.dataset.img;
  });
});
qsa('.faqItem').forEach(item=>item.querySelector('button').addEventListener('click',()=>{const was=item.classList.contains('open');qsa('.faqItem').forEach(x=>x.classList.remove('open'));if(!was)item.classList.add('open')}));
// Pause other project videos when a new clip starts.
qsa('.projectVideo video').forEach(video => {
  video.addEventListener('play', () => {
    qsa('.projectVideo video').forEach(other => { if (other !== video) other.pause(); });
  });
});
// Keep navigation usable on touch devices.
const menuButton=qs('.menu'), mainNavigation=qs('#mainNavigation');
function closeMenu(){mainNavigation.classList.remove('open');menuButton.setAttribute('aria-expanded','false');}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));mainNavigation.classList.toggle('open',open);});
qsa('a',mainNavigation).forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
// Fetch project videos only after a deliberate click. Keep original sound available.
qsa('.videoStart').forEach(button => {
  const video = button.previousElementSibling;
  video.controls = false;
  function sync() {
    const playing = !video.paused && !video.ended;
    button.classList.toggle('isPlaying', playing);
    button.setAttribute('aria-label', playing ? 'Video pausieren' : 'Video abspielen');
    button.setAttribute('aria-pressed', String(playing));
    button.disabled = false;
  }
  button.addEventListener('click', async () => {
    if (!video.paused && !video.ended) { video.pause(); return; }
    button.disabled = true;
    try { if (video.error) video.load(); await video.play(); }
    catch { sync(); button.setAttribute('aria-label', 'Video erneut abspielen'); }
  });
  ['play','playing','pause','ended','error'].forEach(event => video.addEventListener(event, sync));
  sync();
});
const viewer=qs('#photoViewer');let lastPhotoLink;
qsa('[data-gallery]').forEach(link=>link.addEventListener('click',e=>{if(!viewer.showModal)return;e.preventDefault();lastPhotoLink=link;const source=qs('img',link);qs('img',viewer).src=link.href;qs('img',viewer).alt=source.alt;qs('p',viewer).textContent=source.alt;viewer.showModal();}));
qs('.viewerClose',viewer).addEventListener('click',()=>viewer.close());viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});viewer.addEventListener('close',()=>lastPhotoLink?.focus());
