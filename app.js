// =======================================================
// HOOLIGANS TMA - CORE JAVASCRIPT (APP.JS)
// Mengatur seluruh logika UI, Interaksi API, dan State
// =======================================================

const API_BASE_URL = "https://stony-repacking-occupant.ngrok-free.dev";

// --- 1. UTILITIES & MODALS ---
function openModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('hidden'); 
        setTimeout(() => el.classList.add('open'), 10); 
    }
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('open'); 
        setTimeout(() => el.classList.add('hidden'), 300); 
    }
}

// --- 2. TELEGRAM WEB APP INIT & GLOBAL STATE ---
const tg = window.Telegram.WebApp; 
tg.expand(); 
const tgUser = tg.initDataUnsafe?.user?.id || null;
const urlParams = new URLSearchParams(window.location.search);
const botUsername = urlParams.get('b') || "MabarMoleBot";

let activeTopupCategory = 'game', allProductsCache = [];
let selGameSku = null, selGamePrc = 0, selGameNm = "", valGameNick = null;
let selSosSku = null, selSosPrc = 0, selSosNm = "", selSosMin = 0;
let activeMabarCategory = 'buat', activePesanCategory = 'cs', activeEsportsCategory = 'squad';
let marqueeTexts = [], currentMarqueeIndex = 0, vipMinPrice = 5000; 
let activeVipTarget = null, chatPollInterval = null, hostPollInterval = null;
let currentActiveRoomInfo = null, mySquadId = null, activeTournamentId = null;
let currentUniqueCode = Math.floor(Math.random() * 900) + 100; 
let adminTourClicks = 0; // Rahasia Owner

const roleMapEmoji = {
    'Jungle': '5253598619168181708', 'Roam': '5253882263103378963', 'Mid': '5253873531434864913',
    'Gold': '5253696437048350963', 'Exp': '5253799546328226827'
};

// =======================================================
// NGROK MEDIA INTERCEPTOR (BYPASS ANTI-PHISHING NGROK)
// Secara otomatis mengubah request <img src="ngrok..."> menjadi Fetch Blob
// =======================================================
const processNgrokMedia = async (el) => {
    const src = el.getAttribute('src');
    if (src && src.startsWith(API_BASE_URL) && !el.dataset.ngrokProcessed) {
        el.dataset.ngrokProcessed = "true"; // Tandai agar tidak loop
        
        try {
            const res = await fetch(src, { 
                headers: { 'ngrok-skip-browser-warning': 'true', 'Authorization': tg.initData || '' } 
            });
            if (res.ok) {
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                if (el.tagName === 'LOTTIE-PLAYER') el.setAttribute('src', objectUrl);
                else el.src = objectUrl;
            } else {
                if (el.tagName === 'IMG') el.src = 'template_default.png'; // Fallback
            }
        } catch (e) {
            if (el.tagName === 'IMG') el.src = 'template_default.png';
        }
    }
};

const mediaObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Jika itu sebuah Element
                    if (['IMG', 'VIDEO', 'LOTTIE-PLAYER'].includes(node.tagName)) processNgrokMedia(node);
                    if (node.querySelectorAll) node.querySelectorAll('img, video, lottie-player').forEach(processNgrokMedia);
                }
            });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
            processNgrokMedia(mutation.target);
        }
    });
});

mediaObserver.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src']
});
// =======================================================

window.onload = async () => {
    if (!['android', 'android_x', 'ios'].includes(tg.platform) && tg.platform !== "unknown") {
        return document.getElementById('mobileOnlyOverlay').classList.remove('hidden');
    }
    
    // Jalankan observer untuk image yang sudah ada di HTML sejak awal
    document.querySelectorAll('img, video, lottie-player').forEach(processNgrokMedia);

    if (tgUser) {
        await Promise.all([
            loadAppearance().catch(e=>console.error(e)), 
            loadUserData().catch(e=>console.error(e)), 
            checkActiveRoomState().catch(e=>console.error(e)), 
            loadLeaderboard().catch(e=>console.error(e)), 
            loadPricelist().catch(e=>console.error(e)),
            pollNotifBadge()
        ]);
        const splash = document.getElementById('splashScreen'); 
        splash.style.opacity = '0'; 
        setTimeout(()=>splash.classList.add('hidden'), 500);
    } else { 
        document.getElementById('profNick').innerText = "Buka via Telegram"; 
        document.getElementById('splashScreen').classList.add('hidden'); 
    }
};

