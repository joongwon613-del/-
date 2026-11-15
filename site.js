const menu=document.querySelector('.menu-toggle'),mobileNav=document.querySelector('#mobile-nav');
function closeMenu(){if(!menu)return;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','전체 메뉴 열기');mobileNav.hidden=true;}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'전체 메뉴 닫기':'전체 메뉴 열기');mobileNav.hidden=!open;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();menu?.focus();}});window.addEventListener('resize',()=>{if(innerWidth>1040)closeMenu();});
if(document.body.dataset.page==='index'&&location.hash){const routes={about:'about.html',farm:'farms.html',products:'products.html',supply:'products.html',shipping:'shipping.html',process:'shipping.html',contact:'contact.html'};const target=routes[location.hash.slice(1)];if(target)location.replace(target);}
