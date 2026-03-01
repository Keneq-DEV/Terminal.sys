// ==========================================
//    VARIABLES GLOBALES Y AUDIO
// ==========================================
const clickSnd = document.getElementById('snd-click');
const errorSnd = document.getElementById('snd-error');
const closeSnd = document.getElementById('snd-close');
const ambienceSnd = document.getElementById('snd-ambience');
const sequencer = document.getElementById('terminal-sequencer');

const musicTracks = [
    
];

// ==========================================
//    INICIALIZACIÓN (WINDOW LOAD)
// ==========================================
window.addEventListener('load', () => {
    // 1. Configurar volúmenes
    if (ambienceSnd) {
        ambienceSnd.volume = 0.3;
        ambienceSnd.play().catch(e => console.log("Autoplay bloqueado por el navegador"));
    }
    if (clickSnd) clickSnd.volume = 0.4;
    if (closeSnd) closeSnd.volume = 0.4;
    if (errorSnd) errorSnd.volume = 0.6;

    // 2. Iniciar Reloj
    updateClock();
    //setInterval(updateClock, 1000);

    // 3. Iniciar Música
    playRandomTrack();
});

// Respaldo para iniciar audio con clic si el autoplay falla
document.addEventListener('click', () => {
    if (sequencer && sequencer.paused) {
        sequencer.play();
    }
}, { once: true });


// ==========================================
//    SISTEMA DE MÚSICA
// ==========================================
function playRandomTrack() {
    if (musicTracks.length === 0) return;

    const randomIndex = Math.floor(Math.random() * musicTracks.length);
    const selectedTrack = musicTracks[randomIndex];

    sequencer.src = selectedTrack;
    sequencer.loop = true;
    sequencer.volume = 0.4;

    sequencer.play().catch(e => {
        console.log("El navegador bloqueó el autoplay. La música empezará al primer clic.");
    });

    console.log("Track cargado:", selectedTrack);
}


// ==========================================
//    NAVEGACIÓN Y MODALES
// ==========================================
function goToDashboard() {
    if (clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }

    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(m => {
        m.style.display = 'none';
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }
    
    modal.style.display = 'flex';
    modal.classList.remove('closing');
    modal.classList.add('opening');
    setTimeout(() => {
            modal.classList.remove('opening');
        }, 400);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (closeSnd) { closeSnd.currentTime = 0; closeSnd.play(); }

    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 300); // Sincronizado con tu animación CSS
}