// --- 3. RENDER MEDIA & TAMPILAN DINAMIS ---
const renderMediaTag = (url, cls) => {
    if (!url) return '';
    const lowerUrl = url.split('?')[0].toLowerCase();
    const inlineStyle = 'background:transparent; display:inline-block; vertical-align:middle; max-width:100%; max-height:100%; pointer-events:none;';
    if (lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mp4')) return `<video autoplay loop muted playsinline src="${url}" class="${cls}" style="${inlineStyle} object-fit:contain;"></video>`;
    else if (lowerUrl.endsWith('.json') || lowerUrl.endsWith('.tgs')) return `<lottie-player autoplay loop mode="normal" src="${url}" class="${cls}" style="${inlineStyle}"></lottie-player>`;
    else return `<img src="${url}" class="${cls}" loading="lazy" style="${inlineStyle} object-fit:contain;" onerror="this.onerror=null;this.src='template_default.png';">`;
};

// TELAH DI UPDATE: Mendukung file asset relative/lokal dari Github
const setImgIcon = (id, url, cls) => { 
    const el = document.getElementById(id); 
    if(el && url) {
        const finalUrl = url.startsWith('/api/') ? API_BASE_URL + url : url;
        el.innerHTML = renderMediaTag(finalUrl, cls); 
    }
};
const setSlotIcon = (id, url, cls) => { 
    const el = document.getElementById(id); 
    if(el) { 
        if(url) {
            const finalUrl = url.startsWith('/api/') ? API_BASE_URL + url : url;
            el.innerHTML = renderMediaTag(finalUrl, cls); 
        }
        else el.innerHTML = ''; 
    }
};

async function loadAppearance() {
    try {
        const res = await fetch(API_BASE_URL + '/api/get_appearance', { headers: {'Authorization': tg.initData||'', 'ngrok-skip-browser-warning': 'true'} });
        if (res.ok) {
            const d = await res.json();
            if(d.marquee_text) { 
                marqueeTexts = d.marquee_text.split(',').map(t => t.trim()).filter(t => t.length > 0); 
                if(marqueeTexts.length > 0) document.getElementById('marqueeText').innerText = marqueeTexts[0]; 
            }
            if(d.vip_price) { 
                vipMinPrice = parseInt(d.vip_price); 
                document.getElementById('donAmount').placeholder = `Min Rp ${vipMinPrice.toLocaleString('id-ID')}`; 
            }
            
            setSlotIcon('slot1', d.icon_slot_1, 'w-6 h-6 object-contain'); 
            setSlotIcon('slot2', d.icon_slot_2, 'w-5 h-5 object-contain'); 
            setSlotIcon('slot5', d.icon_slot_5, 'w-6 h-6 object-contain drop-shadow-md');
            
            setImgIcon('splashIconCont', d.logo_url, 'w-28 h-28 object-cover rounded-full border-2 border-theme shadow-[0_0_25px_var(--fire-pri)]'); 
            setImgIcon('headerIconCont', d.logo_url, 'w-full h-full object-cover');
            
            setImgIcon('icon-profile', d.icon_profile, 'w-3 h-3 object-contain -mt-0.5'); 
            setImgIcon('icon-mabar', d.icon_mabar, 'w-3 h-3 object-contain -mt-0.5'); 
            setImgIcon('icon-toko', d.icon_toko, 'w-3 h-3 object-contain -mt-0.5'); 
            setImgIcon('icon-rank', d.icon_rank, 'w-3 h-3 object-contain -mt-0.5');
            setImgIcon('icon-saldo', d.icon_saldo, 'w-4 h-4 object-contain -mt-1'); 
            setImgIcon('icon-donate', d.icon_donate, 'w-4 h-4 object-contain -mt-1'); 
            setImgIcon('icon-history', d.icon_history, 'w-4 h-4 object-contain -mt-1'); 
            setImgIcon('icon-edit-profil', d.icon_edit_profil, 'w-3.5 h-3.5 object-contain -mt-1'); 
            setImgIcon('icon-sync-ktp', d.icon_sync_ktp, 'w-3.5 h-3.5 object-contain -mt-1');
            setImgIcon('icon-refresh-saldo', d.icon_refresh, 'w-3.5 h-3.5 object-contain'); 
            setImgIcon('icon-refresh-game', d.icon_refresh, 'w-3.5 h-3.5 object-contain'); 
            setImgIcon('icon-refresh-sosmed', d.icon_refresh, 'w-3.5 h-3.5 object-contain'); 
            setImgIcon('icon-refresh-rank-modal', d.icon_refresh, 'w-3 h-3 object-contain -mt-0.5');
            setImgIcon('icon-cat-game', d.icon_cat_game, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-cat-sosmed', d.icon_cat_sosmed, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-data-akun', d.icon_data_akun, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-pilih-nominal', d.icon_pilih_nominal, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-layanan-sosmed', d.icon_layanan_sosmed, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-warning', d.icon_warning, 'w-4 h-4 object-contain -mt-0.5'); 
            setImgIcon('icon-warning-depo', d.icon_warning, 'w-4 h-4 object-contain -mt-0.5');
            
            if (d.bg_frame_saldo && d.bg_frame_saldo.startsWith('http')) { 
                document.getElementById('bg-img-saldo').style.backgroundImage = `url('${d.bg_frame_saldo}')`; 
                document.getElementById('bg-img-saldo').classList.remove('hidden'); 
                document.getElementById('bg-overlay-saldo').classList.remove('hidden'); 
            }
            if (d.bg_frame_profil && d.bg_frame_profil.startsWith('http')) { 
                document.getElementById('bg-img-profil').style.backgroundImage = `url('${d.bg_frame_profil}')`; 
                document.getElementById('bg-img-profil').classList.remove('hidden'); 
                document.getElementById('bg-overlay-profil').classList.remove('hidden'); 
            }
        }
    } catch(e){}
}

document.getElementById('marqueeText').addEventListener('animationiteration', () => {
    if (marqueeTexts && marqueeTexts.length > 1) { 
        currentMarqueeIndex = (currentMarqueeIndex + 1) % marqueeTexts.length; 
        document.getElementById('marqueeText').innerText = marqueeTexts[currentMarqueeIndex]; 
    }
});

// --- 4. NAVIGASI TAB MENU ---
function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active')); 
    document.getElementById(id).classList.add('active');
    
    ['profile','mabar','esports','topup','pesan'].forEach(b => {
        const btn = document.getElementById('btn-'+b);
        if(btn) btn.className="flex-1 py-2.5 rounded-xl font-bold transition-all duration-300 tab-btn-inactive text-[10px] sm:text-[11px] border";
    });
    const activeBtn = document.getElementById('btn-'+id);
    if(activeBtn) activeBtn.className="flex-1 py-2.5 rounded-xl font-bold transition-all duration-300 tab-btn-active text-[10px] sm:text-[11px] border"; 
    
    valBtn();
    if(id === 'mabar') setMabarCat(activeMabarCategory); 
    if(id === 'pesan') setPesanCat(activePesanCategory); 
    if(id === 'esports') setEsportsCat(activeEsportsCategory);
    
    if(id !== 'mabar' && id !== 'pesan' && id !== 'esports') clearInterval(chatPollInterval); 
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

function setMabarCat(cat) {
    activeMabarCategory = cat;
    ['buat','aktif','chat','vip','rating'].forEach(c=>{
        const btn = document.getElementById('btnCatMabar'+c.charAt(0).toUpperCase()+c.slice(1));
        if(btn) btn.className="flex-1 min-w-[55px] py-2.5 rounded-lg text-theme-sub bg-transparent text-[11px] font-bold transition border border-transparent px-1";
        const sec = document.getElementById('mabar-'+c);
        if(sec) {
            sec.classList.add('hidden');
            if(c === 'chat') sec.classList.remove('flex');
        }
    });
    
    const actBtn = document.getElementById('btnCatMabar'+cat.charAt(0).toUpperCase()+cat.slice(1));
    if(actBtn) actBtn.className="flex-1 min-w-[55px] py-2.5 rounded-lg bg-[var(--border-dark)] text-white text-[11px] font-bold transition border border-[var(--fire-pri)] shadow-[0_0_10px_var(--border-light)] px-1";
    const actSec = document.getElementById('mabar-'+cat);
    if(actSec) {
        actSec.classList.remove('hidden');
        if(cat === 'chat') actSec.classList.add('flex');
    }
    
    if(cat === 'aktif') loadRooms();
    if(cat === 'vip') loadVipPlayers();
    if(cat === 'rating') loadPendingRatings();
    if(cat === 'chat') { loadRoomChat(true); startChatPolling('room'); } 
    else if(activePesanCategory !== 'cs' && activePesanCategory !== 'vip' && activeEsportsCategory !== 'squad') clearInterval(chatPollInterval);
}

function setPesanCat(cat) {
    activePesanCategory = cat;
    ['cs','vip'].forEach(c => {
        const btn = document.getElementById('btnCatPesan'+c.charAt(0).toUpperCase()+c.slice(1));
        if(btn) btn.className="flex-1 py-2 rounded-lg text-theme-sub bg-transparent text-[11px] font-bold transition border border-transparent whitespace-nowrap px-3";
        const sec = document.getElementById('pesan-'+c);
        if(sec) { sec.classList.add('hidden'); sec.classList.remove('flex'); }
    });
    
    const actBtn = document.getElementById('btnCatPesan'+cat.charAt(0).toUpperCase()+cat.slice(1));
    if(actBtn) actBtn.className="flex-1 py-2 rounded-lg bg-[var(--border-dark)] text-white text-[11px] font-bold transition border border-[var(--blue-pri)] shadow-[0_0_10px_var(--blue-glow)] whitespace-nowrap px-3";
    const actSec = document.getElementById('pesan-'+cat);
    if(actSec) { actSec.classList.remove('hidden'); actSec.classList.add('flex'); }
    
    if(cat === 'cs') { loadCsChat(true); startChatPolling('cs'); }
    if(cat === 'vip') { 
        document.getElementById('vipContactList').classList.remove('hidden'); 
        document.getElementById('vipChatInterface').classList.add('hidden'); 
        loadVipContacts(); startChatPolling('vip_chat'); 
    }
}

function setEsportsCat(cat) {
    activeEsportsCategory = cat;
    const bs = document.getElementById('btnCatSquad'), bt = document.getElementById('btnCatTour');
    const secS = document.getElementById('esports-squad'), secT = document.getElementById('esports-tour');
    
    if(cat === 'squad') {
        bs.className = "flex-1 min-w-[70px] py-2.5 rounded-lg bg-[var(--border-dark)] text-white text-[11px] font-bold transition border border-[var(--fire-pri)] shadow-[0_0_10px_var(--border-light)] px-1";
        bt.className = "flex-1 min-w-[70px] py-2.5 rounded-lg text-theme-sub bg-transparent text-[11px] font-bold transition border border-transparent px-1";
        secS.classList.remove('hidden'); secT.classList.add('hidden');
        loadMySquad(); startChatPolling('squad');
    } else {
        bt.className = "flex-1 min-w-[70px] py-2.5 rounded-lg bg-[var(--border-dark)] text-white text-[11px] font-bold transition border border-[var(--fire-pri)] shadow-[0_0_10px_var(--border-light)] px-1";
        bs.className = "flex-1 min-w-[70px] py-2.5 rounded-lg text-theme-sub bg-transparent text-[11px] font-bold transition border border-transparent px-1";
        secT.classList.remove('hidden'); secS.classList.add('hidden');
        loadTournaments();
        if(chatPollInterval) clearInterval(chatPollInterval);
    }
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// --- 5. LOGIKA TOKO (GAME & SOSMED) ---
function setTopupCat(cat) {
    activeTopupCategory = cat; 
    const bg = document.getElementById('btnCatGame'), bs = document.getElementById('btnCatSosmed');
    
    if(cat === 'game'){ 
        document.getElementById('sectionGame').classList.remove('hidden'); 
        document.getElementById('sectionSosmed').classList.add('hidden'); 
        bg.className="flex-1 py-2.5 rounded-lg bg-[var(--border-dark)] text-white text-xs font-bold border border-[var(--fire-pri)] shadow-[0_0_10px_var(--border-light)] flex items-center justify-center gap-1.5"; 
        bs.className="flex-1 py-2.5 rounded-lg text-theme-sub bg-transparent text-xs font-bold border border-transparent flex items-center justify-center gap-1.5"; 
    } else { 
        document.getElementById('sectionGame').classList.add('hidden'); 
        document.getElementById('sectionSosmed').classList.remove('hidden'); 
        bs.className="flex-1 py-2.5 rounded-lg bg-[var(--border-dark)] text-white text-xs font-bold border border-[var(--blue-pri)] shadow-[0_0_10px_var(--blue-glow)] flex items-center justify-center gap-1.5"; 
        bg.className="flex-1 py-2.5 rounded-lg text-theme-sub text-xs font-bold border border-transparent flex items-center justify-center gap-1.5"; 
    }
    resSel(); valBtn();
}

function resSel() { 
    selGameSku=null; valGameNick=null; document.getElementById('gameNicknameResult').classList.add('hidden'); 
    selSosSku=null; document.getElementById('sosmedQty').value=''; document.getElementById('sosmedAgr').checked=false; 
    document.querySelectorAll('.item-card').forEach(c=>c.classList.remove('border-[var(--blue-pri)]','bg-[var(--border-dark)]','shadow-[0_0_15px_var(--blue-glow)]')); 
    document.getElementById('displayPrice').innerText='Rp 0'; 
}

function valBtn() {
    const btn = document.getElementById('tgMainButton'), c = document.getElementById('mainButtonContainer');
    if(!document.getElementById('topup').classList.contains('active')) return c.classList.add('hidden');
    if((activeTopupCategory==='game'&&selGameSku)||(activeTopupCategory==='sosmed'&&selSosSku)) c.classList.remove('hidden'); else c.classList.add('hidden');
    
    btn.disabled=true;
    if(activeTopupCategory==='game'){ 
        if(selGameSku && valGameNick){ btn.disabled=false; btn.innerText="BAYAR SEKARANG"; }
        else if(selGameSku && !valGameNick) btn.innerText="CEK AKUN DULU"; 
    } else { 
        const q=parseInt(document.getElementById('sosmedQty').value)||0, a=document.getElementById('sosmedAgr').checked; 
        if(!selSosSku) btn.innerText="PILIH LAYANAN"; 
        else if(q < selSosMin) btn.innerText=`MIN ORDER ${selSosMin}`; 
        else if(!a) btn.innerText="CENTANG PERSETUJUAN"; 
        else { btn.disabled=false; btn.innerText="PROSES SEKARANG"; } 
    }
}

async function checkGameAccount() {
    const m = document.getElementById('gameSelector').value, u = document.getElementById('gameId').value, z = document.getElementById('gameZone').value;
    const r = document.getElementById('gameNicknameResult'), b = document.getElementById('btnCheckGame');
    if(!u) return tg.showAlert("⚠️ User ID Wajib Diisi!"); 
    if((m==='MLBB'||m==='WHITEOUT')&&!z) return tg.showAlert("⚠️ Zone/Server Wajib Diisi!");
    
    b.innerHTML="⏳ Mengecek..."; b.disabled=true; r.classList.add('hidden');
    try {
        const res = await fetch(`${API_BASE_URL}/api/check_mlbb?mlbb_id=${u}&zone_id=${z||'0'}`,{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        const d = await res.json();
        if(res.ok && d.status==='success'){ 
            valGameNick=d.nickname; 
            r.innerHTML=`✅ <b>${d.nickname.replace(/</g,"&lt;")}</b>`; 
            r.className="text-xs text-center mt-3 p-3 rounded-lg bg-[#002200] border border-green-500 text-green-400 font-bold shadow-inner"; 
        } else { 
            valGameNick=null; r.innerHTML=`❌ ${d.detail||"Tidak Ditemukan"}`; 
            r.className="text-xs text-center mt-3 p-3 rounded-lg bg-[#220000] border border-red-500 text-red-400 font-bold shadow-inner"; 
        }
    }catch(e){ 
        valGameNick="HooligansPlayer"; r.innerHTML=`✅ Bypass: <b>${valGameNick}</b>`; 
        r.className="text-xs text-center mt-3 p-3 rounded-lg bg-[#002200] border border-green-500 text-green-400 font-bold shadow-inner"; 
    }
    r.classList.remove('hidden'); b.innerHTML="🔍 CEK NICKNAME"; b.disabled=false; valBtn();
}

function filterGameItems() {
    const g=document.getElementById('gameSelector').value, r=document.getElementById('regionSelector').value, c=document.getElementById('gameListContainer'); c.innerHTML='';
    let f=allProductsCache.filter(p=>{ if(p.type!=='game'||p.game!==g) return false; if(r==='GLOBAL_INDO') return p.region==='GLOBAL'||p.region==='INDO'; return p.region===r; });
    if(f.length>0) {
        f.forEach(i=>{ 
            const o = i.stock<=0; const bc = o ? "bg-[var(--panel-bg)] opacity-50" : "bg-[var(--panel-bg)] cursor-pointer active:scale-95 transition-all"; 
            c.innerHTML+=`<div class="item-card flex flex-col items-center justify-center border border-theme rounded-xl p-4 ${bc}" ${o?'':`onclick="selG(this,'${i.sku}',${i.price},'${i.name}')"`}><span class="font-bold text-[12px] text-center leading-tight">${i.name}</span><span class="${o?'text-gray-500':'text-glow-red'} text-sm font-bold mt-2">${o?'Habis!':'Rp '+i.price.toLocaleString('id-ID')}</span></div>`; 
        });
    } else c.innerHTML='<div class="text-xs text-theme-sub text-center py-5 col-span-2">Belum tersedia.</div>';
}

function selG(el,s,p,n){ 
    document.querySelectorAll('#gameListContainer .item-card').forEach(c=>c.classList.remove('border-[var(--blue-pri)]','bg-[var(--border-dark)]','shadow-[0_0_15px_var(--blue-glow)]')); 
    el.classList.add('border-[var(--blue-pri)]','bg-[var(--border-dark)]','shadow-[0_0_15px_var(--blue-glow)]'); 
    selGameSku=s; selGamePrc=p; selGameNm=n; 
    document.getElementById('displayPrice').innerText='Rp '+p.toLocaleString('id-ID'); valBtn(); 
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged(); 
}

function filterSosmedItems() {
    const p=document.getElementById('sosmedPlatform').value, c=document.getElementById('sosmedListContainer'); c.innerHTML='';
    let f=allProductsCache.filter(i=>i.type==='sosmed'&&i.platform===p);
    if(f.length>0) {
        f.forEach(i=>{ 
            const o = i.stock<=0; const bc = o ? "bg-[var(--panel-bg)] opacity-50" : "bg-[var(--panel-bg)] cursor-pointer active:scale-95 transition-all"; 
            c.innerHTML+=`<div class="item-card flex justify-between items-center border border-theme rounded-xl p-3.5 ${bc}" ${o?'':`onclick="selS(this,'${i.sku}',${i.price},'${i.name}',${i.min_order})"`}><div><h4 class="font-bold text-[13px]">${i.name}</h4><p class="text-[10px] text-theme-sub">Min: ${i.min_order}</p></div><span class="text-sm text-glow-blue font-bold">Rp ${i.price.toLocaleString('id-ID')}</span></div>`; 
        });
    } else c.innerHTML='<div class="text-xs text-theme-sub text-center py-5">Belum tersedia.</div>'; 
    resSel(); valBtn();
}

function selS(el,s,p,n,m){ 
    document.querySelectorAll('#sosmedListContainer .item-card').forEach(c=>c.classList.remove('border-[var(--blue-pri)]','bg-[var(--border-dark)]','shadow-[0_0_15px_var(--blue-glow)]')); 
    el.classList.add('border-[var(--blue-pri)]','bg-[var(--border-dark)]','shadow-[0_0_15px_var(--blue-glow)]'); 
    selSosSku=s; selSosPrc=p; selSosNm=n; selSosMin=m; 
    document.getElementById('sosmedMinText').innerText=`Min: ${m}`; calcSosmedPrice(); 
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged(); 
}

function calcSosmedPrice() { 
    const q=parseInt(document.getElementById('sosmedQty').value)||0; 
    if(selSosSku) document.getElementById('displayPrice').innerText='Rp '+Math.ceil((selSosPrc/1000)*q).toLocaleString('id-ID'); 
    else document.getElementById('displayPrice').innerText='Rp 0'; 
    valBtn(); 
}

async function refreshPricelistUI() { 
    const ig = document.getElementById('icon-refresh-game'); if(ig) ig.classList.add('spin'); 
    const is = document.getElementById('icon-refresh-sosmed'); if(is) is.classList.add('spin'); 
    await loadPricelist(); 
    setTimeout(() => { if(ig) ig.classList.remove('spin'); if(is) is.classList.remove('spin'); }, 500); 
}

async function loadPricelist() {
    try { 
        const res = await fetch(API_BASE_URL + '/api/get_pricelist',{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}}); 
        if(res.ok) parseP(await res.json()); else useMk(); 
    } catch(e) { useMk(); }
}

function useMk() { 
    parseP([
        {sku:"MLGLOBAL22590-S14",name:"55 Diamonds",price:14500,stock:99},{sku:"MLGLOBAL13-S14",name:"86 Diamonds",price:22145,stock:99},
        {sku:"MLGLOBAL16642-S14",name:"Weekly Diamond Pass",price:27130,stock:99},{sku:"PUBGMINDO60-S14",name:"60 UC (Indo)",price:18000,stock:99},
        {sku:"PUBGMINDO325-S14",name:"325 UC",price:80000,stock:99},{sku:"WS99-S16",name:"99 Frost Star",price:22000,stock:99},
        {sku:"3886",name:"Group Members",price:60000,stock:99},{sku:"3812",name:"Post Views",price:8000,stock:99},
        {sku:"3766",name:"TikTok Likes",price:30000,stock:99},{sku:"3441",name:"TikTok Followers",price:100000,stock:99}
    ]); 
}

function parseP(d) {
    allProductsCache = d.map(i => { 
        let p={...i,type:'game',game:'MLBB',region:'GLOBAL',platform:'',min_order:1}; let s = i.sku.toUpperCase(); 
        if(['3','2','9'].includes(s[0])){ 
            p.type='sosmed'; p.game=''; p.region=''; 
            if(['3886','3812','3955','3956','3949','3948'].includes(s)){ p.platform='TELEGRAM'; p.min_order=s.startsWith('39')?10:1000; }
            else{ p.platform='TIKTOK'; p.min_order=['3441','3655','3539','3154'].includes(s)?100:1000; } 
        } else { 
            if(s.startsWith('MLBR')) p.region='BRAZIL'; else if(s.startsWith('MLSG')) p.region='SINGAPORE'; 
            else if(s.startsWith('MLRU')) p.region='RUSSIA'; else if(s.startsWith('MLPH')) p.region='PHILIPPINES'; 
            else if(s.startsWith('MLMY')) p.region='MALAYSIA'; 
            if(s.startsWith('PUBG')){p.game='PUBG';p.region='INDO';} if(s.startsWith('WS')){p.game='WHITEOUT';p.region='GLOBAL';} 
        } 
        return p; 
    }); 
    filterGameItems(); filterSosmedItems();
}

function processMainCheckout() { activeTopupCategory === 'game' ? pDia() : pSos(); }

async function pDia() {
    document.getElementById('mainButtonContainer').classList.add('hidden'); openModal('txLoadingModal');
    try {
        const res = await fetch(API_BASE_URL + '/api/purchase_diamond', {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body:JSON.stringify({sku: selGameSku, item_name: selGameNm, mlbb_id: document.getElementById('gameId').value, zone_id: document.getElementById('gameZone').value, nickname: valGameNick, price: selGamePrc})
        });
        const d = await res.json(); closeModal('txLoadingModal'); 
        if(res.ok) { shTx(true,selGameNm,d.sn,d.inv_id,d.status); loadUserData(); } 
        else { shTx(false,selGameNm,d.detail,"-","GAGAL"); loadUserData(); }
    } catch(e) { closeModal('txLoadingModal'); shTx(false,selGameNm,"Gangguan Koneksi","-","ERROR"); }
}

async function pSos() {
    const q=parseInt(document.getElementById('sosmedQty').value), l=document.getElementById('sosmedLink').value.trim(); 
    if(!l) return tg.showAlert("Link Wajib!");
    
    document.getElementById('mainButtonContainer').classList.add('hidden'); openModal('txLoadingModal');
    try {
        const res = await fetch(API_BASE_URL + '/api/purchase_sosmed',{
            method:'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body:JSON.stringify({sku: selSosSku, item_name: `[${q}] ${selSosNm}`, target_link: l, quantity: q, price: Math.ceil((selSosPrc/1000)*q)})
        });
        const d = await res.json(); closeModal('txLoadingModal'); 
        if(res.ok) { shTx(true,`[${q}] ${selSosNm}`,d.sn,d.inv_id,d.status); loadUserData(); } 
        else { shTx(false,`[${q}] ${selSosNm}`,d.detail,"-","GAGAL"); loadUserData(); }
    } catch(e) { closeModal('txLoadingModal'); shTx(false,`[${q}] ${selSosNm}`,"Gangguan","-","ERROR"); }
}

function shTx(isSuccess, item, desc, inv, sn) {
    document.getElementById('txResIcon').innerText = isSuccess ? "✅" : "❌";
    document.getElementById('txResIcon').className = isSuccess ? "w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-black border-2 border-green-500 shadow-[0_0_15px_rgba(0,255,0,0.5)]" : "w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-black border-2 border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]";
    document.getElementById('txResTitle').innerText = isSuccess ? "Sukses!" : "Gagal!";
    document.getElementById('txResDesc').innerText = desc; document.getElementById('txItem').innerText = item;
    document.getElementById('txInv').innerText = inv; document.getElementById('txSn').innerText = sn;
    openModal('txResultModal');
}

// --- 6. PROFIL & HISTORY ---
async function refreshSaldo() { 
    const b = document.getElementById('icon-refresh-saldo'); if(b) b.classList.add('spin'); 
    document.getElementById('profSaldo').innerText="..."; await loadUserData(); 
    setTimeout(()=>{ if(b) b.classList.remove('spin'); }, 500); 
}

async function loadUserData() {
    try {
        const res = await fetch(API_BASE_URL + '/api/get_user/me',{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}}); 
        if(res.ok){ 
            const u = await res.json(); 
            document.getElementById('profNick').innerText = u.nickname || "-"; 
            const rawRole = u.role || "-"; const roleEl = document.getElementById('profRole');
            if (roleMapEmoji[rawRole]) { roleEl.innerHTML = renderMediaTag(`${API_BASE_URL}/api/emoji/${roleMapEmoji[rawRole]}`, 'w-8 h-8 object-contain'); } else { roleEl.innerText = rawRole; }
            
            document.getElementById('profHero').innerText = u.hero || "-"; 
            document.getElementById('profBio').innerText = u.bio || "-"; 
            document.getElementById('profDate').innerText = u.reg_date || "-"; 
            
            document.getElementById('profRating').innerText = `${parseFloat(u.rating||5).toFixed(1)}/5.0 ( Dari ${u.total_votes||0} Ulasan )`; 
            document.getElementById('profSaldo').innerText = parseFloat(u.balance||0).toLocaleString('id-ID'); 
            
            if(u.active_card && u.active_card.startsWith('vip_')){ 
                document.getElementById('badgeVip').classList.remove('hidden'); 
                document.getElementById('badgeVip').innerText = `VIP ${u.active_card.split('_')[1].toUpperCase()}`; 
            } else document.getElementById('badgeVip').classList.add('hidden'); 
            
            if(document.getElementById('eNick')) document.getElementById('eNick').value = u.nickname !== "-" ? u.nickname : ""; 
            if(document.getElementById('eHero')) document.getElementById('eHero').value = u.hero !== "-" ? u.hero : ""; 
            if(document.getElementById('eBio')) document.getElementById('eBio').value = u.bio !== "-" ? u.bio : ""; 
            const rm = {"Jungle":"J","Roam":"R","Gold":"G","Exp":"E","Mid":"M"}; 
            if(rm[u.role] && document.getElementById('eRole')) document.getElementById('eRole').value = rm[u.role]; 
            
            if(u.photo_url && u.photo_url.startsWith('http')) { 
                document.getElementById('profEmoji').classList.add('hidden'); 
                document.getElementById('profImg').src = u.photo_url; document.getElementById('profImg').classList.remove('hidden'); 
            } else { 
                document.getElementById('profEmoji').classList.add('hidden'); 
                document.getElementById('profImg').src = `${API_BASE_URL}/api/avatar/${tgUser}`; document.getElementById('profImg').classList.remove('hidden'); 
            } 
            if(document.getElementById('ePhotoUrl')) document.getElementById('ePhotoUrl').value = u.photo_url || ""; 
        }
    }catch(e){}
}

async function refreshLeaderboardUI(btn) { 
    const ic = document.getElementById('icon-refresh-rank-modal'); if(ic) ic.classList.add('spin'); 
    await loadLeaderboard(); setTimeout(() => { if(ic) ic.classList.remove('spin'); }, 500); 
}

async function loadLeaderboard() {
    const dC = document.getElementById('listTopDonators'), rC = document.getElementById('listTopRatings');
    try {
        const res = await fetch(API_BASE_URL + '/api/leaderboard',{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}}); 
        if(res.ok){ 
            const d = await res.json(); dC.innerHTML=''; 
            if(d.donators && d.donators.length>0) {
                d.donators.forEach((u,i)=>{ 
                    dC.innerHTML+=`<div class="flex justify-between items-center bg-black/60 p-3.5 rounded-xl border border-theme"><div class="flex items-center gap-3"><div class="w-6 font-bold text-lg">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><p class="text-sm font-bold truncate">${u.nickname.replace(/</g,"&lt;")}</p></div><span class="text-xs font-bold text-green-400 border border-green-800 bg-green-900/30 px-2 py-1 rounded">Rp ${u.total_donasi.toLocaleString('id-ID')}</span></div>`; 
                });
            } else dC.innerHTML='<p class="text-xs text-center py-4 text-theme-sub">Kosong.</p>'; 
            
            rC.innerHTML=''; 
            if(d.ratings && d.ratings.length>0) {
                d.ratings.forEach((u,i)=>{ 
                    rC.innerHTML+=`<div class="flex justify-between items-center bg-black/60 p-3.5 rounded-xl border border-theme"><div class="flex items-center gap-3"><div class="w-6 font-bold text-lg">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><div><p class="text-sm font-bold truncate">${u.nickname.replace(/</g,"&lt;")}</p><p class="text-[10px] text-theme-sub">${u.total_votes} Vote</p></div></div><span class="text-sm font-bold text-yellow-400">⭐ ${parseFloat(u.rating).toFixed(1)}</span></div>`; 
                }); 
            } else rC.innerHTML='<p class="text-xs text-center py-4 text-theme-sub">Kosong.</p>'; 
        }
    }catch(e){}
}

async function loadHistory() {
    const c = document.getElementById('historyListContainer'); 
    c.innerHTML = '<p class="text-center text-xs py-5">Memuat histori mutasi...</p>';
    openModal('historyModal');
    try {
        const res = await fetch(API_BASE_URL + '/api/get_history', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); c.innerHTML = '';
            if(data.data.length > 0) {
                data.data.forEach(h => {
                    let icon = h.tx_type === 'DEPOSIT' || h.tx_type === 'REFUND' ? 'text-green-500' : 'text-red-500';
                    let statusColor = h.status === 'SUCCESS' ? 'text-green-400' : (h.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400');
                    
                    // FITUR BARU: Tombol Lacak Order untuk status PROCESSING/PENDING
                    let trackBtn = (h.status === 'PROCESSING' || h.status === 'PENDING') 
                        ? `<button onclick="trackOrder('${h.inv_id}')" class="text-[9px] bg-blue-900/50 border border-blue-500 text-blue-300 px-2 py-0.5 rounded shadow-sm active:scale-95 ml-2">LACAK</button>` 
                        : '';
                    
                    c.innerHTML += `<div class="bg-black/60 p-3 rounded-xl border border-theme shadow-inner mb-3"><div class="flex justify-between items-center mb-1"><h4 class="font-bold text-sm ${icon}">${h.item_name}</h4><span class="text-xs font-bold text-white">Rp ${h.total_price.toLocaleString('id-ID')}</span></div><div class="flex justify-between items-center"><p class="text-[10px] text-theme-sub">${h.created_at.substring(0,16)}</p><div class="flex items-center"><p class="text-[10px] font-bold ${statusColor}">${h.status}</p>${trackBtn}</div></div></div>`;
                });
            } else { c.innerHTML = '<p class="text-center text-xs text-theme-sub py-5">Belum ada riwayat transaksi.</p>'; }
        }
    }catch(e){}
}

async function trackOrder(inv_id) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(`${API_BASE_URL}/api/get_history/track/${inv_id}`, { headers: {'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'} });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); loadHistory(); loadUserData(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Kesalahan koneksi."); }
    tg.MainButton.hideProgress();
}

// --- 7. DEPOSIT & DONATE ---
function getBase64(file) {
    return new Promise((resolve, reject) => { 
        const reader = new FileReader(); reader.readAsDataURL(file); 
        reader.onload = () => resolve(reader.result); 
        reader.onerror = error => reject(error); 
    });
}

function generateUniqueCode() {
    const amountInput = document.getElementById('depoAmount').value;
    const container = document.getElementById('depoTotalDisplayContainer');
    const textDisplay = document.getElementById('depoTotalTransferText');
    
    if(!amountInput || parseInt(amountInput) < 10000) {
        container.classList.add('hidden');
        return;
    }
    
    const total = parseInt(amountInput) + currentUniqueCode;
    textDisplay.innerText = 'Rp ' + total.toLocaleString('id-ID');
    container.classList.remove('hidden');
}

function downloadQRIS() {
    try {
        const qrisUrl = new URL('qris_hooligans.png', window.location.href).href;
        tg.openLink(qrisUrl);
    } catch(e) {
        tg.showAlert("Gagal membuka gambar. Silakan screenshot layar HP Anda untuk menyimpan QRIS.");
    }
}

async function submitDeposit() {
    const sender = document.getElementById('depoSenderName').value.trim();
    const baseAmount = document.getElementById('depoAmount').value;
    const method = document.getElementById('depoMethod').value;
    const fileInput = document.getElementById('depoFile');
    
    if(!sender) return tg.showAlert("Nama pengirim transfer wajib diisi!");
    if(!baseAmount || parseInt(baseAmount) < 10000) return tg.showAlert("Minimal Deposit Rp 10.000!");
    if(fileInput.files.length === 0) return tg.showAlert("Bukti transfer WAJIB diupload!");

    const finalAmount = parseInt(baseAmount) + currentUniqueCode;

    const btn = document.getElementById('btnSubmitDepo');
    const originalText = btn.innerText; btn.innerText = "⏳ Memproses..."; btn.disabled = true;
    tg.MainButton.showProgress();

    try {
        let b64Array = [];
        for(let i = 0; i < fileInput.files.length; i++) {
            let b64 = await getBase64(fileInput.files[i]); b64Array.push(b64);
        }

        const res = await fetch(API_BASE_URL + '/api/submit_deposit', {
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body: JSON.stringify({amount: finalAmount, method: method, sender_name: sender, photos_b64: b64Array})
        });
        
        const d = await res.json();
        if(res.ok) {
            tg.showAlert("✅ Bukti Deposit Berhasil Dikirim! Mohon tunggu konfirmasi admin.");
            closeModal('depositModal');
            document.getElementById('depoAmount').value = ''; document.getElementById('depoSenderName').value = '';
            fileInput.value = ''; document.getElementById('depoFileLabel').innerText = 'Pilih File Bukti...';
            document.getElementById('depoFileLabel').classList.remove('text-green-400');
            
            document.getElementById('depoTotalDisplayContainer').classList.add('hidden');
            currentUniqueCode = Math.floor(Math.random() * 900) + 100; // Reset untuk transaksi berikutnya
            
            loadHistory();
        } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Terjadi kesalahan koneksi."); } 
    finally { btn.innerText = originalText; btn.disabled = false; tg.MainButton.hideProgress(); }
}

async function processDonate() {
    const amount = document.getElementById('donAmount').value, msg = document.getElementById('donMsg').value.trim();
    if(!amount || parseInt(amount) < vipMinPrice) return tg.showAlert(`Minimal Donasi Rp ${vipMinPrice.toLocaleString('id-ID')}`);
    
    const btn = document.getElementById('btnSubmitDonasi'); const oTxt = btn.innerText; 
    btn.innerText = "⏳ Memproses..."; btn.disabled = true; tg.MainButton.showProgress();
    
    try {
        const res = await fetch(API_BASE_URL + '/api/process_donation', {
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body: JSON.stringify({amount: parseInt(amount), message: msg || "-"})
        });
        const d = await res.json();
        if(res.ok) { tg.showAlert("Donasi Berhasil! " + d.vip_message); closeModal('donateModal'); loadUserData(); } 
        else tg.showAlert("Gagal: " + d.detail);
    } catch(e){ tg.showAlert("Koneksi gagal."); } 
    finally { btn.innerText = oTxt; btn.disabled = false; tg.MainButton.hideProgress(); }
}

async function saveProfile() {
    const nick = document.getElementById('eNick').value.trim(), hero = document.getElementById('eHero').value.trim(), 
          bio = document.getElementById('eBio').value.trim(), photoUrl = document.getElementById('ePhotoUrl').value.trim(), 
          roleMap = {"J":"Jungle","R":"Roam","G":"Gold","E":"Exp","M":"Mid"}, role = roleMap[document.getElementById('eRole').value];
    if(!nick || !hero || !bio) return tg.showAlert("Harap isi Nickname, Hero, dan Bio!");
    
    const btn = document.getElementById('btnSaveProfile'); const oTxt = btn.innerText; 
    btn.innerText = "⏳..."; btn.disabled = true; tg.MainButton.showProgress();
    
    try {
        const res = await fetch(API_BASE_URL + '/api/update_profile', {
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body: JSON.stringify({nickname: nick, role: role, hero: hero, bio: bio, photo_url: photoUrl})
        });
        if(res.ok) { tg.showAlert("Profil diperbarui!"); closeModal('editProfileModal'); loadUserData(); } 
        else { const d = await res.json(); tg.showAlert(d.detail); }
    } catch(e){} finally { btn.innerText = oTxt; btn.disabled = false; tg.MainButton.hideProgress(); }
}

function syncPhoto() {
    tg.sendData("sync_photo"); tg.showAlert("Proses di background bot Telegram. Silakan refresh (Tutup dan Buka kembali TMA).");
}


// ==========================================
// 8. MABAR ROOMS (CREATE, JOIN, EDIT, CANCEL)
// ==========================================
async function createRoom() {
    if(!tgUser) return; 
    const t=document.getElementById('rType'), r=document.getElementById('rRank'); 
    const rl=Array.from(document.querySelectorAll('.role-checkbox:checked')).map(c=>c.value).join(", "); 
    if(!rl) return tg.showAlert("⚠️ Silakan pilih minimal 1 Role yang dibutuhkan!"); 
    
    const btn = document.getElementById('btnCreateRoom'); const origTxt = btn.innerText; 
    btn.innerText = "⏳ Memproses..."; btn.disabled = true; tg.MainButton.showProgress(); 
    
    try{ 
        const res = await fetch(API_BASE_URL + '/api/create_room',{
            method:'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body:JSON.stringify({host_id:tgUser,room_type:t.options[t.selectedIndex].text,min_rank:r.options[r.selectedIndex].text,needed_roles:rl,mlbb_id:"-",notes:document.getElementById('rNote').value.trim()||"Gas",expire_minutes:parseInt(document.getElementById('rExp').value)})
        }); 
        const d = await res.json(); 
        if(res.ok){ checkActiveRoomState(); } 
        else { 
            if(d.detail && d.detail.toLowerCase().includes("sudah memiliki room")) { 
                checkActiveRoomState(); tg.showAlert("⚠️ Anda ternyata sudah tergabung di room aktif pada Server!"); 
            } else { tg.showAlert("Gagal: " + d.detail); } 
        } 
    } catch(e) { tg.showAlert("Terjadi kesalahan koneksi."); } 
    finally { btn.innerText = origTxt; btn.disabled = false; tg.MainButton.hideProgress(); }
}

async function loadRooms() {
    const c = document.getElementById('listRoomAktif'); 
    c.innerHTML = '<p class="text-center text-xs py-5">Memuat Live Server...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/get_rooms', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); c.innerHTML = '';
            if(data.length > 0) {
                data.forEach(r => {
                    let btnHtml = '';
                    ['Jungle', 'Roam', 'Mid', 'Exp', 'Gold'].forEach(role => {
                        const isNeeded = r.needed_roles.includes(role);
                        const isFilled = r.filled_roles ? r.filled_roles.includes(role) : false;
                        let btnCls = ''; let btnAction = ''; let btnText = `Join ${role.substring(0,4)}`;
                        if (isFilled) { btnCls = 'bg-black/80 border-gray-600 text-gray-500 opacity-50 cursor-not-allowed'; btnAction = 'disabled'; btnText = 'Penuh'; } 
                        else if (isNeeded) { btnCls = 'bg-[var(--border-dark)] border-[var(--fire-pri)] text-white active:scale-95 shadow-sm'; btnAction = `onclick="joinRoomInApp(${r.id}, '${role}', this)"`; } 
                        else { btnCls = 'bg-black/50 border-gray-700 text-gray-700 opacity-30 cursor-not-allowed'; btnAction = 'disabled'; }
                        btnHtml += `<button ${btnAction} class="border py-2 rounded text-[9px] font-bold transition ${btnCls}">${btnText}</button>`;
                    });

                    c.innerHTML += `
                    <div class="glass-panel p-4 rounded-xl border border-theme shadow-inner mb-3">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h4 class="font-bold text-glow-red text-[14px]">${r.room_type}</h4>
                                <p class="text-[10px] text-theme-sub">Min Rank: ${r.min_rank}</p>
                            </div>
                            <span class="animate-pulse text-[10px] bg-[var(--fire-pri)] text-white px-2 py-0.5 rounded-full font-bold border border-red-500 shadow-[0_0_10px_var(--fire-pri)]">LIVE</span>
                        </div>
                        <div class="flex items-center gap-3 mt-3 mb-3 border-t border-b border-theme py-2">
                            <img src="${r.host_photo_url || `${API_BASE_URL}/api/avatar/${r.host_id}`}" class="w-10 h-10 rounded-full border border-theme object-cover shadow-sm" onerror="this.onerror=null;this.src='template_default.png';">
                            <div>
                                <p class="text-[11px] text-gray-300">Host Lobby: <span class="font-bold text-white">${r.host_name}</span></p>
                                <p class="text-[10px] text-yellow-400 font-bold">⭐ ${parseFloat(r.host_rating||5).toFixed(1)}/5.0 ( Dari ${r.total_votes||0} Ulasan )</p>
                            </div>
                        </div>
                        <p class="text-[11px] text-glow-blue font-bold mb-2">Role Dibutuhkan: ${r.needed_roles}</p>
                        <div class="grid grid-cols-5 gap-1 mt-3">${btnHtml}</div>
                    </div>`;
                });
            } else c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada room publik yang aktif.</p>';
        }
    }catch(e){}
}

