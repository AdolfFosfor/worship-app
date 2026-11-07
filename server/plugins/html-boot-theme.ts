/**
 * Paints html/body with Telegram theme colors before Nuxt/Vite CSS and JS load,
 * and shows a lightweight splash loader until the Vue app mounts.
 */
const LIGHT_BG = '#efeff4'
const DARK_BG = '#0f0f0f'
const LIGHT_INK = '#000000'
const DARK_INK = '#ffffff'
const ACCENT = '#3390ec'

const BOOT_STYLE = `
html,body,#__nuxt{
  margin:0;
  min-height:100%;
  height:100%;
  background-color:var(--tg-theme-secondary-bg-color,${LIGHT_BG});
  color:var(--tg-theme-text-color,${LIGHT_INK});
}
@media (prefers-color-scheme: dark){
  html,body,#__nuxt{
    background-color:var(--tg-theme-secondary-bg-color,${DARK_BG});
    color:var(--tg-theme-text-color,${DARK_INK});
  }
}
#app-boot-splash{
  position:fixed;
  inset:0;
  z-index:99999;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:0;
  background:var(--tg-theme-secondary-bg-color,${LIGHT_BG});
  transition:opacity .28s ease,visibility .28s ease;
}
#app-boot-splash.app-boot-splash--done{
  opacity:0;
  visibility:hidden;
  pointer-events:none;
}
.app-boot-splash__spinner{
  box-sizing:border-box;
  width:2.25rem;
  height:2.25rem;
  border:4px solid var(--tg-theme-hint-color,#8e8e93);
  border-top-color:var(--tg-theme-button-color,${ACCENT});
  border-radius:50%;
  opacity:0.9;
  animation:app-boot-spin .65s linear infinite;
}
@media (prefers-reduced-motion:reduce){
  .app-boot-splash__spinner{animation:none;border-top-color:var(--tg-theme-button-color,${ACCENT});opacity:0.55;}
}
@keyframes app-boot-spin{to{transform:rotate(360deg);}}
`.replace(/\s+/g, ' ').trim()

const BOOT_SPLASH = `<div id="app-boot-splash" role="status" aria-label="Загрузка" aria-busy="true"><div class="app-boot-splash__spinner" aria-hidden="true"></div></div>`

/** Runs synchronously in <head> — applies Telegram themeParams ASAP. */
const BOOT_SCRIPT = `(function(){
  var LIGHT_BG=${JSON.stringify(LIGHT_BG)};
  var DARK_BG=${JSON.stringify(DARK_BG)};
  var LIGHT_INK=${JSON.stringify(LIGHT_INK)};
  var DARK_INK=${JSON.stringify(DARK_INK)};

  function toHex(value){
    if(value==null)return '';
    if(typeof value==='number'&&isFinite(value)){
      return '#'+((value&0xffffff).toString(16).padStart(6,'0'));
    }
    var s=String(value).trim();
    if(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s))return s;
    if(/^[0-9a-f]{6}$/i.test(s))return '#'+s;
    return s;
  }

  function isDarkHex(hex){
    hex=toHex(hex);
    if(!hex||hex.charAt(0)!=='#')return false;
    var h=hex.slice(1);
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(h.length===8)h=h.slice(0,6);
    var n=parseInt(h,16);if(isNaN(n))return false;
    var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return (r*299+g*587+b*114)/1000<128;
  }

  /** Same strip as @tma.js/bridge retrieveRawLaunchParams. */
  function stripLaunch(url){
    return String(url).replace(/^[^?#]*[?#]/,'').replace(/[?#]/g,'&');
  }

  function readThemeFromQuery(raw){
    if(!raw)return null;
    try{
      var q=new URLSearchParams(stripLaunch(raw));
      var encoded=q.get('tgWebAppThemeParams');
      if(!encoded)return null;
      var theme=JSON.parse(encoded);
      return theme&&typeof theme==='object'?theme:null;
    }catch(e){return null;}
  }

  function readLaunchTheme(){
    var sources=[];
    try{sources.push(location.href);}catch(e){}
    try{
      var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
      if(nav&&nav.name)sources.push(nav.name);
    }catch(e){}
    try{
      var stored=sessionStorage.getItem('tapps/launchParams');
      if(stored){
        try{sources.push(JSON.parse(stored));}
        catch(e){sources.push(stored);}
      }
    }catch(e){}

    for(var i=0;i<sources.length;i++){
      var theme=readThemeFromQuery(sources[i]);
      if(theme)return theme;
    }

    try{
      var tp=window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.themeParams;
      if(tp&&typeof tp==='object'&&(tp.bg_color||tp.secondary_bg_color))return tp;
    }catch(e){}

    return null;
  }

  function paint(theme){
    var root=document.documentElement;
    var keys=theme?Object.keys(theme):[];
    for(var i=0;i<keys.length;i++){
      var key=keys[i];
      var hex=toHex(theme[key]);
      if(!hex)continue;
      root.style.setProperty('--tg-theme-'+key.replace(/_/g,'-'),hex);
    }

    var bg=toHex(theme&&(theme.secondary_bg_color||theme.bg_color))||'';
    var surface=toHex(theme&&(theme.bg_color||theme.section_bg_color))||'';
    var ink=toHex(theme&&theme.text_color)||'';
    var isDark=theme?isDarkHex(theme.bg_color||theme.secondary_bg_color||bg):false;

    if(!bg){
      isDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
      bg=isDark?DARK_BG:LIGHT_BG;
      ink=isDark?DARK_INK:LIGHT_INK;
      surface=bg;
      root.style.setProperty('--tg-theme-secondary-bg-color',bg);
      root.style.setProperty('--tg-theme-bg-color',surface);
      root.style.setProperty('--tg-theme-text-color',ink);
    }else if(!ink){
      ink=isDark?DARK_INK:LIGHT_INK;
      root.style.setProperty('--tg-theme-text-color',ink);
    }

    root.style.backgroundColor=bg;
    root.style.color=ink;
    root.style.colorScheme=isDark?'dark':'light';
    root.classList.toggle('app-dark',!!isDark);

    var metas=document.querySelectorAll('meta[name="theme-color"]');
    for(var m=0;m<metas.length;m++)metas[m].setAttribute('content',bg);

    if(document.body){
      document.body.style.backgroundColor=bg;
      document.body.style.color=ink;
    }
  }

  paint(readLaunchTheme());
})();`

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head.unshift(
      `<meta name="theme-color" content="${LIGHT_BG}">`,
      `<meta name="color-scheme" content="light dark">`,
      `<style id="boot-theme">${BOOT_STYLE}</style>`,
      `<script id="boot-theme-script">${BOOT_SCRIPT}</script>`,
    )
    html.bodyAppend.push(BOOT_SPLASH)
  })
})