// ==========================================
//    MOTOR DE CARPETAS (FETCH JSON)
// ==========================================
async function openFolderContent(folderId) {
    if (typeof clickSnd !== 'undefined') { clickSnd.currentTime = 0; clickSnd.play(); }

    generateUnitTechData();
    startIdScrambler(); // <--- Fuerza el reinicio del escáner al abrir carpeta

    const viewRoot = document.getElementById('view-root');
    const unitViewer = document.getElementById('unit-viewer');
    
    const currentActiveView = viewRoot.style.display === 'block' ? viewRoot : unitViewer;
    const nextView = (folderId === 'view-root' || folderId === 'main-explorer-root') ? viewRoot : unitViewer;

    // 1. Glitch de salida
    currentActiveView.classList.add('anim-closing');

    setTimeout(async () => {
        currentActiveView.style.display = 'none';
        currentActiveView.classList.remove('anim-closing');
        
        nextView.style.display = 'block';
        nextView.classList.add('anim-opening');

        if (nextView === unitViewer) {
            const grid = unitViewer.querySelector('.unit-grid');
            grid.innerHTML = '<p style="padding:20px; opacity:0.5;">DECRYPTING_DATA...</p>';
            
            try {
                const response = await fetch(`TERMINAL.DATA/UNITS.json?t=${new Date().getTime()}`);
                const data = await response.json();
                const botsList = data[folderId];

                if (botsList) {
                    grid.innerHTML = ''; // Limpiamos el mensaje de carga

                    // --- DETECCIÓN DE TEMAS PARA ESTRUCTURA DIFERENTE ---
                    const isLegacy = document.body.classList.contains('theme-legacy');
                    const isUnity = document.body.classList.contains('theme-unity');
                    const isDeus = document.body.classList.contains('theme-deus');
                    const isBridges = document.body.classList.contains('theme-bridges');
                    const isCyber = document.body.classList.contains('theme-cyber');

                    botsList.forEach(bot => {
                        let cardHTML = '';
                        const corruptedClass = bot.corrupted ? 'corrupted' : '';
                        const onClickAction = bot.corrupted 
                            ? `onclick="openModal('modal-error'); if(typeof errorSnd !== 'undefined'){errorSnd.currentTime=0;errorSnd.play();} return false;"` 
                            : '';
                        const hrefValue = bot.corrupted ? 'javascript:void(0)' : bot.link;
                        const targetValue = bot.corrupted ? '_self' : '_blank';

                        if (isCyber) {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}" data-id=":: SCANNING_LOCAL_NETWORK ::">
                            <!-- Los 4 cuadrantes del Glitch -->
                            <div class="cyber-quad q-tags">
                                <div class="unit-tags">
                                    ${bot.tags ? bot.tags.map(t => `<span class="tag-item t-${t.toLowerCase()}">${t}</span>`).join('') : ''}
                                </div>
                            </div>
                            <div class="cyber-quad q-name">
                                <span class="unit-name">${bot.id}</span>
                            </div>
                            <div class="cyber-quad q-image">
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link">
                                    <img src="${bot.img}">
                                </a>
                            </div>
                            <div class="cyber-quad q-info">
                                <p class="unit-desc"></p>
                            </div>
                        </div>`;
                        }


                        if (isBridges) {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}">
                                <!-- Sensor Odradek de Bridges -->
                                <div class="odradek-sensor"></div>
                                <div class="sonar-wave"></div>
                                
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link" ${onClickAction}>
                                    <img src="${bot.img}">
                                </a>
                                <div class="unit-info">
                                    <div class="uca-header">UCA_BIOMETRIC_DATA</div>
                                    <span class="unit-name">${bot.id}</span>
                                    <p class="unit-desc"></p>
                                    <div class="unit-tags">
                                        ${bot.tags ? bot.tags.map(t => `<span class="tag-item t-${t.toLowerCase()}">${t}</span>`).join('') : ''}
                                    </div>
                                    <div class="chiral-id">CHIRAL_ID: ${Math.random().toString(36).substring(7).toUpperCase()}</div>
                                </div>
                            </div>`;
                        }

                        if (isDeus) {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}">
                                <!-- Fragmentos geométricos de Deus Ex -->
                                <div class="shard-top"></div>
                                <div class="shard-bottom"></div>
                                
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link" ${onClickAction}>
                                    <img src="${bot.img}">
                                </a>
                                <div class="unit-info">
                                    <div class="aug-header">AUGMENTATION_DATA_LINK</div>
                                    <span class="unit-name">${bot.id}</span>
                                    <p class="unit-desc"></p>
                                    <div class="unit-tags">
                                        ${bot.tags ? bot.tags.map(t => `<span class="tag-item t-${t.toLowerCase()}">${t}</span>`).join('') : ''}
                                    </div>
                                </div>
                            </div>`;
                        }

                        // --- ESTRUCTURA TEMA LEGACY (CON PERSIANAS) ---
                        if (isLegacy) {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}">
                                <div class="shutter-l"></div>
                                <div class="shutter-r"></div>
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link" ${onClickAction}>
                                    <img src="${bot.img}">
                                </a>
                                <div class="unit-info">
                                    <span class="unit-name">${bot.id}</span>
                                    <p class="unit-desc"></p>
                                </div>
                            </div>`;
                        } 
                        // --- ESTRUCTURA TEMA UNITY (CON DOSSIER CENTRAL) ---
                        else if (isUnity) {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}">
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link" ${onClickAction}>
                                    <img src="${bot.img}">
                                </a>
                                <div class="unit-info">
                                    <div class="dossier-header">FILE</div>
                                    <span class="unit-name">${bot.id}</span>
                                    <p class="unit-desc"></p>
                                    <div class="unit-tags">
                                        ${bot.tags ? bot.tags.map(t => `<span class="tag-item t-${t.toLowerCase()}">${t}</span>`).join('') : ''}
                                    </div>
                                </div>
                            </div>`;
                        }
                        // --- ESTRUCTURA FRAGMENTED / DEFAULT (NORMAL) ---
                        else {
                            cardHTML = `
                            <div class="unit-card-wrapper ${corruptedClass}">
                                <a href="${hrefValue}" target="${targetValue}" class="unit-image-link" ${onClickAction}>
                                    <img src="${bot.img}">
                                </a>
                                <div class="unit-info">
                                    <span class="unit-name">${bot.id}</span>
                                    <p class="unit-desc"></p>
                                </div>
                            </div>`;
                        }

                        grid.insertAdjacentHTML('beforeend', cardHTML);
                    });

                    // Generar IDs técnicos para todos los bots inyectados
                    generateUnitTechData();
                }
            } catch (e) { console.error("Error en el flujo de datos.", e); }
        }

        const pathName = folderId.replace('view-', '').toUpperCase();
        const pathElement = document.getElementById('current-path');
        if (pathElement) {
            pathElement.innerText = `This PC > Local Disk (C:) > Units > ${folderId === 'view-root' ? '' : pathName}`;
        }

        setTimeout(() => {
            nextView.classList.remove('anim-opening');
        }, 400);

    }, 300);
}


// ==========================================
//    GENERADOR DE DATOS TÉCNICOS
// ==========================================
function generateUnitTechData() {
    // Lista auxiliar por si hay bots estáticos fuera del JSON que necesiten corrupción manual
    const corruptedUnitsNames = ["MAKO", "NEPHTHYS", "NEMESIS", "HUCKLE-BERRY"];

    document.querySelectorAll('.unit-card-wrapper').forEach(card => {
        const descElement = card.querySelector('.unit-desc');
        const unitNameElement = card.querySelector('.unit-name');

        if (unitNameElement && descElement) {
            const name = unitNameElement.innerText.trim();
            // Verificamos si ya tiene la clase por el JSON o si está en la lista manual
            const isCorrupted = card.classList.contains('corrupted') || corruptedUnitsNames.includes(name);

            // Generador HEX
            const n = () => Math.floor(Math.random() * 10);
            const l = () => "ABCDEFGIHJKNLOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
            const idHex = `#${n()}${l()}${n()}${l()}${n()}${l()}`;

            // Valores
            const status = isCorrupted ? "CORRUPTED" : "OPERATIONAL";
            const core = "V." + (Math.random() * 9 + 1).toFixed(1) + (Math.random() * 10).toFixed(3);
            const sync = isCorrupted ? "00%" : (Math.floor(Math.random() * 11) + 90) + "%";

            descElement.innerText = `ID_HEX: ${idHex} // STATUS: ${status} // CORE: ${core} // SYNC: ${sync}`;
        }
    });
}

// ==========================================
//    UTILIDADES DE INTERFAZ
// ==========================================
function toggleFullScreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

function setViewSize(sizeClass) {
    if (clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }

    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    if(window.event) window.event.target.classList.add('active');

    const allGrids = document.querySelectorAll('.explorer-grid, .unit-grid');
    allGrids.forEach(grid => {
        grid.classList.remove('size-s', 'size-m', 'size-l');
        grid.classList.add(sizeClass);
    });
}

function updateClock() {
    const clock = document.getElementById('clock');
    if (clock) clock.innerText = new Date().toLocaleTimeString('es-ES', { hour12: false });
}

// Función auxiliar de manager manual
function applySecurityProtocols() {
    const corruptedUnits = ["MAKO", "NEPHTHYS", "NEMESIS", "HUCKLE-BERRY"];
    
    document.querySelectorAll('.unit-card-wrapper').forEach(card => {
        const unitNameElement = card.querySelector('.unit-name');
        if (unitNameElement) {
            const name = unitNameElement.innerText.trim();
            const link = card.querySelector('.unit-image-link');
            
            if (corruptedUnits.includes(name)) {
                card.classList.add('corrupted');
                if (link) {
                    link.onclick = function(e) {
                        e.preventDefault();
                        if(errorSnd) { errorSnd.currentTime = 0; errorSnd.play(); }
                        openModal('modal-error');
                        return false;
                    };
                }
            }
        }
    });
}

// --- SISTEMA DE ARCHIVOS CLASIFICADOS ---

let allBotsCache = []; // Para no cargar el JSON cada vez

async function loadArchives() {
    if(clickSnd) clickSnd.play();
    
    // 1. Cargar JSON y aplanar la lista (sacar bots de las carpetas)
    const response = await fetch(`TERMINAL.DATA/UNITS.json?t=${new Date().getTime()}`);
    const data = await response.json();
    
    allBotsCache = [];
    // Recorremos todas las categorías para hacer una sola lista
    Object.values(data).forEach(list => {
        allBotsCache = allBotsCache.concat(list);
    });

    // 2. Llenar la barra lateral
    const listContainer = document.getElementById('archive-list');
    listContainer.innerHTML = '';
    
    allBotsCache.forEach((bot, index) => {
        const item = document.createElement('div');
        item.className = 'archive-item';
        item.innerText = `> ${bot.id}`;
        item.onclick = () => showDossier(index);
        listContainer.appendChild(item);
    });
}

function showDossier(index) {
    if(clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }

    const bot = allBotsCache[index];
    const placeholder = document.getElementById('dossier-placeholder');
    const content = document.getElementById('dossier-content');
    
    // Switch de vista
    placeholder.style.display = 'none';
    content.style.display = 'block';
    
    // Llenar Datos
    document.getElementById('dos-name').innerText = bot.id;
    document.getElementById('dos-org').innerText = bot.org || "UNKNOWN ORIGIN";
    document.getElementById('dos-desc').innerText = bot.desc || "No data available.";
    
    // Estado
    const statusEl = document.getElementById('dos-status');
    if(bot.corrupted) {
        statusEl.innerText = "STATUS: CORRUPTED";
        statusEl.style.borderColor = "var(--rojo-error)";
        statusEl.style.color = "var(--rojo-error)";
    } else {
        statusEl.innerText = "STATUS: ONLINE";
        statusEl.style.borderColor = "var(--verde-base)";
        statusEl.style.color = "var(--verde-base)";
    }

    // Tags con clases dinámicas
    const tagsContainer = document.getElementById('dos-tags');
    tagsContainer.innerHTML = '';
    if(bot.tags) {
        bot.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = `tag-badge tag-${tag.toLowerCase()}`; // ej: tag-horror
            span.innerText = tag;
            tagsContainer.appendChild(span);
        });
    }

    // Galería
    const mainImg = document.getElementById('dos-main-img');
    const thumbsContainer = document.getElementById('dos-thumbnails');
    
    // Imagen principal
    mainImg.src = bot.img;
    
    // Miniaturas (Imagen base + Galería extra)
    thumbsContainer.innerHTML = '';
    
    // Array con todas las imagenes (Base + Extras)
    let images = [bot.img];
    if(bot.gallery) images = images.concat(bot.gallery);

    images.forEach(imgUrl => {
        const thumb = document.createElement('img');
        thumb.src = imgUrl;
        thumb.className = 'thumb-img';
        thumb.onclick = () => {
            mainImg.src = imgUrl; // Cambiar imagen grande al click
            if(clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }
        };
        thumbsContainer.appendChild(thumb);
    });

    // --- LÓGICA DE ARTISTA ---
    const orgElement = document.getElementById('dos-org');

    if (bot.org_link) {
        // SI TIENE LINK: Crea el enlace usando el nombre como texto
        orgElement.innerHTML = `<a href="${bot.org_link}" target="_blank" class="artist-link">${bot.org}</a>`;
    } else {
        // SI NO TIENE LINK: Pone solo el texto plano
        orgElement.innerText = bot.org || "UNKNOWN ORIGIN";
    }
}