async function joinRoomInApp(roomId, roleTarget, btnEl) {
    const oTxt = btnEl.innerText; btnEl.innerText = "⏳..."; btnEl.disabled = true;
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/join_room', { 
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, 
            body: JSON.stringify({room_id: roomId, role_target: roleTarget}) 
        });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); checkActiveRoomState(); } 
        else tg.showAlert("Gagal: " + d.detail);
    } catch(e) { tg.showAlert("Terjadi kesalahan jaringan."); }
    btnEl.innerText = oTxt; btnEl.disabled = false;
}

async function checkActiveRoomState() {
    try { 
        const res = await fetch(API_BASE_URL + '/api/mabar/my_room',{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}}); 
        if (res.ok) { 
            const r = await res.json(); 
            if (r.status === 'success' && r.data) { 
                currentActiveRoomInfo = r.data;
                displayActiveRoomPanel(r.data); 
            } else { 
                currentActiveRoomInfo = null;
                displayMabarFormPanel(); 
            } 
        } else { displayMabarFormPanel(); }
    } catch(e) { displayMabarFormPanel(); }
}

function displayActiveRoomPanel(roomInfo) { 
    document.getElementById('mabarFormContainer').classList.add('hidden'); 
    document.getElementById('mabarActiveContainer').classList.remove('hidden'); 
    document.getElementById('actRoomType').innerText = roomInfo.room_type; 
    document.getElementById('actRoomRoles').innerText = roomInfo.needed_roles; 
    
    if(roomInfo.status === 'playing') {
        document.getElementById('hostOnlySection').classList.add('hidden');
        document.getElementById('actRoomStatusText').innerText = "🎮 Mabar Sedang Berjalan. Buka Tab Mabar -> Room Chat.";
        if(hostPollInterval) clearInterval(hostPollInterval);
        return;
    }

    if(roomInfo.is_host) {
        document.getElementById('hostOnlySection').classList.remove('hidden');
        document.getElementById('actRoomStatusText').innerText = "Silakan setujui pelamar di bawah ini. Masuk ke Tab Mabar -> Room Chat untuk janjian ID MLBB.";
        startHostPolling();
    } else {
        document.getElementById('hostOnlySection').classList.add('hidden');
        document.getElementById('actRoomStatusText').innerText = `Anda bergabung sebagai ${roomInfo.my_role}. Masuk ke Tab Mabar -> Room Chat untuk janjian dengan party.`;
        if(hostPollInterval) clearInterval(hostPollInterval);
    }
}

