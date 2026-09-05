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
// Native video controls handle playback, seeking and keyboard input.
qsa('.projectVideo video').forEach(video => {
  video.addEventListener('play', () => {
    qsa('.projectVideo video').forEach(other => { if (other !== video) other.pause(); });
  });
});