/* ===================================================
   SISTEMA DE TEMAS Y AUDIO AVANZADO
   =================================================== */

// CONFIGURACIÓN DE LOS TEMAS Y SUS PLAYLISTS
// Asegúrate de que los archivos de audio existan en TERMINAL.Audio/
const systemThemes = [
    {
        name: "FRAGMENTED",
        className: "default",
        version: "2.0",
        background: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExajZrZHplYjBibjZweXFyZWJqYmRwcnBqcTJjMHZheW44amRzeWNrbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aedHplWQULpK3EtL0e/giphy.gif",
        folder: "Fragmented", // Carpeta: TERMINAL.Audio/Fragmented/
        tracks: [
            "Trauma.mp3", 
            "Login.mp3"
        ]
    },

    {
        name: "LEGACY",
        className: "theme-legacy",
        version: "3.5",
        background: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2MwOGJsZTI3eGttZmhpcnc1ejhocG9uM2Y5bWpid3lkcGE4ZTRscCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aITBZMqp5oa1eoIday/giphy.gif",
        folder: "Legacy", // Carpeta: TERMINAL.Audio/Legacy/
        tracks: [
            "Alters.mp3", 
            "Rapidium.mp3",
            "Alters Life.mp3",
            "Circles.mp3",
            "Magnetic Storm.mp3"
        ]
    },

    {
        name: "UNITY",
        className: "theme-unity",
        version: "5.1",
        background: "TERMINAL.Images/gameplay.webp",
        folder: "Unity", // Carpeta: TERMINAL.Audio/Unity/
        tracks: [
            "Unity.mp3", 
            "The world outside.mp3",
            "Base control.mp3",
            "Not a single soul left.mp3",
            "914.mp3",
            "Rock room.mp3"
        ]
    },

    {
        name: "DEUS",
        className: "theme-deus",
        version: "7.7",
        background: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/daf1bb7d-a169-4d23-9c87-d366dd55c308/d5m9i1v-35a83177-46f2-412f-b148-4faabdfd0eeb.gif?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi9kYWYxYmI3ZC1hMTY5LTRkMjMtOWM4Ny1kMzY2ZGQ1NWMzMDgvZDVtOWkxdi0zNWE4MzE3Ny00NmYyLTQxMmYtYjE0OC00ZmFhYmRmZDBlZWIuZ2lmIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.V-LReT9eueKlKuCTe6L47Vz1faBg13IyCqXzq_ANDKg",
        folder: "Deus", // Carpeta: TERMINAL.Audio/Deus/
        tracks: [
            "Main Menu.mp3",
            "Home.mp3",
            "Hung Hua Brothel.mp3",
            "Icarus.mp3",
            "Namir.mp3",
            "Endings.mp3",
            "Opening Credits.mp3"
            
        ]
    },

    {
        name: "EX",
        className: "theme-ex",
        version: "9.9",
        background: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2F2cnJzbmJtN3dvdTc5ZHBvdnAxaGYydDltaTAwNW9pZHF5OHdpcCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VeWkxETRDSWJcgRTLQ/giphy.gif",
        folder: "Ex", // Carpeta: TERMINAL.Audio/Ex/
        tracks: [
            "Cargo.mp3",
            "Delta Integrale E.mp3",
            "Passenger seat.mp3", 
            
        ]
    },

    {
        name: "BRIDGES",
        className: "theme-bridges",
        version: "11.11",
        background: "https://media1.tenor.com/m/hL4Z2AmhBkAAAAAd/death-stranding-hideo-kojima.gif",
        folder: "Bridges", // Carpeta: TERMINAL.Audio/Bridges/
        tracks: [
            "Bridges.mp3",
            "Sleep.mp3",
            "BB-Theme.mp3",
            "Tonight, Tonight, Tonight.mp3",
            "Dead Man.mp3",
            "John.mp3",
            "Cargohigh.mp3",
            "Cargo High.ogg"


        ]
    },
    {

        name: "CYBERPUNK",
        className: "theme-cyber",
        version: "13.13",
        background: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3BsdWxoMW1icGJ4anFjNTcyNDJ2Nnp2NGIyOHpucTEwcWN1cDBsZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JTheOT8fz6vMzQeFmB/giphy.gif",
        folder: "Cyberpunk", // Carpeta: TERMINAL.Audio/Cyberpunk/
        tracks: [
            "V.mp3",
            "The Rebel Path.mp3",
            "Rite Of Passage.mp3",
            "The Sacred And The Profane.mp3",
            "Been Good To Know Ya.mp3",
            "I Really Want to Stay at Your House.mp3",
            "Never Fade Away (SAMURAI Cover).mp3",
            "Phantom Liberty.mp3"
            
        ]
    }

];