function displayMabarFormPanel() { 
    document.getElementById('mabarFormContainer').classList.remove('hidden'); 
    document.getElementById('mabarActiveContainer').classList.add('hidden'); 
    if(hostPollInterval) clearInterval(hostPollInterval);
}

function openEditRoomModal() {
    if(!currentActiveRoomInfo) return tg.showAlert("Tidak ada data room aktif!");
    document.getElementById('eRoomNote').value = currentActiveRoomInfo.notes || "";
    openModal('editRoomModal');
}

async function submitEditRoom() {
    const roles = Array.from(document.querySelectorAll('.edit-role-checkbox:checked')).map(c=>c.value).join(", "); 
    const rank = document.getElementById('eRoomRank').value;
    const note = document.getElementById('eRoomNote').value.trim();

    if(!roles) return tg.showAlert("Pilih minimal 1 role!");
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/edit_room', { 
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, 
            body: JSON.stringify({ needed_roles: roles, min_rank: rank, notes: note }) 
        });
        if(res.ok) { tg.showAlert("Detail room berhasil diperbarui!"); closeModal('editRoomModal'); checkActiveRoomState(); } 
        else { const d = await res.json(); tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Kesalahan koneksi."); }
    tg.MainButton.hideProgress();
}

async function processCancelRoom() {
    tg.showConfirm('Yakin ingin membatalkan room? Party akan dibubarkan dan tidak perlu rating.', async function(r){
        if(r) {
            tg.MainButton.showProgress();
            try {
                const res = await fetch(API_BASE_URL + '/api/mabar/cancel_room', { method: 'POST', headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'} });
                if(res.ok) { displayMabarFormPanel(); tg.showAlert("Room berhasil dibatalkan."); } 
                else { const d = await res.json(); tg.showAlert("Gagal: " + d.detail); }
            } catch(e) { tg.showAlert("Kesalahan koneksi."); }
            tg.MainButton.hideProgress();
        }
    });
}

async function fetchHostRequests() {
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/host/requests', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if (res.ok) {
            const data = await res.json();
            const c = document.getElementById('hostRequestsContainer');
            const hC = document.getElementById('hostReqCount'); if(hC) hC.innerText = data.data.length;
            
            if (data.data.length === 0) {
                c.innerHTML = '<p class="text-center text-[10px] text-theme-sub py-3">Menunggu pelamar masuk...</p>';
                return;
            }
            
            let htmlStr = '';
            data.data.forEach(req => {
                const targetPhoto = req.photo_url || `${API_BASE_URL}/api/avatar/${req.user_id}`;
                htmlStr += `
                <div class="bg-black/60 border border-theme rounded-xl p-3 shadow-inner">
                    <div class="flex gap-3">
                        <img src="${targetPhoto}" class="w-16 h-16 object-cover rounded-full border-2 border-[var(--blue-pri)] shadow-md" alt="Avatar" onerror="this.onerror=null;this.src='template_default.png';">
                        <div class="flex-1">
                            <h4 class="font-bold text-glow-blue text-sm mb-1">${req.nickname}</h4>
                            <p class="text-[10px] text-yellow-400 font-bold mb-1">⭐ ${parseFloat(req.rating).toFixed(1)}/5.0 ( Dari ${req.total_votes || 0} Ulasan )</p>
                            <p class="text-[10px] text-gray-300">Hero Fav: <b class="truncate block max-w-[120px]">${req.hero}</b></p>
                            <div class="mt-2 bg-blue-900/30 border border-blue-800 p-1.5 rounded text-[10px] text-blue-200 leading-tight">
                                Role Diinginkan: <b>${req.role_target}</b>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="processHostRequest(${req.req_id}, 'accept', this)" class="flex-1 btn-blue py-2 rounded-lg text-xs font-bold shadow-[0_0_10px_var(--blue-glow)]">✅ ACC</button>
                        <button onclick="processHostRequest(${req.req_id}, 'reject', this)" class="flex-1 bg-red-900/50 border border-red-500 text-red-400 py-2 rounded-lg text-xs font-bold active:scale-95 transition">❌ DECLINE</button>
                    </div>
                </div>`;
            });
            if(c.innerHTML !== htmlStr) c.innerHTML = htmlStr;
        }
    } catch (e) {}
}

async function processHostRequest(reqId, action, btnEl) {
    btnEl.innerText = "⏳..."; btnEl.disabled = true;
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/host/action', {
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'},
            body: JSON.stringify({req_id: reqId, action: action})
        });
        const d = await res.json();
        if(res.ok) { fetchHostRequests(); checkActiveRoomState(); } else { tg.showAlert(d.detail); fetchHostRequests(); }
    } catch(e) { tg.showAlert("Koneksi gagal."); btnEl.disabled = false; }
}

function startHostPolling() {
    if(hostPollInterval) clearInterval(hostPollInterval); fetchHostRequests();
    hostPollInterval = setInterval(() => {
        const actC = document.getElementById('mabarActiveContainer'), hSec = document.getElementById('hostOnlySection');
        if(actC && !actC.classList.contains('hidden') && hSec && !hSec.classList.contains('hidden')) { fetchHostRequests(); }
    }, 5000);
}


// ==========================================
// 9. CHAT ROOM DINAMIS
// ==========================================
function startChatPolling(type) {
    if(chatPollInterval) clearInterval(chatPollInterval); if(!type) return;
    chatPollInterval = setInterval(() => {
        const mabarEl = document.getElementById('mabar');
        if(mabarEl && mabarEl.classList.contains('active') && activeMabarCategory === 'chat') { if(type === 'room') loadRoomChat(false); }
        
        const pesanEl = document.getElementById('pesan');
        if(pesanEl && pesanEl.classList.contains('active')) {
            if(type === 'cs' && activePesanCategory === 'cs') loadCsChat(false);
            if(type === 'vip_chat' && activePesanCategory === 'vip' && activeVipTarget) loadVipChat(false);
        }

        const esportsEl = document.getElementById('esports');
        if(esportsEl && esportsEl.classList.contains('active') && activeEsportsCategory === 'squad') {
            if(type === 'squad' && mySquadId) loadSquadChat(false);
        }
    }, 3000); 
}

function renderChatBubble(msg, isMe, roleName) {
    const align = isMe ? 'justify-end' : 'justify-start';
    const bg = isMe ? 'bg-black/80 border-gray-700 text-gray-200' : 'bg-[var(--border-dark)] border-[var(--fire-pri)] text-white';
    const name = isMe ? 'Saya' : (roleName || msg.nickname || 'Member');
    const photoUrl = msg.photo_url || `${API_BASE_URL}/api/avatar/${msg.sender_id}`;
    const photoHtml = `<img src="${photoUrl}" class="w-8 h-8 rounded-full object-cover border border-theme flex-shrink-0 mt-1" onerror="this.onerror=null;this.src='template_default.png';">`;
    let contentHTML = `<p class="text-sm leading-relaxed">${(msg.content||"").replace(/</g,"&lt;")}</p>`;
    
    if (isMe) {
        return `<div class="flex ${align} mb-3 w-full gap-2"><div class="${bg} border p-3 rounded-xl max-w-[80%] shadow-md"><p class="text-[10px] text-theme-sub font-bold mb-1 text-right">${name}</p>${contentHTML}</div>${photoHtml}</div>`;
    } else {
        return `<div class="flex ${align} mb-3 w-full gap-2">${photoHtml}<div class="${bg} border p-3 rounded-xl max-w-[80%] shadow-md"><p class="text-[10px] text-theme-sub font-bold mb-1">${name}</p>${contentHTML}</div></div>`;
    }
}

async function loadRoomChat(showLoading = true) {
    const c = document.getElementById('chatMessagesRoom'); if(!c) return;
    if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Memuat Room Chat...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/room/messages', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); 
            if(data.room_info) {
                document.getElementById('roomChatOverlay').classList.add('hidden');
                document.getElementById('roomChatActive').classList.remove('hidden'); 
                document.getElementById('roomChatActive').classList.add('flex');

                if(data.room_members && document.getElementById('roomMemberList')) {
                    let memberHtml = '';
                    data.room_members.forEach(m => {
                        const statusColor = m.is_online ? 'text-green-400' : 'text-gray-500';
                        const statusText = m.is_online ? '(Online)' : '(Offline)';
                        memberHtml += `
                        <div class="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-red-900/50">
                            <div class="flex items-center gap-2">
                                <img src="${m.photo_url || `${API_BASE_URL}/api/avatar/${m.user_id}`}" class="w-6 h-6 rounded-full object-cover border border-theme" onerror="this.onerror=null;this.src='template_default.png';">
                                <p class="text-[11px] text-white font-bold truncate max-w-[100px]">${m.nickname}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[9px] text-glow-red font-bold">${m.role}</p>
                                <p class="text-[9px] font-bold ${statusColor}">${statusText}</p>
                            </div>
                        </div>`;
                    });
                    document.getElementById('roomMemberList').innerHTML = memberHtml;
                } else if (document.getElementById('roomMemberList')) {
                    document.getElementById('roomMemberList').innerHTML = '<p class="text-[10px] text-red-300/50 italic">Tidak ada data anggota.</p>';
                }

                const status = data.room_info.status;
                const btnStart = document.getElementById('btnStartMatch');
                const btnLeave = document.getElementById('btnLeaveEarly');
                const btnFinish = document.getElementById('btnFinishMatch');
                const controls = document.getElementById('roomChatControls');

                if (status === 'active') {
                    if(controls) controls.classList.remove('hidden');
                    if(btnStart) btnStart.classList.remove('hidden');
                    if(btnLeave) btnLeave.classList.remove('hidden');
                    if(btnFinish) btnFinish.classList.add('hidden');
                } else if (status === 'playing') {
                    if(controls) controls.classList.add('hidden');
                    if(btnStart) btnStart.classList.add('hidden');
                    if(btnLeave) btnLeave.classList.add('hidden');
                    if(btnFinish) btnFinish.classList.remove('hidden');
                }

                if(data.data && data.data.length > 0) {
                    let htmlStr = ''; data.data.forEach(msg => { htmlStr += renderChatBubble(msg, msg.sender_id == tgUser, null); });
                    if(c.innerHTML !== htmlStr) { c.innerHTML = htmlStr; c.scrollTop = c.scrollHeight; }
                } else if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada obrolan di Room ini.</p>';
            } else {
                document.getElementById('roomChatOverlay').classList.remove('hidden');
                document.getElementById('roomChatActive').classList.add('hidden'); 
                document.getElementById('roomChatActive').classList.remove('flex');
                if(chatPollInterval && activeMabarCategory === 'chat') clearInterval(chatPollInterval);
            }
        }
    }catch(e){}
}

async function sendRoomChat() {
    const text = document.getElementById('chatInputRoom').value.trim(); if(!text) return;
    const btn = document.getElementById('btnSendRoomChat'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/room/send', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({content: text}) });
        if(res.ok) { document.getElementById('chatInputRoom').value = ""; await loadRoomChat(true); } else tg.showAlert("Gagal mengirim pesan Room.");
    }catch(e){} btn.innerText = "Kirim"; btn.disabled = false;
}

async function startMatch() {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/start_match', { method: 'POST', headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'} });
        if(res.ok) {
            tg.showAlert("Mabar dimulai! Room telah disembunyikan dari Server Publik.");
            checkActiveRoomState(); loadRoomChat(true); 
        } else {
            const d = await res.json(); tg.showAlert("Gagal: " + d.detail);
        }
    } catch(e) { tg.showAlert("Kesalahan koneksi."); }
    tg.MainButton.hideProgress();
}

async function leaveEarly() {
    tg.MainButton.showProgress();
    try {
        const isHost = currentActiveRoomInfo && currentActiveRoomInfo.is_host;
        const endpoint = isHost ? '/api/mabar/cancel_room' : '/api/mabar/leave_early';
        const res = await fetch(API_BASE_URL + endpoint, { method: 'POST', headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'} });
        if(res.ok) {
            displayMabarFormPanel();
            tg.showAlert(isHost ? "Room berhasil dibatalkan." : "Anda berhasil keluar dari room.");
            setMabarCat('buat');
        } else {
            const d = await res.json(); tg.showAlert("Gagal: " + d.detail);
        }
    } catch(e) { tg.showAlert("Kesalahan koneksi."); }
    tg.MainButton.hideProgress();
}

async function finishMatch() {
    tg.MainButton.showProgress();
    try {
        const isHost = currentActiveRoomInfo && currentActiveRoomInfo.is_host;
        const endpoint = isHost ? '/api/mabar/close_room' : '/api/mabar/finish_member';
        const res = await fetch(API_BASE_URL + endpoint, { method: 'POST', headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'} });
        if(res.ok) {
            displayMabarFormPanel(); 
            tg.showAlert("Mabar Selesai! Silakan berikan rating kepada rekan tim Anda.");
            loadPendingRatings(); setMabarCat('rating');
        } else {
            const d = await res.json(); tg.showAlert("Gagal: " + d.detail);
        }
    } catch(e) { tg.showAlert("Kesalahan koneksi."); }
    tg.MainButton.hideProgress();
}

// ==========================================
// 10. RATING SYSTEM & SKIP
// ==========================================
async function loadPendingRatings() {
    const c = document.getElementById('listPendingRatings'); c.innerHTML = '<p class="text-center text-xs py-5">Memindai mabar yang belum diulas...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/pending_ratings', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const d = await res.json(); c.innerHTML = '';
            if(d.data.length > 0) {
                d.data.forEach(task => {
                    c.innerHTML += `
                    <div class="bg-[var(--panel-bg)] p-4 rounded-xl border border-[var(--fire-pri)] shadow-[0_0_15px_rgba(255,42,0,0.2)] mb-3 relative overflow-hidden">
                        <div class="absolute top-0 right-0 bg-[var(--fire-pri)] text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg">PENDING</div>
                        <p class="text-[10px] text-theme-sub mb-3 border-b border-theme pb-2">Mabar Selesai (Room: ${task.mlbb_id||'-'})</p>
                        <div class="flex justify-between items-center mb-4">
                            <div class="flex items-center gap-3">
                                <img src="${task.target_photo_url || `${API_BASE_URL}/api/avatar/${task.target_id}`}" class="w-10 h-10 rounded-full object-cover border-2 border-[var(--fire-pri)] shadow-md" onerror="this.onerror=null;this.src='template_default.png';">
                                <h4 class="font-bold text-[14px] text-white leading-tight">Nilai Performa:<br><span class="text-glow-red">${task.target_name}</span></h4>
                            </div>
                            <button onclick="skipRatingDirect(${task.target_id}, ${task.room_id})" class="text-[10px] bg-red-900/50 border border-red-500 text-red-300 px-2 py-1.5 rounded hover:text-white transition shadow-sm active:scale-90 flex-shrink-0">✖️ Lewati</button>
                        </div>
                        <div class="flex justify-between space-x-1">
                            ${[1,2,3,4,5].map(star => `<button onclick="openRateModal(${task.target_id}, ${task.room_id}, ${star}, '${task.target_name}')" class="bg-black/80 border border-theme w-10 h-10 rounded-lg flex items-center justify-center text-[13px] active:bg-[var(--fire-pri)] transition shadow-inner font-bold">${star}⭐</button>`).join('')}
                        </div>
                    </div>`;
                });
            } else c.innerHTML = '<div class="text-center py-10"><span class="text-5xl drop-shadow-lg">🎉</span><p class="text-xs text-theme-sub mt-4 font-bold tracking-wider">SEMUA MABAR SUDAH DIULAS</p></div>';
        }
    }catch(e){}
}

let rateTarget = null, rateRoom = null, rateScore = 0;
function openRateModal(targetId, roomId, score, name) {
    rateTarget = targetId; rateRoom = roomId; rateScore = score;
    document.getElementById('rateName').innerText = name; document.getElementById('rateScoreDisplay').innerText = score + " Bintang";
    if(score < 4) document.getElementById('rateEvidenceSection').classList.remove('hidden'); else document.getElementById('rateEvidenceSection').classList.add('hidden');
    openModal('rateModal');
}

async function submitRating() {
    let b64 = "";
    if(rateScore < 4) {
        const fileInput = document.getElementById('rateFile'); if(fileInput.files.length === 0) return tg.showAlert("Rating di bawah 4 WAJIB menyertakan bukti screenshot/video pendek performa buruk!");
        b64 = await getBase64(fileInput.files[0]);
    }
    const btn = document.getElementById('btnSubmitRating'); const originalText = btn.innerText; btn.innerText = "⏳ Memproses..."; btn.disabled = true; tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/submit_rating', { 
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, 
            body: JSON.stringify({ target_id: rateTarget, room_id: rateRoom, score: rateScore, photo_b64: b64 }) 
        });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); closeModal('rateModal'); loadPendingRatings(); loadUserData(); } 
        else tg.showAlert("Gagal: " + d.detail);
    }catch(e){ tg.showAlert("Terjadi kesalahan koneksi."); } 
    finally { btn.innerText = originalText; btn.disabled = false; tg.MainButton.hideProgress(); }
}

async function skipRatingDirect(targetId, roomId) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/skip_rating', { 
            method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, 
            body: JSON.stringify({ target_id: targetId, room_id: roomId }) 
        });
        if(res.ok) { 
            loadPendingRatings(); tg.showAlert("Ulasan berhasil dilewati secara permanen."); 
        } else { 
            const d = await res.json(); tg.showAlert("Gagal: " + d.detail); 
        }
    } catch(e) { tg.showAlert("Terjadi kesalahan jaringan."); } 
    finally { tg.MainButton.hideProgress(); }
}

// ==========================================
// 11. CHAT CS & NOTIFIKASI
// ==========================================
async function loadCsChat(showLoading = true) {
    const c = document.getElementById('chatMessagesCs'); if(!c) return;
    if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Memuat histori CS...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/cs/messages', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); 
            if(data.data && data.data.length > 0) {
                let htmlStr = ''; data.data.forEach(msg => { htmlStr += renderChatBubble(msg, msg.sender_id == tgUser, '👑 Developer'); });
                if(c.innerHTML !== htmlStr) { c.innerHTML = htmlStr; c.scrollTop = c.scrollHeight; }
            } else if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada histori obrolan CS.</p>';
        }
    }catch(e){}
}

async function sendCsChat() {
    const text = document.getElementById('chatInputCs').value.trim(); if(!text) return;
    const btn = document.getElementById('btnSendCsChat'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/cs/send', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({content: text}) });
        if(res.ok) { document.getElementById('chatInputCs').value = ""; await loadCsChat(true); } else tg.showAlert("Gagal mengirim pesan CS.");
    }catch(e){} btn.innerText = "Kirim"; btn.disabled = false;
}

async function pollNotifBadge() {
    setInterval(async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/notifications', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
            if(res.ok) {
                const data = await res.json(); const unread = data.data.filter(n => !n.is_read).length;
                if(unread > 0) { document.getElementById('notifBadge').classList.remove('hidden'); document.getElementById('notifBadgeDot').classList.remove('hidden'); } 
                else { document.getElementById('notifBadge').classList.add('hidden'); document.getElementById('notifBadgeDot').classList.add('hidden'); }
            }
        }catch(e){}
    }, 10000); 
}