let currentThemeIndex = 0;

// --- INICIALIZACIÓN ---
window.onload = function() {
    // 1. Cargar tema guardado
    const savedThemeName = localStorage.getItem('nightdrive_theme');
    if (savedThemeName) {
        // Buscar el índice del tema guardado
        const foundIndex = systemThemes.findIndex(t => t.name === savedThemeName);
        if (foundIndex !== -1) currentThemeIndex = foundIndex;
    }

    // 2. Aplicar el tema sin animación (carga inicial)
    applyTheme(false);

    // 3. Configurar volumen
    if (sequencer) sequencer.volume = 0.3;
    
    // 4. Iniciar reloj
    updateClock();
    //setInterval(updateClock, 1000);
};


// --- FUNCIÓN DE CAMBIO DE TEMA (BOTÓN) ---
// --- NUEVO SISTEMA DE MENÚ DESPLEGABLE ---

// 1. Abrir / Cerrar el menú
function toggleThemeMenu() {
    // Sonido click
    if(document.getElementById('snd-click')) { 
        document.getElementById('snd-click').currentTime=0; 
        document.getElementById('snd-click').play(); 
    }

    const menu = document.getElementById('theme-menu');
    menu.classList.toggle('show');
}

// 2. Elegir un tema específico
function selectSpecificTheme(index) {
    // Si elegimos el mismo que ya está, solo cerramos y salimos
    if (index === currentThemeIndex) {
        document.getElementById('theme-menu').classList.remove('show');
        return;
    }

    // Actualizamos el índice
    currentThemeIndex = index;
    
    // Aplicamos el tema (con animación glitch)
    applyTheme(true);
    
    // Cerramos el menú
    document.getElementById('theme-menu').classList.remove('show');
}