async function loadNotif() {
    const c = document.getElementById('listNotifikasi'); c.innerHTML = '<p class="text-center text-xs py-5">Memuat pemberitahuan...</p>';
    document.getElementById('notifBadge').classList.add('hidden'); document.getElementById('notifBadgeDot').classList.add('hidden');
    try {
        const res = await fetch(API_BASE_URL + '/api/notifications', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); c.innerHTML = '';
            if(data.data && data.data.length > 0) {
                data.data.forEach(n => {
                    const border = n.title.includes('Ditolak') || n.title.includes('Gagal') ? 'border-red-500 bg-red-900/20' : (n.title.includes('Disetujui') || n.title.includes('Sukses') ? 'border-green-500 bg-green-900/20' : 'border-theme bg-black/60');
                    c.innerHTML += `<div class="p-4 rounded-xl border ${border} shadow-inner mb-3"><h4 class="font-bold text-[13px] mb-1.5">${n.title}</h4><p class="text-[11px] text-gray-300 leading-relaxed">${n.message}</p></div>`;
                });
            } else c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada pemberitahuan baru.</p>';
        }
    }catch(e){}
}

// ==========================================
// 12. VIP MARKETPLACE (ESCROW & CHAT)
// ==========================================
async function loadVipPlayers() {
    const c = document.getElementById('listVipPlayers'); c.innerHTML = '<p class="text-center text-xs py-5">Memuat data Host VIP...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/mabar/vip_players', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const d = await res.json(); c.innerHTML = '';
            if(d.data.length > 0) {
                d.data.forEach(p => {
                    c.innerHTML += `
                    <div class="glass-panel p-4 rounded-xl flex items-center gap-3 border-l-4 border-l-yellow-500 shadow-inner mb-3">
                        <img src="${p.photo_url || `${API_BASE_URL}/api/avatar/${p.user_id}`}" class="w-14 h-14 rounded-full border-2 border-yellow-500 object-cover shadow-[0_0_10px_rgba(255,215,0,0.5)]" onerror="this.onerror=null;this.src='template_default.png';">
                        <div class="flex-1">
                            <h4 class="font-bold text-glow-red text-[13px] mb-0.5">${p.nickname} <span class="bg-yellow-600 text-black px-1.5 py-0.5 rounded text-[9px] font-extrabold ml-1 border border-yellow-400">VIP HOST</span></h4>
                            <p class="text-[10px] text-theme-sub font-semibold">⭐ ${parseFloat(p.rating).toFixed(1)}/5.0 ( Dari ${p.total_votes||0} Ulasan ) | ${p.hero}</p>
                            <p class="text-[11px] font-bold text-green-400 mt-1">Tarif: Rp ${p.price.toLocaleString('id-ID')} <span class="text-[9px] text-gray-400">/ Match</span></p>
                        </div>
                        <div class="flex flex-col gap-1">
                            <button onclick="openVipProfile(${p.user_id})" class="bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-md active:scale-95">PROFIL</button>
                            <button onclick="switchTab('pesan'); setPesanCat('vip'); openVipChat(${p.user_id}, '${p.nickname}', '${p.photo_url || `${API_BASE_URL}/api/avatar/${p.user_id}`}');" class="btn-blue px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-[0_0_10px_var(--blue-glow)]">CHAT</button>
                        </div>
                    </div>`;
                });
            } else c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada Host VIP yang aktif.</p>';
        }
    }catch(e){}
}

async function submitVipApp() {
    const nick = document.getElementById('vipNick').value, hero = document.getElementById('vipHero').value, rank = document.getElementById('vipRank').value, price = document.getElementById('vipPrice').value, msg = document.getElementById('vipMsg').value, fileInput = document.getElementById('vipFile');
    if(!nick || !hero || !rank || !price || !msg || fileInput.files.length === 0) return tg.showAlert("Semua formulir dan Bukti Screenshot Stat WAJIB diisi!");
    const btn = document.getElementById('btnSubmitVip'); const originalText = btn.innerText; btn.innerText = "⏳ Memproses..."; btn.disabled = true; tg.MainButton.showProgress();
    try {
        const b64 = await getBase64(fileInput.files[0]); 
        const res = await fetch(API_BASE_URL + '/api/mabar/apply_vip', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ nickname: nick, hero: hero, high_rank: rank, price: parseInt(price), message: msg, photo_b64: b64 }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); closeModal('applyVipModal'); } else tg.showAlert("Gagal: " + d.detail);
    }catch(e){ tg.showAlert("Terjadi kesalahan koneksi."); } finally { btn.innerText = originalText; btn.disabled = false; tg.MainButton.hideProgress(); }
}

async function loadVipContacts() {
    const c = document.getElementById('vipContactList'); c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Memuat data VIP...</p>';
    try {
        const resOrder = await fetch(API_BASE_URL + '/api/chat/vip/order/list', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(resOrder.ok) {
            const resJson = await resOrder.json();
            if(resJson.data.is_host) { renderHostDashboard(resJson.data.orders, resJson.data.inbox); return; } else { window.customerActiveOrders = resJson.data.orders; }
        }

        const res = await fetch(API_BASE_URL + '/api/chat/vip/contacts', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); c.innerHTML = '';
            if(window.customerActiveOrders && window.customerActiveOrders.length > 0) {
                c.innerHTML += `<div class="bg-blue-900/30 border border-blue-800 p-3 rounded-xl mb-3"><p class="text-xs text-blue-200">Anda memiliki <b>${window.customerActiveOrders.length}</b> pesanan jasa VIP aktif. Cek obrolan untuk statusnya.</p></div>`;
            }

            if(data.data && data.data.length > 0) {
                data.data.forEach(contact => {
                    const seasonRaw = contact.active_card.split('_')[1] || "";
                    c.innerHTML += `
                    <div onclick="openVipChat(${contact.user_id}, '${contact.nickname}', '${contact.photo_url || `${API_BASE_URL}/api/avatar/${contact.user_id}`}')" class="flex items-center gap-3 bg-black/60 p-3 rounded-xl border border-theme active:bg-[var(--border-dark)] transition cursor-pointer mb-2 shadow-inner">
                        <img src="${contact.photo_url || `${API_BASE_URL}/api/avatar/${contact.user_id}`}" class="w-12 h-12 rounded-full object-cover border border-yellow-500" onerror="this.onerror=null;this.src='template_default.png';">
                        <div class="flex-1 overflow-hidden">
                            <h4 class="font-bold text-glow-blue text-sm truncate">${contact.nickname}</h4>
                            <p class="text-[9px] text-yellow-400 font-bold">VIP Host ${seasonRaw.toUpperCase()}</p>
                        </div>
                        <span class="text-xl">💬</span>
                    </div>`;
                });
            } else c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada Host VIP yang tersedia.</p>';
        }
    }catch(e){}
}

async function renderHostDashboard(orders, inbox) {
    const c = document.getElementById('vipContactList');
    let hostBalance = 0;
    try {
        const resU = await fetch(API_BASE_URL + '/api/get_user/me',{headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(resU.ok) { const u = await resU.json(); hostBalance = u.host_balance || 0; }
    }catch(e){}

    let htmlStr = `
    <div class="glass-panel p-5 rounded-2xl mb-4 text-center border-l-4 border-l-[var(--fire-pri)]">
        <p class="text-[10px] text-theme-sub font-bold tracking-widest mb-1">SALDO PENDAPATAN HOST</p>
        <h2 class="text-2xl font-bold text-white mb-3 text-glow-red">Rp ${hostBalance.toLocaleString('id-ID')}</h2>
        <button onclick="openModal('wdModal')" class="w-full btn-fire py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"><span class="text-lg">💸</span> TARIK DANA</button>
    </div>
    <h3 class="text-sm font-bold text-glow-blue mb-3 border-b border-theme pb-2">📋 Pesanan Masuk</h3>`;

    if(orders && orders.length > 0) {
        orders.forEach(o => {
            let statusColor = o.status === 'pending' ? 'text-yellow-400' : (o.status === 'active' ? 'text-blue-400' : 'text-green-400');
            let statusText = o.status === 'pending' ? 'PENDING (Menunggu ACC)' : (o.status === 'active' ? 'AKTIF (Berjalan)' : 'MENUNGGU KONFIRMASI PEMBELI');
            
            let buttons = '';
            if(o.status === 'pending') {
                buttons = `<div class="flex gap-2 mt-3"><button onclick="actionVipOrder(${o.id}, 'accept')" class="flex-1 btn-blue py-2 rounded-lg text-[10px] font-bold">✅ TERIMA</button><button onclick="actionVipOrder(${o.id}, 'reject')" class="flex-1 bg-red-900/50 border border-red-500 text-red-400 py-2 rounded-lg text-[10px] font-bold">❌ TOLAK</button></div>`;
            } else if(o.status === 'active') {
                buttons = `<button onclick="actionVipOrder(${o.id}, 'lapor_selesai')" class="w-full mt-3 btn-fire py-2 rounded-lg text-[10px] font-bold">📢 LAPOR SELESAI</button>`;
            }

            htmlStr += `
            <div class="bg-black/60 border border-theme p-3.5 rounded-xl mb-3 shadow-inner">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <img src="${o.customer_photo || `${API_BASE_URL}/api/avatar/${o.customer_id}`}" class="w-8 h-8 rounded-full object-cover border border-gray-600" onerror="this.onerror=null;this.src='template_default.png';">
                        <div>
                            <h4 class="font-bold text-[13px] text-white">${o.customer_name}</h4>
                            <p class="text-[9px] text-theme-sub">Order: ${o.match_count} Match</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-green-400">Rp ${o.total_price.toLocaleString('id-ID')}</p>
                        <p class="text-[8px] ${statusColor} font-bold mt-0.5">${statusText}</p>
                    </div>
                </div>
                ${buttons}
                <button onclick="openVipChat(${o.customer_id}, '${o.customer_name}', '${o.customer_photo || `${API_BASE_URL}/api/avatar/${o.customer_id}`}')" class="w-full mt-2 bg-[var(--border-dark)] text-white py-2 rounded-lg text-[10px] font-bold border border-[var(--fire-pri)]">💬 CHAT PEMBELI</button>
            </div>`;
        });
    } else { htmlStr += '<p class="text-center text-[11px] text-theme-sub py-5">Belum ada pesanan aktif.</p>'; }

    htmlStr += `<h3 class="text-sm font-bold text-glow-red mt-6 mb-3 border-b border-theme pb-2">✉️ Kotak Masuk (Chat)</h3>`;
    
    if(inbox && inbox.length > 0) {
        inbox.forEach(msg => {
            htmlStr += `
            <div onclick="openVipChat(${msg.user_id}, '${msg.nickname}', '${msg.photo_url || `${API_BASE_URL}/api/avatar/${msg.user_id}`}')" class="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-theme active:bg-[var(--border-dark)] transition cursor-pointer mb-2 shadow-inner">
                <img src="${msg.photo_url || `${API_BASE_URL}/api/avatar/${msg.user_id}`}" class="w-10 h-10 rounded-full object-cover border border-gray-700" onerror="this.onerror=null;this.src='template_default.png';">
                <div class="flex-1 overflow-hidden">
                    <h4 class="font-bold text-sm text-white truncate">${msg.nickname}</h4>
                    <p class="text-[9px] text-theme-sub">ID User: ${msg.user_id}</p>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-[14px]">💬</span>
                    <span class="text-[8px] text-gray-500 mt-1">Chat Terakhir</span>
                </div>
            </div>`;
        });
    } else { htmlStr += '<p class="text-center text-[11px] text-theme-sub py-5">Belum ada riwayat chat masuk.</p>'; }
    c.innerHTML = htmlStr;
}

function openVipChat(id, name, photo) {
    activeVipTarget = id;
    document.getElementById('vipChatTargetName').innerText = name;
    document.getElementById('vipChatTargetImg').src = photo || `${API_BASE_URL}/api/avatar/${id}`;
    document.getElementById('vipContactList').classList.add('hidden');
    document.getElementById('vipChatInterface').classList.remove('hidden');
    document.getElementById('vipChatInterface').classList.add('flex');
    loadVipChat(true); startChatPolling('vip_chat');
}

function closeVipChat() {
    activeVipTarget = null;
    if(chatPollInterval) clearInterval(chatPollInterval);
    document.getElementById('vipContactList').classList.remove('hidden');
    document.getElementById('vipChatInterface').classList.add('hidden');
    document.getElementById('vipChatInterface').classList.remove('flex');
    loadVipContacts(); 
}

async function loadVipChat(showLoading = true) {
    if(!activeVipTarget) return;
    const c = document.getElementById('chatMessagesVip'); const b = document.getElementById('vipOrderBanner');
    if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Memuat DM VIP...</p>';
    
    try {
        const resOrder = await fetch(API_BASE_URL + '/api/chat/vip/order/list', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(resOrder.ok) {
            const orderData = await resOrder.json();
            if(!orderData.data.is_host) {
                const myOrder = orderData.data.orders.find(o => o.host_id == activeVipTarget);
                if(myOrder) {
                    b.classList.remove('hidden');
                    let bHtml = `<div class="bg-blue-900/20 border-l-4 border-l-blue-500 p-3 rounded-xl shadow-inner text-sm mb-3">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-blue-300">Order: ${myOrder.match_count} Match</span>
                            <span class="font-bold text-white">Rp ${myOrder.total_price.toLocaleString('id-ID')}</span>
                        </div>
                        <p class="text-[10px] text-blue-200 mb-2">Status: <b class="uppercase">${myOrder.status.replace('_', ' ')}</b></p>
                    `;
                    if(myOrder.status === 'pending') {
                        bHtml += `<button onclick="cancelVipOrder(${myOrder.id})" class="bg-red-900/50 border border-red-500 text-red-400 py-1.5 px-3 rounded text-[10px] font-bold active:scale-95 transition w-full">Batalkan Order (Refund)</button>`;
                    } else if(myOrder.status === 'reported_done') {
                        bHtml += `<button onclick="finishVipOrder(${myOrder.id}, ${activeVipTarget}, '${document.getElementById('vipChatTargetName').innerText}')" class="btn-blue py-1.5 px-3 rounded text-[10px] font-bold active:scale-95 transition w-full">✅ KONFIRMASI MABAR SELESAI</button>`;
                    }
                    bHtml += `</div>`;
                    b.innerHTML = bHtml;
                } else {
                    b.classList.remove('hidden');
                    b.innerHTML = `<button onclick="openOrderModal()" class="w-full btn-fire py-2.5 rounded-xl text-xs font-bold shadow-[0_0_10px_var(--border-light)] flex items-center justify-center gap-2 mb-3">🛒 ORDER JASA MABAR</button>`;
                }
            } else { b.classList.add('hidden'); }
        }

        const res = await fetch(`${API_BASE_URL}/api/chat/vip/messages?target_id=${activeVipTarget}`, {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); 
            if(data.data && data.data.length > 0) {
                let htmlStr = ''; data.data.forEach(msg => { htmlStr += renderChatBubble(msg, msg.sender_id == tgUser, document.getElementById('vipChatTargetName').innerText); });
                if(c.innerHTML !== htmlStr) { c.innerHTML = htmlStr; c.scrollTop = c.scrollHeight; }
            } else if(showLoading) c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada DM dengan Host ini.</p>';
        }
    }catch(e){}
}

async function sendVipChat() {
    if(!activeVipTarget) return;
    const text = document.getElementById('chatInputVip').value.trim(); if(!text) return;
    const btn = document.getElementById('btnSendVipChat'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/vip/send', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({target_id: activeVipTarget, content: text}) });
        if(res.ok) { document.getElementById('chatInputVip').value = ""; await loadVipChat(true); } 
        else tg.showAlert("Gagal mengirim DM VIP.");
    }catch(e){} btn.innerText = "Kirim"; btn.disabled = false;
}

function openOrderModal() {
    document.getElementById('orderVipHostName').innerText = document.getElementById('vipChatTargetName').innerText;
    document.getElementById('orderMatchCount').value = 1; openModal('orderVipModal');
}

async function submitVipOrder() {
    const matchCount = parseInt(document.getElementById('orderMatchCount').value);
    if(matchCount < 1 || isNaN(matchCount)) return tg.showAlert("Jumlah match tidak valid.");
    
    const btn = document.getElementById('btnSubmitVipOrder'); const oTxt = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true; tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/vip/order/create', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({host_id: activeVipTarget, match_count: matchCount}) });
        const d = await res.json();
        if(res.ok) { closeModal('orderVipModal'); tg.showAlert("Order berhasil dibuat! Saldo kamu diamankan sistem."); loadVipChat(); loadUserData(); } 
        else tg.showAlert("Gagal: " + d.detail);
    } catch(e) { tg.showAlert("Koneksi gagal."); } finally { btn.innerText = oTxt; btn.disabled = false; tg.MainButton.hideProgress(); }
}

function cancelVipOrder(orderId) {
    tg.showConfirm('Yakin membatalkan orderan ini? Saldo dikembalikan.', async function(r){
        if(!r) return; tg.MainButton.showProgress();
        try {
            const res = await fetch(API_BASE_URL + '/api/chat/vip/order/cancel', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({order_id: orderId}) });
            if(res.ok) { tg.showAlert("Order Dibatalkan."); loadVipChat(); loadUserData(); } else { const d = await res.json(); tg.showAlert(d.detail); }
        } catch(e){} finally { tg.MainButton.hideProgress(); }
    });
}

async function actionVipOrder(orderId, action) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/vip/order/action', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({order_id: orderId, action: action}) });
        if(res.ok) { tg.showAlert("Aksi berhasil!"); loadVipContacts(); } else { const d = await res.json(); tg.showAlert(d.detail); }
    } catch(e){} finally { tg.MainButton.hideProgress(); }
}

async function submitWithdraw() {
    const amount = parseInt(document.getElementById('wdAmount').value), method = document.getElementById('wdMethod').value, acc = document.getElementById('wdAccount').value.trim();
    if(isNaN(amount) || amount < 10000) return tg.showAlert("Minimal tarik dana Rp 10.000"); if(!acc) return tg.showAlert("Informasi rekening/nomor wajib diisi!");
    
    const btn = document.getElementById('btnSubmitWd'); const oTxt = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true; tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/vip/withdraw', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({amount: amount, method: method, account_info: acc}) });
        const d = await res.json();
        if(res.ok) { closeModal('wdModal'); tg.showAlert("Permintaan withdraw berhasil dikirim ke Admin!"); document.getElementById('wdAmount').value = ''; document.getElementById('wdAccount').value = ''; loadVipContacts(); } 
        else tg.showAlert("Gagal: " + d.detail);
    } catch(e){} finally { btn.innerText = oTxt; btn.disabled = false; tg.MainButton.hideProgress(); }
}

// === 13. VIP PROFILE & RATING ===
async function openVipProfile(hostId) {
    openModal('txLoadingModal'); 
    try {
        const res = await fetch(`${API_BASE_URL}/api/vip/profile/${hostId}`, {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json();
            document.getElementById('vProfImg').src = data.profile.photo_url || `${API_BASE_URL}/api/avatar/${hostId}`;
            document.getElementById('vProfNick').innerText = data.profile.nickname;
            document.getElementById('vProfRating').innerText = `⭐ ${parseFloat(data.profile.rating).toFixed(1)}/5.0 ( Dari ${data.profile.total_votes} Ulasan )`;
            document.getElementById('vProfStats').innerText = `Hero Fav: ${data.profile.hero} | Rank: ${data.profile.high_rank}`;
            document.getElementById('vProfTariff').innerText = `Rp ${data.profile.price.toLocaleString('id-ID')} / Match`;

            const revContainer = document.getElementById('vipReviewsContainer');
            if(data.reviews && data.reviews.length > 0) {
                revContainer.innerHTML = data.reviews.map(r => `
                    <div class="bg-black/60 p-3 rounded-xl border border-theme shadow-inner">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-glow-blue">${r.rater_name}</span>
                            <span class="text-[10px] text-yellow-400 font-bold">${r.score}⭐</span>
                        </div>
                        <p class="text-[11px] text-gray-300 italic">"${r.comment}"</p>
                    </div>
                `).join('');
            } else {
                revContainer.innerHTML = '<p class="text-center text-xs text-theme-sub py-3">Belum ada testimoni.</p>';
            }
            closeModal('txLoadingModal'); openModal('vipProfileModal');
        } else { closeModal('txLoadingModal'); tg.showAlert("Gagal memuat profil VIP. Endpoint tidak tersedia."); }
    }catch(e){ closeModal('txLoadingModal'); tg.showAlert("Kesalahan jaringan."); }
}

function finishVipOrder(orderId, hostId, hostName) {
    tg.showConfirm('Konfirmasi mabar selesai? Dana akan diteruskan ke Host.', async function(r){
        if(!r) return; tg.MainButton.showProgress();
        try {
            const res = await fetch(API_BASE_URL + '/api/chat/vip/order/finish', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({order_id: orderId}) });
            if(res.ok) { 
                tg.showAlert("Pesanan Selesai! Silakan berikan Testimoni Anda."); loadVipChat(); 
                activeVipTarget = hostId; document.getElementById('vipRateName').innerText = hostName; setVipScore(5); document.getElementById('vipRateComment').value = "";
                openModal('vipRateModal');
            } else { const d = await res.json(); tg.showAlert(d.detail); }
        } catch(e){} finally { tg.MainButton.hideProgress(); }
    });
}

function setVipScore(score) {
    document.getElementById('vipRateScore').value = score;
    const btns = document.querySelectorAll('.vip-star-btn');
    btns.forEach((btn, i) => {
        if(i < score) { btn.className = "vip-star-btn bg-black/80 border border-[var(--fire-pri)] text-[var(--fire-pri)] w-12 h-12 rounded-lg text-lg active:bg-[var(--fire-pri)] transition font-bold shadow-[0_0_10px_var(--fire-pri)]"; } 
        else { btn.className = "vip-star-btn bg-black/80 border border-theme text-gray-500 w-12 h-12 rounded-lg text-lg active:bg-[var(--fire-pri)] transition font-bold"; }
    });
}

async function submitVipRating() {
    const score = document.getElementById('vipRateScore').value, comment = document.getElementById('vipRateComment').value.trim();
    if(!comment) return tg.showAlert("Ulasan/Komentar wajib diisi!");
    const btn = document.getElementById('btnSubmitVipRating'); btn.innerText = "⏳ Memproses..."; btn.disabled = true; tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/vip/submit_rating', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ host_id: activeVipTarget, score: parseInt(score), comment: comment }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert("Terima kasih atas ulasannya!"); closeModal('vipRateModal'); loadUserData(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Kesalahan jaringan."); } finally { btn.innerText = "KIRIM TESTIMONI"; btn.disabled = false; tg.MainButton.hideProgress(); }
}


// ==========================================
// UPDATE BARU: SQUAD & TOURNAMENT (ESPORTS)
// ==========================================

// --- FUNGSI SQUAD ---
async function createSquad() {
    const name = document.getElementById('sqName').value.trim();
    const tag = document.getElementById('sqTag').value.trim().toUpperCase();
    const logoUrl = document.getElementById('sqLogo').value.trim();
    if(!name || !tag) return tg.showAlert("Nama dan Tag Squad wajib diisi!");

    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/squad/create', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ name: name, tag: tag, logo_url: logoUrl }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); loadMySquad(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

async function joinSquad() {
    const sqId = document.getElementById('sqJoinId').value.trim().toUpperCase();
    if(!sqId) return tg.showAlert("Masukkan ID Squad!");

    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/squad/join', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ squad_id_str: sqId }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); loadMySquad(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

async function loadMySquad() {
    try {
        const res = await fetch(API_BASE_URL + '/api/squad/my', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json();
            if(data.data && data.data.info) {
                document.getElementById('squadNotJoinedContainer').classList.add('hidden');
                document.getElementById('squadActiveContainer').classList.remove('hidden');
                
                const info = data.data.info;
                mySquadId = info.id;
                document.getElementById('mySqName').innerText = info.name;
                document.getElementById('mySqTag').innerText = `[${info.tag}]`;
                document.getElementById('mySqId').innerText = info.squad_id_str;
                if(info.logo_url) document.getElementById('mySqLogo').src = info.logo_url;

                // Render Active Members
                const memC = document.getElementById('mySquadMembers');
                const isMeLeader = data.data.members.find(x => x.user_id == tgUser && x.role === 'leader');
                memC.innerHTML = data.data.members.map(m => {
                    let kickBtn = (isMeLeader && m.user_id != tgUser) ? `<button onclick="kickSquadMember(${m.user_id})" class="text-[9px] bg-red-900/50 text-red-400 border border-red-500 px-2 py-0.5 rounded shadow-sm active:scale-95 ml-2">KICK</button>` : '';
                    return `
                    <div class="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-gray-800 mb-1">
                        <div class="flex items-center gap-2">
                            <img src="${m.photo_url || `${API_BASE_URL}/api/avatar/${m.user_id}`}" class="w-8 h-8 rounded-full border border-theme object-cover" onerror="this.src='template_default.png'">
                            <div>
                                <p class="text-xs text-white font-bold">${m.nickname}</p>
                                <p class="text-[9px] text-theme-sub">⭐ ${parseFloat(m.rating).toFixed(1)} | ${m.hero}</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span class="text-[9px] font-bold ${m.role === 'leader' ? 'text-yellow-400' : 'text-blue-300'}">${m.role.toUpperCase()}</span>
                            ${kickBtn}
                        </div>
                    </div>
                    `;
                }).join('');
                document.getElementById('mySqCount').innerText = `${data.data.members.length}/10`;

                // Leader Panel (Pending Requests)
                const pC = document.getElementById('mySquadPending');
                if(isMeLeader) {
                    document.getElementById('squadLeaderControls').classList.remove('hidden');
                    document.getElementById('sqPendingBadge').innerText = data.data.pending.length;
                    if(data.data.pending.length > 0) {
                        pC.innerHTML = data.data.pending.map(p => `
                            <div class="flex justify-between items-center bg-red-900/20 p-2 rounded-lg border border-red-800">
                                <div><p class="text-xs text-white font-bold">${p.nickname}</p><p class="text-[9px] text-red-200">Melamar</p></div>
                                <div class="flex gap-1">
                                    <button onclick="processSquadJoin(${p.user_id}, 'accept')" class="bg-blue-600 px-2 py-1 rounded text-[10px] font-bold text-white">ACC</button>
                                    <button onclick="processSquadJoin(${p.user_id}, 'reject')" class="bg-red-600 px-2 py-1 rounded text-[10px] font-bold text-white">X</button>
                                </div>
                            </div>
                        `).join('');
                    } else { pC.innerHTML = '<p class="text-[10px] text-gray-500 italic">Tidak ada antrean.</p>'; }
                } else {
                    document.getElementById('squadLeaderControls').classList.add('hidden');
                }
                
                loadSquadChat(true);
            } else {
                mySquadId = null;
                document.getElementById('squadNotJoinedContainer').classList.remove('hidden');
                document.getElementById('squadActiveContainer').classList.add('hidden');
            }
        }
    } catch(e) {}
}

function copySquadId() {
    const id = document.getElementById('mySqId').innerText;
    try { navigator.clipboard.writeText(id); tg.showAlert("ID Squad Disalin!"); }
    catch(e) { tg.showAlert("Gagal menyalin ID."); }
}

async function processSquadJoin(userId, action) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/squad/action', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ req_user_id: userId, action: action }) });
        const d = await res.json();
        if(res.ok) loadMySquad(); else tg.showAlert("Gagal: " + d.detail);
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

async function kickSquadMember(userId) {
    tg.showConfirm("Yakin ingin mengeluarkan member ini dari Squad?", async function(r) {
        if(!r) return;
        tg.MainButton.showProgress();
        try {
            const res = await fetch(API_BASE_URL + '/api/squad/kick', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ target_user_id: userId }) });
            const d = await res.json();
            if(res.ok) { tg.showAlert(d.message); loadMySquad(); } else { tg.showAlert("Gagal: " + d.detail); }
        } catch(e) { tg.showAlert("Koneksi gagal."); }
        tg.MainButton.hideProgress();
    });
}