// 3. Cerrar el menú si haces clic fuera (Mejora de UX)
window.onclick = function(event) {
    if (!event.target.matches('.theme-switcher-btn')) {
        const dropdowns = document.getElementsByClassName("theme-dropdown");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

// --- FUNCION CORRECTORA DE CLASES (LIMPIEZA TOTAL) ---
function setBodyClass(className) {
    // 1. Buscamos todas las clases que tiene el body actualmente
    const currentClasses = Array.from(document.body.classList);
    
    // 2. Filtramos y eliminamos CUALQUIER clase que empiece con "theme-"
    currentClasses.forEach(c => {
        if (c.startsWith('theme-')) {
            document.body.classList.remove(c);
        }
    });

    // 3. Si el nuevo tema no es el de por defecto (Fragmented), añadimos la clase
    if (className !== 'default' && className !== '') {
        document.body.classList.add(className);
    }
    
    console.log("Sistema purgado. Clase actual:", document.body.className || "default");
}

// --- ACTUALIZACIÓN DE LA FUNCIÓN APPLYTHEME (Para el Glitch) ---
function applyTheme(animate) {
    const theme = systemThemes[currentThemeIndex];
    const transitionLayer = document.getElementById('theme-transition-layer');
    const bgElement = document.getElementById('profile-gif-bg');
    const vidElement = document.getElementById('profile-video-bg'); // Referencia al video

    // Función interna para decidir si mostrar Video o Imagen
    const updateBackground = (url) => {
        if (!url) return;
        
        if (url.endsWith('.mp4')) {
            // Es un VIDEO
            if (bgElement) bgElement.style.display = 'none';
            if (vidElement) {
                vidElement.style.display = 'block';
                vidElement.src = url;
                vidElement.play();
            }
        } else {
            // Es un GIF/Imagen
            if (vidElement) {
                vidElement.pause();
                vidElement.style.display = 'none';
            }
            if (bgElement) {
                bgElement.style.display = 'block';
                bgElement.src = url;
            }
        }
    };

    if (animate) {
        transitionLayer.classList.add('active');
        
        setTimeout(() => {
            setBodyClass(theme.className);
            
            const versionSpan = document.getElementById('sys-version');
            if (versionSpan) {
                const letter = theme.name.charAt(0).toUpperCase();
                versionSpan.innerText = `v${theme.version}-${letter}`;
            }
            
            const btn = document.getElementById('theme-btn');
            if (btn) btn.innerText = `[ THEME: ${theme.name} ] ▼`;

            if (theme.name === "EX") {
                if (typeof VFX_ENGINE !== 'undefined') VFX_ENGINE.start();
            } else {
                if (typeof VFX_ENGINE !== 'undefined') VFX_ENGINE.stop();
            }

            // CAMBIO DE FONDO INTELIGENTE
            updateBackground(theme.background);

            changeMusic(theme);
        }, 250);

        setTimeout(() => { transitionLayer.classList.remove('active'); }, 600);
    } else {
        setBodyClass(theme.className);
        
        const versionSpan = document.getElementById('sys-version');
        if (versionSpan) {
            const letter = theme.name.charAt(0).toUpperCase();
            versionSpan.innerText = `v${theme.version}-${letter}`;
        }
        
        const btn = document.getElementById('theme-btn');
        if (btn) btn.innerText = `[ THEME: ${theme.name} ] ▼`;

        if (theme.name === "EX") {
                if (typeof VFX_ENGINE !== 'undefined') VFX_ENGINE.start();
            } else {
                if (typeof VFX_ENGINE !== 'undefined') VFX_ENGINE.stop();
            }

    
        // CAMBIO DE FONDO INICIAL
        updateBackground(theme.background);
        
        changeMusic(theme);
    }

    localStorage.setItem('nightdrive_theme', theme.name);
    updateMusicMenu(); 
    
    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) musicBtn.innerText = `[ MUSIC: SELECT_TRACK ] ▼`;
}




// Auxiliar: Texto del Botón
function updateButtonText(name) {
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerText = `[ THEME: ${name} ]`;
}

// Auxiliar: Motor de 
function changeMusic(theme) {
    if (!theme.tracks || theme.tracks.length === 0) return;

    // Elegir canción al azar
    const randomTrack = theme.tracks[Math.floor(Math.random() * theme.tracks.length)];
    
    // CONSTRUCCIÓN DE RUTA CORREGIDA:
    // TERMINAL.Audio / NombreCarpeta / NombreArchivo
    const path = `TERMINAL.Audio/${theme.folder}/${randomTrack}`;

    sequencer.src = path;
    sequencer.loop = true;
    sequencer.play().catch(e => console.log("Audio esperando interacción."));
    
    console.log("Reproduciendo:", path); // Para que verifiques en consola si la ruta está bien
}


function toggleMusicMenu() {
    if(clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }
    const menu = document.getElementById('music-menu');
    menu.classList.toggle('show');
}

// Esta función llena el menú con las canciones del tema actual
function updateMusicMenu() {
    const theme = systemThemes[currentThemeIndex];
    const menu = document.getElementById('music-menu');
    const musicBtn = document.getElementById('music-btn');
    
    if (!menu) return;

    menu.innerHTML = ''; // Limpiar lista vieja

    theme.tracks.forEach((track, index) => {
        // Quitamos la extensión (.mp3, .wav) para el nombre visual
        const trackName = track.split('.').slice(0, -1).join('.');
        
        const option = document.createElement('div');
        option.className = 'theme-option';
        option.innerText = `> ${trackName}`;
        option.onclick = () => {
            selectSpecificTrack(track, trackName);
            menu.classList.remove('show');
        };
        menu.appendChild(option);
    });
}

function selectSpecificTrack(filename, displayName) {
    if(clickSnd) { clickSnd.currentTime = 0; clickSnd.play(); }
    
    const theme = systemThemes[currentThemeIndex];
    const path = `TERMINAL.Audio/${theme.folder}/${filename}`;
    
    // Cambiar audio
    sequencer.src = path;
    sequencer.loop = true;
    sequencer.play().catch(e => console.log("Permiso de audio requerido"));

    // Actualizar texto del botón
    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) musicBtn.innerText = `[ MUSIC: ${displayName} ] ▼`;
    
    // Guardar preferencia de canción si quieres (opcional)
    localStorage.setItem('nightdrive_last_track', filename);
    localStorage.setItem('nightdrive_last_track_name', displayName);
}