async function leaveSquad() {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/squad/leave', { method: 'POST', headers: {'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'} });
        const d = await res.json();
        if(res.ok) { tg.showAlert("Berhasil keluar dari squad."); loadMySquad(); } else tg.showAlert("Gagal: " + d.detail);
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

// --- CHAT SQUAD INTERNAL ---
async function loadSquadChat(showLoading = true) {
    const c = document.getElementById('chatMessagesSquad'); if(!c || !mySquadId) return;
    if(showLoading) c.innerHTML = '<p class="text-center text-[10px] py-5 text-theme-sub">Memuat Basecamp...</p>';
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/squad/messages', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); 
            if(data.data && data.data.length > 0) {
                let htmlStr = ''; data.data.forEach(msg => { htmlStr += renderChatBubble(msg, msg.sender_id == tgUser, null); });
                if(c.innerHTML !== htmlStr) { c.innerHTML = htmlStr; c.scrollTop = c.scrollHeight; }
            } else if(showLoading) c.innerHTML = '<p class="text-center text-[10px] py-5 text-theme-sub">Belum ada obrolan.</p>';
        }
    }catch(e){}
}

async function sendSquadChat() {
    const text = document.getElementById('chatInputSquad').value.trim(); if(!text || !mySquadId) return;
    try {
        const res = await fetch(API_BASE_URL + '/api/chat/squad/send', { method: 'POST', headers:{'Content-Type':'application/json','Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({squad_id: mySquadId, content: text}) });
        if(res.ok) { document.getElementById('chatInputSquad').value = ""; await loadSquadChat(false); }
    }catch(e){}
}

// --- FUNGSI TOURNAMENT ---
async function loadTournaments() {
    const c = document.getElementById('listTournaments');
    c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Memuat turnamen...</p>';
    
    // RAHASIA OWNER: Klik Refresh 5x memunculkan Panel "Buat Turnamen" & "Acak Bracket"
    adminTourClicks++;
    if(adminTourClicks >= 5) { document.getElementById('adminTourPanel').classList.remove('hidden'); document.getElementById('ownerBracketControls').classList.remove('hidden'); }
    else { document.getElementById('adminTourPanel').classList.add('hidden'); document.getElementById('ownerBracketControls').classList.add('hidden'); }

    try {
        const res = await fetch(API_BASE_URL + '/api/tournament/list', {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json(); c.innerHTML = '';
            if(data.data.length > 0) {
                data.data.forEach(t => {
                    const statusColor = t.status === 'open' ? 'text-green-400' : 'text-yellow-400';
                    const isFull = t.registered_count >= t.slot_count;
                    
                    let btnAction = `<button onclick="tg.showConfirm('Yakin mendaftar? Biaya Rp ${t.entry_fee.toLocaleString()} akan dipotong dari saldo Leader.', function(r){ if(r) joinTournament(${t.id}); })" class="w-full btn-blue py-2 rounded-lg text-xs font-bold mt-3 shadow-[0_0_10px_var(--blue-glow)]">DAFTAR SEKARANG</button>`;
                    if(t.status !== 'open' || isFull) {
                        btnAction = `<button onclick="openBracketModal(${t.id}, '${t.name}', '${t.status}')" class="w-full btn-fire py-2 rounded-lg text-xs font-bold mt-3 shadow-[0_0_10px_var(--border-light)]">LIHAT BAGAN BRACKET</button>`;
                    }
                    
                    c.innerHTML += `
                    <div class="glass-panel p-4 rounded-xl border border-theme shadow-inner mb-3">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-glow-red text-sm w-2/3 truncate">${t.name}</h3>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border border-gray-600 ${t.status === 'open'?'bg-green-900/30 text-green-400':'bg-yellow-900/30 text-yellow-400'} uppercase">${t.status}</span>
                        </div>
                        <div class="bg-black/60 p-2 rounded-lg border border-gray-800 text-[10px] space-y-1">
                            <div class="flex justify-between"><span class="text-gray-400">Format:</span><span class="text-white font-bold">BO${t.format_bo}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">Slot Terisi:</span><span class="text-white font-bold">${t.registered_count} / ${t.slot_count} Tim</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">Tiket Masuk:</span><span class="text-green-400 font-bold">${t.entry_fee > 0 ? 'Rp '+t.entry_fee.toLocaleString('id-ID') : 'GRATIS'}</span></div>
                        </div>
                        ${btnAction}
                    </div>`;
                });
            } else { c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub">Belum ada Turnamen aktif.</p>'; }
        }
    } catch(e) {}
}

async function createTournament() {
    const name = document.getElementById('cTourName').value.trim();
    const bo = parseInt(document.getElementById('cTourFormat').value);
    const slots = parseInt(document.getElementById('cTourSlots').value);
    const fee = parseInt(document.getElementById('cTourFee').value) || 0;
    
    if(!name) return tg.showAlert("Nama Turnamen Wajib!");
    
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/tournament/create', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ name: name, format_bo: bo, slot_count: slots, entry_fee: fee }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert("Turnamen berhasil di-publish!"); loadTournaments(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

async function joinTournament(tourId) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/tournament/join', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ tournament_id: tourId }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); loadTournaments(); loadUserData(); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

// --- LOGIKA VISUALISASI BRACKET (HIBRIDA 8 TIM & 16 TIM) ---
async function openBracketModal(tourId, tourName, status) {
    activeTournamentId = tourId;
    document.getElementById('bracketTourName').innerText = tourName;
    document.getElementById('bracketTourStatus').innerText = `Status: ${status.toUpperCase()}`;
    openModal('bracketModal');
    
    const c = document.getElementById('bracketDrawArea');
    c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub w-full">Memuat Bagan Pertandingan...</p>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/tournament/bracket/${tourId}`, {headers:{'Authorization':tg.initData||'', 'ngrok-skip-browser-warning': 'true'}});
        if(res.ok) {
            const data = await res.json();
            renderBracket(data.data.matches);
        }
    } catch(e) {}
}

function renderBracket(matches) {
    const c = document.getElementById('bracketDrawArea');
    if(!matches || matches.length === 0) {
        c.innerHTML = '<p class="text-center text-xs py-5 text-theme-sub w-full">Bagan belum di-acak oleh Panitia/Owner.</p>';
        return;
    }
    
    const getMatchBox = (m) => {
        if(!m) return '';
        const isCompleted = m.status === 'completed';
        const s1Style = isCompleted && m.winner_id == m.squad1_id ? 'text-glow-blue font-bold' : 'text-gray-300';
        const s2Style = isCompleted && m.winner_id == m.squad2_id ? 'text-glow-blue font-bold' : 'text-gray-300';
        const borderCls = m.is_lower_bracket ? 'border-yellow-600' : 'border-[var(--fire-pri)]';
        const bgCls = m.is_lower_bracket ? 'bg-yellow-900/20' : 'bg-[var(--panel-bg)]';
        
        let clickAction = '';
        // Owner Clicks 5x = Admin Mode ACC Score
        if(adminTourClicks >= 5 && !isCompleted && m.squad1_id && m.squad2_id) {
            clickAction = `onclick="openMatchReport(${m.id}, ${m.squad1_id}, '${m.squad1_name.replace(/'/g,"\\'")}', ${m.squad2_id}, '${m.squad2_name.replace(/'/g,"\\'")}', '${m.round_name}')" class="cursor-pointer active:scale-95 transition"`;
        }
        
        return `
        <div ${clickAction} class="w-40 border ${borderCls} ${bgCls} rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.5)] flex flex-col mb-4 overflow-hidden relative flex-shrink-0">
            <div class="bg-black/80 px-2 py-1 text-[8px] font-bold text-gray-400 border-b border-theme text-center truncate">${m.round_name}</div>
            <div class="flex items-center gap-2 p-2 border-b border-gray-800 bg-black/40">
                <img src="${m.squad1_logo||'template_default.png'}" class="w-4 h-4 rounded-full border border-gray-600" onerror="this.src='template_default.png'">
                <span class="text-[10px] truncate ${s1Style}">${m.squad1_name || 'TBD'}</span>
            </div>
            <div class="flex items-center gap-2 p-2 bg-black/40">
                <img src="${m.squad2_logo||'template_default.png'}" class="w-4 h-4 rounded-full border border-gray-600" onerror="this.src='template_default.png'">
                <span class="text-[10px] truncate ${s2Style}">${m.squad2_name || 'TBD'}</span>
            </div>
            ${isCompleted ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="text-4xl opacity-20">✅</span></div>' : ''}
        </div>`;
    };

    // --- LOGIKA SPLIT BAGAN (8 TIM vs 16 TIM) ---
    if (matches.length <= 10) {
        // Mode 8 Tim (4 Kolom)
        let col1='', col2='', col3='', col4='';
        
        col1 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">Kualifikasi (Gugur)</div>`;
        [1,2,3,4].forEach(mo => col1 += getMatchBox(matches.find(m => m.match_order === mo)));
        
        col2 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">Semi Final & Lower R1</div>`;
        col2 += getMatchBox(matches.find(m => m.match_order === 5));
        col2 += `<div class="h-10"></div>`; 
        col2 += getMatchBox(matches.find(m => m.match_order === 6));
        col2 += `<div class="h-10"></div>`;
        col2 += getMatchBox(matches.find(m => m.match_order === 7)); // Lower R1
        
        col3 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">Finals</div>`;
        col3 += `<div class="h-16"></div>`;
        col3 += getMatchBox(matches.find(m => m.match_order === 8)); // Upper F
        col3 += `<div class="h-16"></div>`;
        col3 += getMatchBox(matches.find(m => m.match_order === 9)); // Lower F
        
        col4 += `<div class="text-[9px] text-yellow-400 font-bold text-center mb-2">Grand Final</div>`;
        col4 += `<div class="h-32"></div>`;
        col4 += getMatchBox(matches.find(m => m.match_order === 10));

        c.innerHTML = `
            <div class="flex flex-col">${col1}</div>
            <div class="flex flex-col">${col2}</div>
            <div class="flex flex-col">${col3}</div>
            <div class="flex flex-col">${col4}</div>
        `;
    } else {
        // Mode 16 Tim (6 Kolom Hibrida Presisi)
        let col1='', col2='', col3='', col4='', col5='', col6='';
        
        col1 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">Kualifikasi (Gugur)</div>`;
        [1,2,3,4,5,6,7,8].forEach(mo => col1 += getMatchBox(matches.find(m => m.match_order === mo)));
        
        col2 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">UB QF</div>`;
        [9,10,11,12].forEach(mo => col2 += getMatchBox(matches.find(m => m.match_order === mo)));
        col2 += `<div class="text-[9px] text-yellow-600 font-bold text-center mt-4 mb-2">Lower R1</div>`;
        [15,16].forEach(mo => col2 += getMatchBox(matches.find(m => m.match_order === mo)));

        col3 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">UB Semi Final</div>`;
        col3 += `<div class="h-8"></div>`;
        [13,14].forEach(mo => { col3 += getMatchBox(matches.find(m => m.match_order === mo)); col3 += `<div class="h-16"></div>`; });
        col3 += `<div class="text-[9px] text-yellow-600 font-bold text-center mt-2 mb-2">Lower R2</div>`;
        [17,18].forEach(mo => col3 += getMatchBox(matches.find(m => m.match_order === mo)));

        col4 += `<div class="text-[9px] text-theme-sub font-bold text-center mb-2">Upper Final</div>`;
        col4 += `<div class="h-24"></div>`;
        col4 += getMatchBox(matches.find(m => m.match_order === 20));
        col4 += `<div class="h-48"></div>`;
        col4 += `<div class="text-[9px] text-yellow-600 font-bold text-center mb-2">Lower Semi Final</div>`;
        col4 += getMatchBox(matches.find(m => m.match_order === 19));

        col5 += `<div class="text-[9px] text-yellow-600 font-bold text-center mb-2">Lower Final</div>`;
        col5 += `<div class="h-[380px]"></div>`; 
        col5 += getMatchBox(matches.find(m => m.match_order === 21));

        col6 += `<div class="text-[9px] text-yellow-400 font-bold text-center mb-2">Grand Final</div>`;
        col6 += `<div class="h-[240px]"></div>`; 
        col6 += getMatchBox(matches.find(m => m.match_order === 22));

        c.innerHTML = `
            <div class="flex flex-col">${col1}</div>
            <div class="flex flex-col">${col2}</div>
            <div class="flex flex-col">${col3}</div>
            <div class="flex flex-col">${col4}</div>
            <div class="flex flex-col">${col5}</div>
            <div class="flex flex-col">${col6}</div>
        `;
    }
}

// Khusus Owner
async function generateBracket() {
    if(!activeTournamentId) return;
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/tournament/generate_bracket', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ tournament_id: activeTournamentId }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert(d.message); openBracketModal(activeTournamentId, document.getElementById('bracketTourName').innerText, 'PLAYING'); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}

let reportMatchId = null;
function openMatchReport(matchId, sq1Id, sq1Name, sq2Id, sq2Name, roundName) {
    reportMatchId = matchId;
    document.getElementById('reportMatchName').innerText = roundName;
    const btn1 = document.getElementById('btnWinSq1'); const btn2 = document.getElementById('btnWinSq2');
    btn1.innerText = sq1Name; btn1.onclick = () => submitMatchReport(sq1Id);
    btn2.innerText = sq2Name; btn2.onclick = () => submitMatchReport(sq2Id);
    openModal('matchReportModal');
}

async function submitMatchReport(winnerId) {
    tg.MainButton.showProgress();
    try {
        const res = await fetch(API_BASE_URL + '/api/tournament/report_score', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': tg.initData || '', 'ngrok-skip-browser-warning': 'true'}, body: JSON.stringify({ match_id: reportMatchId, winner_squad_id: winnerId }) });
        const d = await res.json();
        if(res.ok) { tg.showAlert("Skor Divalidasi! Bagan Otomatis Terupdate."); closeModal('matchReportModal'); openBracketModal(activeTournamentId, document.getElementById('bracketTourName').innerText, 'PLAYING'); } else { tg.showAlert("Gagal: " + d.detail); }
    } catch(e) { tg.showAlert("Koneksi gagal."); }
    tg.MainButton.hideProgress();
}