function closeDashboard() {
    // 1. Sonido de cierre
    if (typeof closeSnd !== 'undefined') {
        closeSnd.currentTime = 0;
        closeSnd.play();
    }
    
    // 2. Ocultar el contenedor del Dashboard
    const dashboard = document.querySelector('.dashboard-container');
    if (dashboard) {
        dashboard.style.display = 'none';
    }
}


function startIdScrambler() {
    setInterval(() => {
        // Buscamos los elementos DENTRO del intervalo para encontrar los nuevos bots del JSON
        const activeCards = document.querySelectorAll('.unit-card-wrapper');
        const isBridges = document.body.classList.contains('theme-bridges');
        

        activeCards.forEach(card => {
            if (isBridges) {
                // Generar coordenadas para Bridges
                const lat = (Math.random() * 90).toFixed(3);
                const lon = (Math.random() * 180).toFixed(3);
                // IMPORTANTE: Escribimos en 'data-scan'
                card.setAttribute('data-scan', `[SCAN_COORD:${lat} / ${lon}]`);
            } else {
                // GENERADOR PARA OTROS (Hexadecimal)
                const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
                const letter = "ABCDEFGIHJKNLOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
                // ESCRIBIMOS EN EL ATRIBUTO: data-id
                card.setAttribute('data-id', `${hex}${letter}`);
            }
            // --- HE ELIMINADO LA LÍNEA QUE SOBREESCRIBÍA TODO AQUÍ ---
        });
    }, 150);
}

// Iniciar el scrambler al cargar la página
window.addEventListener('load', startIdScrambler);
