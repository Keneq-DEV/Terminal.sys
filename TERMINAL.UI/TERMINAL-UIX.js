// ==========================================
//    CONFIGURACIÓN DE TEMA Y VARIABLES GLOBALES
// ==========================================
const UIX = [
    {
        name: "NONE",
        version: "NONE",
        background: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3I0Mm5scnVzcHp1dzFmc2ZqdzRveHU0dmQxeXA2cHZsZTM2em9rNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6vXRxrhj7Ov94Gbu/giphy.gif",
        folder: "User",
        color_theme: "",
        duration: 15,
        tracks: [
            ""
        ]
    }
];

const SYSTEM_SOUNDS = {
    snd_open: new Audio("TERMINAL.Audio/terminal_click2.mp3"),
    snd_click: new Audio("TERMINAL.Audio/terminal_click.mp3"),
    snd_close: new Audio("TERMINAL.Audio/terminal_off2.mp3"),
    snd_error: new Audio("TERMINAL.Audio/error.wav"),
    snd_launch: new Audio("TERMINAL.Audio/launch.wav"),
    snd_pickup_drive: new Audio("TERMINAL.Audio/Sfx/pick_generic_small1.mp3"),
    snd_insert_drive: new Audio("TERMINAL.Audio/Sfx/08_card_in1.mp3"),
    snd_remove_drive: new Audio("TERMINAL.Audio/Sfx/08_card_out1.mp3"),
    snd_slide_drive: new Audio("TERMINAL.Audio/Sfx/interact_insert_cd1.mp3"),
    snd_sequence_boot: new Audio("TERMINAL.Audio/Sfx/sequence_boot.mp3"),
    snd_format: new Audio("TERMINAL.Audio/Sfx/08_format_fail1.mp3"),
    snd_ambience: new Audio("TERMINAL.Audio/Sfx/08_amb1.mp3"),
    snd_typing: Array.from({length: 8}, (_, i) => new Audio(`TERMINAL.Audio/Sfx/gui_type${i + 1}.mp3`)),
    snd_terminal_purge_data: new Audio("TERMINAL.Audio/Sfx/terminal_purge.mp3"),
    snd_terminal_trans: Array.from({length: 2}, (_, i) => new Audio(`TERMINAL.Audio/Sfx/gui_trans_${i + 1}.mp3`))
};

// Referencia dinámica al reproductor
let sequencer = document.getElementById('terminal-sequencer');
function getSequencer() { if (!sequencer) sequencer = document.getElementById('terminal-sequencer'); return sequencer; }

// Variables para el analizador de audio real
let audioCtx, analyser, dataArray, source;
let isAudioConnected = false;

// Persistencia Playground (Base de Datos Real)
const DB_NAME = "KeneqPlaygroundDB";
const DB_VERSION = 1;
let db;
const playgroundNames = new Map();
let pendingPurge = null;
let wheelImageData = null; // Caché para redibujado instantáneo del indicador

const isMobileDevice = window.innerWidth <= 900;

let visFFT = isMobileDevice ? 32 : 128; // Resolución mínima en móvil para evitar lag
let visBarWidth = 0.6; // Grosor: de 0.1 a 1.0 (Menos es más delgado)
let visBarGap = 2;     // Espaciado: píxeles entre barras

// Control de Volumen Maestro
let musicVol = 0.4;
let sfxVol = 0.8;
let ambienceVol = 0.3;
let bootSpeedMultiplier = 1.0;

// --- INFRAESTRUCTURA DE SISTEMA DE ARCHIVOS REAL ---
let currentTerminalPath = "C:\\ROOT\\TERMINAL";
let inUnfragmentedView = false;

const ARCHIVE_VFS = {
    "C:\\ROOT\\TERMINAL": { dirs: ["SYSTEM", "LOGS", "SECURITY", "HARDWARE"], files: [] },
    "C:\\ROOT\\TERMINAL\\SYSTEM": { dirs: ["DUMPS"], files: ["unfragmented.kbin"] },
    "C:\\ROOT\\TERMINAL\\SYSTEM\\DUMPS": { dirs: [], files: ["sys_dump.log"] },
    "C:\\ROOT\\TERMINAL\\SYSTEM\\manifest_reconstructed.kbin\\RECONSTRUCTED": { dirs: [], files: [] },
    "C:\\ROOT\\TERMINAL\\LOGS": { dirs: ["OPERATOR", "PROJECTS"], files: [] },
    "C:\\ROOT\\TERMINAL\\LOGS\\OPERATOR": { dirs: [], files: ["encrypted_memo.txt"] },
    "C:\\ROOT\\TERMINAL\\LOGS\\PROJECTS": { dirs: [], files: ["project_neven.log"] },
    "C:\\ROOT\\TERMINAL\\SECURITY": { dirs: [], files: ["vault_key.kbin"] },
    "C:\\ROOT\\TERMINAL\\HARDWARE": { dirs: [], files: ["neural_interface.bin"] }
};

const ALL_FILE_LOCATIONS = {
    'unfragmented.kbin': 'C:\\ROOT\\TERMINAL\\SYSTEM',
    'encrypted_memo.txt': 'C:\\ROOT\\TERMINAL\\LOGS\\OPERATOR',
    'sys_dump.log': 'C:\\ROOT\\TERMINAL\\SYSTEM\\DUMPS',
    'neural_interface.bin': 'C:\\ROOT\\TERMINAL\\HARDWARE',
    'vault_key.kbin': 'C:\\ROOT\\TERMINAL\\SECURITY',
    'project_neven.log': 'C:\\ROOT\\TERMINAL\\LOGS\\PROJECTS',
    'manifest_reconstructed.kbin': 'C:\\ROOT\\TERMINAL\\SYSTEM'
};

function getArchiveVFS() { return ARCHIVE_VFS; }
function getAllFileLocations() { return ALL_FILE_LOCATIONS; }
function getManifestName() { return "NEURAL_MANIFEST_RECONSTRUCTED"; }

// Lista de pistas vinculada dinámicamente a tu objeto UIX
const musicTracks = UIX[0].tracks || [];

// Control de colores del operador
let selectedColors = {
    name: "#ffffff",
    symbol: "#ff8c00",
    number: "#007aff"
};
let activeColorTarget = "name";

// Lógica de seguridad para el bloqueo de 30 días
const ENABLE_SECURITY_LOCK = true; 
const LOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000; 


// ==========================================
//    RELOJ DEL SISTEMA (TIME ENGINE)
// ==========================================
function initSystemClock() {
    const clockElement = document.getElementById('ui-clock');
    if (!clockElement) return;

    const update = () => {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
    };

    setInterval(update, 1000);
    update();
}

// MOTOR DE AUDIO: TECLEO MECÁNICO ALEATORIO
function playTypingSound() {
    const sounds = SYSTEM_SOUNDS.snd_typing;
    if (!sounds || sounds.length === 0) return;
    const rand = sounds[Math.floor(Math.random() * sounds.length)];
    rand.currentTime = 0;
    rand.volume = sfxVol;
    rand.play().catch(e => {});
}


// ==========================================
//    MOTOR DE EVENT LOG (CONEXIÓN REAL)
// ==========================================
function pushLog(message, status = "OK") {
    const container = document.getElementById('log-stream');
    if (!container) return;

    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });

    const logLine = document.createElement('div');
    logLine.className = 'log-entry';
    logLine.innerHTML = `
        <span class="log-text">${time} &nbsp; > &nbsp; ${message}</span>
        <span class="log-status">[ ${status} ]</span>
    `;

    container.appendChild(logLine);

    if (container.children.length > 14) {
        container.removeChild(container.firstChild);
    }
    container.scrollTop = container.scrollHeight;
}

function startSystemBoot() {
    const bootSteps = [
        { msg: "SYSTEM BOOT", stat: "OK", delay: 500 },
        { msg: "NETWORK LINK", stat: "STABLE", delay: 1200 },
        { msg: "NODE 13-A7 SYNC", stat: "OK", delay: 2000 },
        { msg: "ACQUIRING SIGNAL", stat: "0%", delay: 2500 },
        { msg: "ACQUIRING SIGNAL", stat: "24%", delay: 3800 },
        { msg: "ACQUIRING SIGNAL", stat: "51%", delay: 5200 },
        { msg: "ACQUIRING SIGNAL", stat: "76%", delay: 6800 },
        { msg: "ACQUIRING SIGNAL", stat: "92%", delay: 8500 },
        { msg: "ACQUIRING SIGNAL", stat: "97%", delay: 9200 },
        { msg: "SIGNAL ACQUIRED", stat: "100%", delay: 10000 },
        { msg: "DECRYPTING STREAM", stat: "OK", delay: 11500 },
        { msg: "FEED STABILIZED", stat: "OK", delay: 13000 },
        { msg: "ANALYZING PATTERNS", stat: "...", delay: 15000 },
        { msg: "CONNECTED", stat: "ESTABLISHED", delay: 17500 }
    ];

    bootSteps.forEach(step => {
        setTimeout(() => pushLog(step.msg, step.stat), step.delay);
    });
}

document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BODY' || e.target.tagName === 'VIDEO' || e.target.id === 'ui-clock') return;

    let actionName = e.target.innerText || e.target.tagName;
    actionName = actionName.split('\n')[0].trim().split(' ')[0].substring(0, 12).toUpperCase();

    // SISTEMA DE AUDIO UNIFICADO:
    // El click global solo suena si NO estamos abriendo/cerrando ventanas (que tienen sus propios sonidos)
    const isWindowAction = e.target.closest('[onclick*="Modal"], .win-close-btn');
    if (SYSTEM_SOUNDS.snd_click && !isWindowAction) {
        SYSTEM_SOUNDS.snd_click.currentTime = 0;
        SYSTEM_SOUNDS.snd_click.play().catch(e => {});
    }

    if (actionName && actionName !== "STABLE") {
        pushLog(`USER_INPUT: ${actionName}`, "EXEC");
    }
});


// ==========================================
//    SISTEMA DE MÚSICA
// ==========================================
function playRandomTrack() {
    const playlist = SYSTEM_PLAYLISTS["NONE"];
    if (!playlist || playlist.tracks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * playlist.tracks.length);
    playSelectedDiscTrack(randomIndex, "NONE");
}

function updateMusicVolume(val) {
    musicVol = parseFloat(val);
    const player = getSequencer();
    if (player) player.volume = musicVol;
    
    const label = document.getElementById('txt-vol-music');
    if (label) label.innerText = Math.round(musicVol * 100) + "%";
    localStorage.setItem('keneq_vol_music', musicVol);
}

function updateSFXVolume(val) {
    sfxVol = parseFloat(val);
    // Aplicar a todos los sonidos de efectos conocidos (excepto ambiente)
    Object.keys(SYSTEM_SOUNDS).forEach(key => {
        const snd = SYSTEM_SOUNDS[key];
        if (snd instanceof Audio && key !== 'snd_ambience') {
            snd.volume = sfxVol;
        } else if (Array.isArray(snd)) {
            // Sincronizar volumen de la matriz de tecleo
            snd.forEach(s => { if (s instanceof Audio) s.volume = sfxVol; });
        }
    });

    const label = document.getElementById('txt-vol-sfx');
    if (label) label.innerText = Math.round(sfxVol * 100) + "%";
    localStorage.setItem('keneq_vol_sfx', sfxVol);
}

function updateAmbienceVolume(val) {
    ambienceVol = parseFloat(val);
    // Controlar el GainNode del Web Audio API si existe
    if (ambienceGainNode && audioCtx) {
        ambienceGainNode.gain.setTargetAtTime(ambienceVol, audioCtx.currentTime, 0.05);
    }
    const label = document.getElementById('txt-vol-ambience');
    if (label) label.innerText = Math.round(ambienceVol * 100) + "%";
    localStorage.setItem('keneq_vol_ambience', ambienceVol);
}

function updateBootSpeed(val) {
    bootSpeedMultiplier = parseFloat(val);
    const label = document.getElementById('txt-vol-boot-speed');
    const slider = document.getElementById('vol-boot-speed');
    if (label) {
        label.innerText = bootSpeedMultiplier.toFixed(1) + "x";
    }
    localStorage.setItem('keneq_boot_speed', bootSpeedMultiplier);
}

let ambienceSource = null;
let ambienceGainNode = null;
let isAmbienceLoading = false;
let musicPaused = localStorage.getItem('keneq_music_paused') === 'true';
let musicUnlocked = false; // Evita que el mousedown global compita con los botones manuales

// Manejador global para desbloquear el audio
window.addEventListener('mousedown', (e) => {
    // 1. Unificar el desbloqueo del contexto de audio
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // 2. El Sequencer (Música)
    // Solo forzamos play si NO estamos pulsando un control de música, para evitar el bucle play/pause
    const isControl = e.target.closest('.disc-controls') || e.target.closest('.playlist-track') || e.target.closest('.audio-controls');
    const player = getSequencer();
    if (player && player.src && !musicUnlocked && !isControl) {
        if (!musicPaused && player.paused) {
            player.play().then(() => { musicUnlocked = true; }).catch(e => {});
        } else {
            musicUnlocked = true;
        }
    }

    // --- PROTOCOLO DE AMBIENTE GAPLESS (WEB AUDIO API) ---
    if (!ambienceSource && !isAmbienceLoading) {
        isAmbienceLoading = true;

        fetch("TERMINAL.Audio/Sfx/08_amb1.mp3")
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                ambienceSource = audioCtx.createBufferSource();
                ambienceSource.buffer = audioBuffer;
                ambienceSource.loop = true; // Looping matemático perfecto

                ambienceGainNode = audioCtx.createGain();
                ambienceGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

                ambienceSource.connect(ambienceGainNode);
                ambienceGainNode.connect(audioCtx.destination);

                ambienceSource.start(0);
                // Fade-in técnico de 2 segundos
                ambienceGainNode.gain.linearRampToValueAtTime(ambienceVol, audioCtx.currentTime + 2);
            })
            .catch(e => console.error("GAPLESS_LOOP_FAILURE:", e));
    }

    // Intentar inicializar el visualizador si no está conectado
    if (!isAudioConnected) initMusicVisualizer();
}, { once: false }); // Permitimos múltiples intentos si el primero falla por 404


// ==========================================
//    CINTA DE FRAGMENTOS (MEMORY FRAGMENTS)
// ==========================================
function generateFragmentTape() {
    const tape = document.getElementById('frag-tape');
    if (!tape) return;

    const bgSource = UIX[0].background;
    tape.innerHTML = ''; 

    const totalFragments = UIX[0].duration || 12; 

    const header = document.querySelector('.frag-header');
    if (header) {
        header.innerText = `${totalFragments} FRAGMENTS RECOVERED`;
    }

    for (let i = 0; i < totalFragments; i++) {
        const frame = document.createElement('div');
        frame.className = 'f-box';
        frame.style.backgroundImage = `url(${bgSource})`;
        
        const labelNum = i < 10 ? `0${i}` : i;
        frame.setAttribute('data-label', `FRG_${labelNum}`);
        
        tape.appendChild(frame);
    }

    tape.innerHTML += tape.innerHTML;
}


// ==========================================
//    MOTOR DE CARGA: LIVE FEED (GIF / WEBP)
// ==========================================
function initLiveFeed() {
    const viewport = document.querySelector('.feed-viewport');
    if (!viewport) return;

    const bgSource = UIX[0].background;
    if (!bgSource) return;

    const bgImg = document.createElement('img');
    bgImg.id = 'ui-image-bg';
    bgImg.src = bgSource;

    bgImg.style.position = 'absolute';
    bgImg.style.top = '0';
    bgImg.style.left = '0';
    bgImg.style.width = '100%';
    bgImg.style.height = '100%';
    bgImg.style.objectFit = 'cover';
    bgImg.style.zIndex = '-1'; 
    bgImg.style.opacity = '0.35'; 
    bgImg.style.filter = 'brightness(0.8) contrast(1.2)';

    viewport.prepend(bgImg);
}


// ===================================================
//    MONITOR BIOMÉTRICO (GAUSSIANO OPTIMIZADO)
// ===================================================
function initBioMonitor() {
    const canvas = document.getElementById('canvas-bio');
    const bpmDisplay = document.querySelector('.bpm-num');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const width = canvas.width;
    const height = canvas.height;
    const speed = 2; 
    const centerY = height / 2;
    
    let x = 0; 
    let lastY = centerY;
    let time = 0;
    let lastTime = performance.now();
    let heartRate = 72; 

    function getECGValue(t) {
        const cycle = t % 100; 
        const p = 0.15 * Math.exp(-Math.pow((cycle - 20) / 2.5, 2));
        const q = -0.1 * Math.exp(-Math.pow((cycle - 32) / 1.5, 2));
        const r = 1.8 * Math.exp(-Math.pow((cycle - 36) / 1.2, 2)); 
        const s = -0.2 * Math.exp(-Math.pow((cycle - 40) / 1.5, 2));
        const tWave = 0.25 * Math.exp(-Math.pow((cycle - 60) / 6, 2));
        const noise = (Math.random() - 0.5) * 0.05;

        return (p + q + r + s + tWave + noise) * (height / 2.8);
    }

    function animate(currentTime) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        time += (deltaTime / 1000) * (heartRate / 60) * 100; 
        const styles = getComputedStyle(document.documentElement);
        const themeColor = styles.getPropertyValue('--main').trim() || "#007aff";
        const bgColor = styles.getPropertyValue('--bg-black').trim() || "#080a0e";

        // RESET DE SOMBRA OBLIGATORIO ANTES DE LIMPIAR (Evita niebla azul)
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";

        ctx.fillStyle = bgColor; 
        ctx.fillRect(x, 0, speed + 5, height);

        // Dibujar línea
        ctx.beginPath();
        ctx.strokeStyle = themeColor; 
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 4; 
        ctx.shadowColor = themeColor;
        
        ctx.moveTo(x, lastY);
        
        const yVal = getECGValue(time);
        const newY = centerY - yVal; 
        
        ctx.lineTo(x + speed, newY);
        ctx.stroke();

        // Brillo en la punta
        ctx.fillStyle = themeColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = themeColor;
        ctx.beginPath();
        ctx.arc(x, newY, 2, 0, Math.PI * 2);
        ctx.fill();

        lastY = newY;
        x += speed;

        if (x > width) {
            x = 0;
            ctx.moveTo(0, newY);
        }

        if (Math.random() < 0.005) {
            heartRate = 69 + Math.random() * 7; 
            if (bpmDisplay) bpmDisplay.innerText = Math.floor(heartRate);
        }

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}


// ===================================================
//    MÓDULO DE VENTANAS Y PESTAÑAS (UI)
// ===================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (SYSTEM_SOUNDS.snd_open) { 
        SYSTEM_SOUNDS.snd_open.currentTime = 0; SYSTEM_SOUNDS.snd_open.play().catch(e => {}); 
    }
    modal.style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (SYSTEM_SOUNDS.snd_close) { 
        SYSTEM_SOUNDS.snd_close.currentTime = 0; SYSTEM_SOUNDS.snd_close.play().catch(e => {}); 
    }
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 250);
}

function switchClassTab(buttonElement, tabId) {
    const sidebar = buttonElement.parentElement;
    sidebar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');

    const viewport = sidebar.nextElementSibling;
    viewport.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
}


// ==========================================
//    SISTEMA DE REGISTRO LOCAL (CORREGIDO MULTI-GUION)
// ==========================================
function registerOperator() {
    try {
        const nameInput = document.getElementById('reg-name');
        const symbolInput = document.getElementById('reg-symbol');
        const numberInput = document.getElementById('reg-number');
        const btn = document.querySelector('.btn-ui');
        if (!nameInput || !symbolInput || !numberInput || !btn) return;

        if (ENABLE_SECURITY_LOCK) {
            const lastChange = localStorage.getItem('keneq_operator_last_change');
            const now = Date.now();
            if (lastChange) {
                const timePassed = now - parseInt(lastChange);
                if (timePassed < LOCK_DURATION_MS) {
                    if (SYSTEM_SOUNDS.snd_error) {
                        SYSTEM_SOUNDS.snd_error.currentTime = 0; SYSTEM_SOUNDS.snd_error.play().catch(e => {});
                    }
                    return; 
                }
            }
        }

        const name = nameInput.value.trim() || "NAME";
        const symbol = symbolInput.value.trim() || "CHAR";
        const number = numberInput.value.trim() || "NUMBER";

        localStorage.setItem('keneq_op_name', name);
        localStorage.setItem('keneq_op_symbol', symbol);
        localStorage.setItem('keneq_op_number', number);
        localStorage.setItem('keneq_operator_last_change', Date.now().toString());
        localStorage.setItem('keneq_operator_colors', JSON.stringify(selectedColors));

        updateHeaderNodeID(name, symbol, number, selectedColors);
        closeModal('modal-classification');
        checkRegistrationLock();
    } catch (e) { console.error("Error en registro:", e); }
}

function updateHeaderNodeID(name, symbol, number, colors) {
    try {
        const elName = document.getElementById('node-name');
        const elSymbol = document.getElementById('node-symbol');
        const elNumber = document.getElementById('node-number');

        // Referencias a la caja de usuario (UI inferior)
        const elNameUI = document.getElementById('node-name-ui');
        const elSymbolUI = document.getElementById('node-symbol-ui');
        const elNumberUI = document.getElementById('node-number-ui');

        // Actualizar Cabecera (Mostramos solo el derivado de 2 letras)
        if (elName) { 
            const derivative = name.substring(0, 2).toUpperCase();
            elName.innerText = derivative; 
            elName.style.setProperty('color', colors.name, 'important'); 
        }
        if (elSymbol) { 
            elSymbol.innerText = symbol; 
            elSymbol.style.setProperty('color', colors.symbol, 'important'); 
        }
        if (elNumber) { 
            elNumber.innerText = number; 
            elNumber.style.setProperty('color', colors.number, 'important'); 
        }

        // Actualizar Caja de Usuario (Real completo)
        if (elNameUI) { elNameUI.innerText = name; elNameUI.style.setProperty('color', colors.name, 'important'); }
        if (elSymbolUI) { elSymbolUI.innerText = symbol; elSymbolUI.style.setProperty('color', colors.symbol, 'important'); }
        if (elNumberUI) { elNumberUI.innerText = number; elNumberUI.style.setProperty('color', colors.number, 'important'); }

    } catch (e) { console.error("Error actualizando cabecera:", e); }
}

function checkRegistrationLock() {
    try {
        const nameInput = document.getElementById('reg-name');
        const symbolInput = document.getElementById('reg-symbol');
        const numberInput = document.getElementById('reg-number');
        const btn = document.querySelector('.btn-ui');
        if (!ENABLE_SECURITY_LOCK) return;

        const lastChange = localStorage.getItem('keneq_operator_last_change');
        const now = Date.now();

        if (lastChange && nameInput && symbolInput && numberInput && btn) {
            const timePassed = now - parseInt(lastChange);
            if (timePassed < LOCK_DURATION_MS) {
                const daysLeft = Math.ceil((LOCK_DURATION_MS - timePassed) / (24 * 60 * 60 * 1000));
                
                nameInput.disabled = true;
                symbolInput.disabled = true;
                numberInput.disabled = true;
                nameInput.style.opacity = "0.4";
                symbolInput.style.opacity = "0.4";
                numberInput.style.opacity = "0.4";

                btn.innerText = `[ UPLINK_LOCKED: ${daysLeft} DAYS REMAINING ]`;
                btn.style.color = "var(--main-ui)";
                btn.style.borderColor = "var(--third-ui)";
                btn.style.opacity = "0.6";
                btn.style.cursor = "not-allowed";
                btn.onclick = null; 
            }
        }
    } catch (e) { console.error("Error comprobando bloqueo:", e); }
}


// ===================================================
//    MÓDULO EXCLUSIVO: CONTROL DE COLOR
// ===================================================

function drawWheelMarker(x, y, skipStateUpdate = false) {
    const canvas = document.getElementById('color-wheel');
    if (!canvas || !wheelImageData) return;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(wheelImageData, 0, 0); // Restauramos la rueda limpia
    
    // Dibujar indicador (bolita)
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill();
}

function updateMarkerFromRGB(r, g, b) {
    const canvas = document.getElementById('color-wheel');
    if (!canvas) return;
    const radius = canvas.width / 2;
    
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
        else if (max === gf) h = (bf - rf) / d + 2;
        else h = (rf - gf) / d + 4;
        h /= 6;
    }
    const s = max === 0 ? 0 : d / max;
    
    const angle = h * Math.PI * 2;
    const dist = s * radius;
    const x = radius + Math.cos(angle) * dist;
    const y = radius + Math.sin(angle) * dist;
    drawWheelMarker(x, y);
}

function initColorWheel() {
    try {
        const canvas = document.getElementById('color-wheel');
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const radius = canvas.width / 2;

        for (let angle = 0; angle < 360; angle++) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = (angle + 1) * Math.PI / 180;
            
            ctx.beginPath();
            ctx.moveTo(radius, radius);
            ctx.arc(radius, radius, radius, startAngle, endAngle);
            ctx.closePath();

            const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Guardamos la imagen de la rueda para redibujar el puntero
        wheelImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let isDragging = false;
        const pick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - radius;
            const dy = y - radius;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= radius) {
                const imgData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                const hex = rgbToHex(imgData[0], imgData[1], imgData[2]);
                updateColorState(hex, imgData[0], imgData[1], imgData[2], true); 
                drawWheelMarker(x, y);
            }
        };

        canvas.onmousedown = (e) => { isDragging = true; pick(e); };
        window.addEventListener('mousemove', (e) => { if (isDragging) pick(e); });
        window.addEventListener('mouseup', () => { isDragging = false; });

        // Posicionar la bolita inicialmente según el color cargado
        const currentHex = selectedColors[activeColorTarget];
        const rgb = hexToRgb(currentHex);
        if (rgb) updateMarkerFromRGB(rgb.r, rgb.g, rgb.b);

    } catch (e) { console.error("Error cargando rueda cromática:", e); }
}

function switchColorTarget(btn, target) {
    document.querySelectorAll('.target-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    activeColorTarget = target;

    const hex = selectedColors[target];
    const rgb = hexToRgb(hex);
    if (rgb) updateColorState(hex, rgb.r, rgb.g, rgb.b);
}

function toggleAdvancedPanel() {
    const advPanel = document.getElementById('adv-panel');
    const btn = document.getElementById('btn-toggle-more');

    if (advPanel && btn) {
        if (advPanel.style.display === 'none') {
            advPanel.style.display = 'flex';
            btn.innerText = "<< Less";
        } else {
            advPanel.style.display = 'none';
            btn.innerText = "More >>";
        }
    }
}

function updateColorState(hex, r, g, b, skipMarker = false) {
    selectedColors[activeColorTarget] = hex;

    const preview = document.getElementById('color-preview');
    if (preview) {
        preview.style.backgroundColor = hex;
    }

    if (document.getElementById('slide-r')) document.getElementById('slide-r').value = r;
    if (document.getElementById('slide-g')) document.getElementById('slide-g').value = g;
    if (document.getElementById('slide-b')) document.getElementById('slide-b').value = b;
    
    if (document.getElementById('num-r')) document.getElementById('num-r').value = r;
    if (document.getElementById('num-g')) document.getElementById('num-g').value = g;
    if (document.getElementById('num-b')) document.getElementById('num-b').value = b;
    
    if (document.getElementById('hex-val')) document.getElementById('hex-val').value = hex.replace('#', '');

    if (!skipMarker) updateMarkerFromRGB(r, g, b);
}

function updateColorsFromSliders() {
    const r = document.getElementById('slide-r').value;
    const g = document.getElementById('slide-g').value;
    const b = document.getElementById('slide-b').value;
    const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
    updateColorState(hex, r, g, b);
}

function updateColorsFromHex() {
    let hex = document.getElementById('hex-val').value.trim();
    if (hex.length === 6) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        const rgb = hexToRgb(hex);
        if (rgb) updateColorState(hex, rgb.r, rgb.g, rgb.b);
    }
}

function selectPreset(hex) {
    const rgb = hexToRgb(hex);
    if (rgb) updateColorState(hex, rgb.r, rgb.g, rgb.b);
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}


// ==========================================
//    CARGADOR MAESTRO Y UNIFICADO (DOM LOAD)
// ==========================================
window.addEventListener('load', async () => {
    // 1. Inicializar Base de Datos (Persistencia Real)
    try {
        await initIndexedDB();
        await loadSavedFiles(); 
    } catch (e) { console.error("Database error:", e); }

    // 1.5 Cargar variables personalizadas (Colores)
    const savedCustomVars = localStorage.getItem('keneq_custom_vars');
    if (savedCustomVars) {
        customVars = JSON.parse(savedCustomVars);
    }

    // 2. Restaurar Motores del Sistema
    try { initSystemClock(); } catch (err) { console.error(err); }
    try { startSystemBoot(); } catch (err) { console.error(err); }
    try { initLiveFeed(); } catch (err) { console.error(err); }
    try { generateFragmentTape(); } catch (err) { console.error(err); }
    try { initBioMonitor(); } catch (err) { console.error(err); }
    try { initColorWheel(); } catch (err) { console.error(err); }

    // 3. Audio y Volumen
    const player = getSequencer();
    if (player) {
        player.onended = () => {
            if (discLoopActive) return;
            const playlist = SYSTEM_PLAYLISTS[playingPlaylistKey];
            if (!playlist) return;
            let nextIndex = discShuffleActive 
                ? Math.floor(Math.random() * playlist.tracks.length) 
                : (currentTrackIndex + 1) % playlist.tracks.length;
            playSelectedDiscTrack(nextIndex, playingPlaylistKey);
        };
        player.onplay = () => {
            updateDiscSpinState(true);
            const btn = document.getElementById('btn-play-pause');
            if (btn) btn.innerText = "[ PAUSE ]";
        };
        player.onpause = () => {
            updateDiscSpinState(false);
            const btn = document.getElementById('btn-play-pause');
            if (btn) btn.innerText = "[ RESUME ]";
        };

        // Restaurar estados de Loop y Shuffle
        const savedLoop = localStorage.getItem('keneq_disc_loop');
        if (savedLoop !== null) {
            discLoopActive = (savedLoop === 'true');
            player.loop = discLoopActive;
            const btn = document.getElementById('btn-disc-loop');
            if (btn) btn.innerText = discLoopActive ? "[ LOOP: ON ]" : "[ LOOP: OFF ]";
        }
        const savedShuffle = localStorage.getItem('keneq_disc_shuffle');
        if (savedShuffle !== null) {
            discShuffleActive = (savedShuffle === 'true');
            const btn = document.getElementById('btn-disc-shuffle');
            if (btn) btn.innerText = discShuffleActive ? "[ SHUFFLE: ON ]" : "[ SHUFFLE: OFF ]";
        }
    }

    // 4. Restauración de Sesión (Track y Tape)
    try {
        const lastTrackName = localStorage.getItem('keneq_last_track_name');
        const lastPlaylistKey = localStorage.getItem('keneq_last_playlist_key');
        let restoredMusic = false;
        if (lastTrackName && lastPlaylistKey && SYSTEM_PLAYLISTS[lastPlaylistKey]) {
            const tracks = SYSTEM_PLAYLISTS[lastPlaylistKey].tracks;
            const foundIndex = tracks.findIndex(t => (playgroundNames.get(t) || t) === lastTrackName);
            if (foundIndex !== -1) { playSelectedDiscTrack(foundIndex, lastPlaylistKey, !musicPaused); restoredMusic = true; }
        }
        if (!restoredMusic) {
            if (!musicPaused) {
                playRandomTrack();
            } else {
                const playlist = SYSTEM_PLAYLISTS["NONE"];
                if (playlist && playlist.tracks.length > 0) playSelectedDiscTrack(0, "NONE", false);
            }
        }

        const lastTapeName = localStorage.getItem('keneq_last_tape_name');
        if (lastTapeName) {
            const foundTape = tapes.find(t => t.name === lastTapeName);
            if (foundTape) selectCassetteBackground(foundTape.background, lastTapeName);
        }
    } catch (err) { console.error("Session restoration error:", err); }

    // 5. UI Sincronización Inicial y Playground
    const savedLevelIndex = localStorage.getItem('keneq_system_level') || "0";
    selectSystemLevel(parseInt(savedLevelIndex));
    updateCassetteDeckUI();

    // 5.5 Restaurar Niveles de Volumen y Sliders
    const savedMusicVol = localStorage.getItem('keneq_vol_music');
    if (savedMusicVol !== null) {
        musicVol = parseFloat(savedMusicVol);
        const slider = document.getElementById('vol-music');
        if (slider) slider.value = musicVol;
        updateMusicVolume(musicVol);
    }

    const savedSfxVol = localStorage.getItem('keneq_vol_sfx');
    if (savedSfxVol !== null) {
        sfxVol = parseFloat(savedSfxVol);
        const slider = document.getElementById('vol-sfx');
        if (slider) slider.value = sfxVol;
        updateSFXVolume(sfxVol);
    }

    const savedAmbienceVol = localStorage.getItem('keneq_vol_ambience');
    if (savedAmbienceVol !== null) ambienceVol = parseFloat(savedAmbienceVol);
    
    const ambSlider = document.getElementById('vol-ambience');
    if (ambSlider) ambSlider.value = ambienceVol;
    updateAmbienceVolume(ambienceVol);

    const savedBootSpeed = localStorage.getItem('keneq_boot_speed');
    if (savedBootSpeed !== null) {
        bootSpeedMultiplier = parseFloat(savedBootSpeed);
        const bSlider = document.getElementById('vol-boot-speed');
        const bLabel = document.getElementById('txt-vol-boot-speed');
        if (bSlider) bSlider.value = bootSpeedMultiplier;
        if (bLabel) bLabel.innerText = bootSpeedMultiplier.toFixed(1) + "x";
    }

    // 6. Cargar datos de usuario
    loadUserData();
    loadUpdateLog();
    updateDiagnosticStats();
});

function loadUserData() {
    const savedName = localStorage.getItem('keneq_op_name');
    const savedSymbol = localStorage.getItem('keneq_op_symbol');
    const savedNumber = localStorage.getItem('keneq_op_number');
    const savedColors = localStorage.getItem('keneq_operator_colors');
    if (savedColors) selectedColors = JSON.parse(savedColors);
    if (savedName) {
        updateHeaderNodeID(savedName, savedSymbol || "%", savedNumber || "000", selectedColors);
        if (document.getElementById('reg-name')) document.getElementById('reg-name').value = savedName;
        if (document.getElementById('reg-symbol')) document.getElementById('reg-symbol').value = savedSymbol;
        if (document.getElementById('reg-number')) document.getElementById('reg-number').value = savedNumber;
    } else {
        updateHeaderNodeID("--", "?", "---", selectedColors);
    }

    // MOTOR DE ACCESO (TRACKING DE SESIÓN)
    const lastAccessEl = document.getElementById('last-access-time');
    const sessionEl = document.getElementById('session-id');
    
    if (lastAccessEl) {
        const prevAccess = localStorage.getItem('keneq_last_access');
        lastAccessEl.innerText = prevAccess ? prevAccess : "INITIAL_LINK_DETECTED";
        
        // Guardar el acceso actual (fecha y hora) para la próxima vez que inicies
        const now = new Date();
        const nowStr = `${now.toLocaleDateString('es-ES')} // ${now.toLocaleTimeString('es-ES', { hour12: false })}`;
        localStorage.setItem('keneq_last_access', nowStr);
    }

    if (!localStorage.getItem('keneq_proxy_id')) {
        const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
        localStorage.setItem('keneq_proxy_id', `PX-${rand()}-${rand()}-${rand()}`);
    }

    if (sessionEl) {
        const randSession = "KQ-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 5).toUpperCase();
        sessionEl.innerText = randSession;
    }

    checkRegistrationLock();
}


// Se eliminó el bloque de comentario que rompía la estructura
// ==========================================

function handleMusicUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const objectURL = URL.createObjectURL(file);
    SYSTEM_PLAYLISTS["NONE"].tracks.push(objectURL);
    playgroundNames.set(objectURL, file.name);
    saveFileToDB(file, "music");
    updateDiscPlaylistUI("NONE");
}

function handleCassetteUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const objectURL = URL.createObjectURL(file);
    const fileName = file.name.split('.')[0].toUpperCase();
    tapes.push({ name: `USR_${fileName}`, background: objectURL });
    saveFileToDB(file, "tape");
    updateCassetteDeckUI();
}

function confirmDeletion(type, index, name) {
    pendingPurge = { type, index, name };
    const msg = document.getElementById('purge-msg');
    if (msg) msg.innerText = `ARE YOU SURE YOU WANT TO DELETE "${name}" FROM ${type.toUpperCase()}?`;
    openModal('modal-purge');
}

function executeDeletion() {
    if (!pendingPurge) return;
    const { type, index, name } = pendingPurge;
    if (type === 'music') {
        const trackUrl = SYSTEM_PLAYLISTS["NONE"].tracks[index];
        deleteFileFromDB(name, "music");
        SYSTEM_PLAYLISTS["NONE"].tracks.splice(index, 1);
        playgroundNames.delete(trackUrl);
        if (getSequencer().src.includes(trackUrl)) playSelectedDiscTrack(0, "NONE");
        updateDiscPlaylistUI(activePlaylistKey);
    } else {
        const tapeUrl = tapes[index].background;
        deleteFileFromDB(name.replace('USR_', ''), "tape");
        tapes.splice(index, 1);
        if (UIX[0].background === tapeUrl) selectCassetteBackground(tapes[0].background, tapes[0].name);
        updateCassetteDeckUI();
    }
    closeModal('modal-purge');
    pendingPurge = null;
}

// --- MOTOR PERSISTENCIA ---
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => reject(e);
    });
}

function saveFileToDB(file, type) {
    if (!db) return;
    const transaction = db.transaction(['files'], 'readwrite');
    transaction.objectStore('files').add({ name: file.name, type: type, data: file });
}

async function loadSavedFiles() {
    if (!db) return;
    return new Promise((resolve) => {
        const request = db.transaction(['files'], 'readonly').objectStore('files').getAll();
        request.onsuccess = (e) => {
            e.target.result.forEach(item => {
                const objectURL = URL.createObjectURL(item.data);
                if (item.type === "music") {
                    SYSTEM_PLAYLISTS["NONE"].tracks.push(objectURL);
                    playgroundNames.set(objectURL, item.name);
                } else {
                    const fileName = item.name.split('.')[0].toUpperCase();
                    tapes.push({ name: `USR_${fileName}`, background: objectURL });
                }
            });
            resolve();
        };
    });
}

function deleteFileFromDB(fileName, type) {
    if (!db) return;
    const store = db.transaction(['files'], 'readwrite').objectStore('files');
    const request = store.openCursor();
    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (cursor.value.name.toUpperCase().includes(fileName.toUpperCase()) && cursor.value.type === type) cursor.delete();
            else cursor.continue();
        }
    };
}

// ==========================================
//    MÓDULO DE SELECCIÓN DE NIVELES (TEMAS)
// ==========================================

const LEVEL_CONFIGS = [
    { className: "", label: "LEVEL NONE // NONE" },
    { className: "level-0", label: "LEVEL 00 // GREEN" },
    { className: "level-1", label: "LEVEL 01 // PINK" },
    { className: "level-2", label: "LEVEL 02 // BLUE_GOLD" },
    { className: "level-3", label: "LEVEL 03 // ORANGE" },
    { className: "level-4", label: "LEVEL 04 // GREY" },
    { className: "level-5", label: "LEVEL 05 // CYAN" }
];

// Valores de fábrica para el modo NONE
const DEFAULT_VARS = {
    "--main": "#007aff",
    "--main-dim": "#007aff1a",
    "--main-glow": "0 0 10px #007aff33",
    "--white": "#e0e0e0",
    "--bg-black": "#080a0e",
    "--second-bg": "#273144",
    "--main-ui": "#4d9eff",
    "--second-ui": "#00b7ff",
    "--third-ui": "#162031",
    "--error-main": "#7a5cff",
    "--error-bg": "#110d24",
    "--error-dim": "rgba(122, 92, 255, 0.15)",
    "--error-glow": "0 0 10px rgba(122, 92, 255, 0.25)"
};

let customVars = { ...DEFAULT_VARS };

function selectSystemLevel(index) {
    try {
        const config = LEVEL_CONFIGS[index];
        if (!config) return;

        const root = document.documentElement;
        const editor = document.getElementById('custom-vars-editor');
        const mPlay = document.getElementById('music-playground');
        const cPlay = document.getElementById('cassette-playground');

        // Guardamos el nivel SIEMPRE, no solo en el else
        localStorage.setItem('keneq_system_level', index.toString());

        // Purgamos clases de niveles fijos anteriores
        LEVEL_CONFIGS.forEach(item => {
            if (item.className) root.classList.remove(item.className);
        });

        if (index === 0) {
            // SI ES LEVEL_NONE: Mostramos el editor de variables y NO cerramos el modal
            if (editor) editor.style.display = 'block';
            if (mPlay) mPlay.style.display = 'block';
            if (cPlay) cPlay.style.display = 'block';
            if (mPlay) mPlay.style.setProperty('display', 'block', 'important');
            if (cPlay) cPlay.style.setProperty('display', 'block', 'important');
            loadCustomVarsIntoInputs();
            applyAllCustomVars(); // Aplica las variables custom guardadas o las de fábrica
        } else {
            // SI ES UN NIVEL FIJO: Ocultamos el editor, cerramos el modal y limpiamos estilos inline
            if (editor) editor.style.display = 'none';
            if (mPlay) mPlay.style.display = 'none';
            if (cPlay) cPlay.style.display = 'none';
            if (mPlay) mPlay.style.setProperty('display', 'none', 'important');
            if (cPlay) cPlay.style.setProperty('display', 'none', 'important');
            root.removeAttribute('style'); // Obligatorio para que manden las clases CSS fijas
            root.classList.add(config.className);
        }

        // Actualizar el header
        const classLabel = document.querySelector('.c-bottom');
        if (classLabel) {
            if (index === 0) {
                const customNum = localStorage.getItem('keneq_custom_level_num') || "NONE";
                const customTxt = localStorage.getItem('keneq_custom_level_txt') || "NONE";
                classLabel.innerText = `LEVEL ${customNum} // ${customTxt}`;
            } else {
                classLabel.innerText = config.label;
            }
        }

    } catch (e) { console.error("Error al cambiar nivel:", e); }
}

// Inyección en caliente de una sola variable
function applyCustomVar(varName, value) {
    document.documentElement.style.setProperty(varName, value);
    customVars[varName] = value;
}

function resetVar(varName) {
    const defaultValue = DEFAULT_VARS[varName];
    if (defaultValue) {
        applyCustomVar(varName, defaultValue);
        // Actualizamos el input visual (v-main, v-main-dim, etc)
        const id = 'v-' + varName.replace('--', '');
        const input = document.getElementById(id);
        if (input) input.value = defaultValue;
    }
}

// Aplicar todas las variables del diccionario
function applyAllCustomVars() {
    Object.keys(customVars).forEach(key => {
        document.documentElement.style.setProperty(key, customVars[key]);
    });
}

// Cargar los valores de las variables en las cajas de texto de la consola
function loadCustomVarsIntoInputs() {
    Object.keys(customVars).forEach(key => {
        const id = 'v-' + key.replace('--', '');
        const input = document.getElementById(id);
        if (input) input.value = customVars[key];
    });

    // Cargar valores personalizados del Level Label
    const vNum = document.getElementById('v-lvl-num');
    const vTxt = document.getElementById('v-lvl-txt');
    if (vNum) vNum.value = localStorage.getItem('keneq_custom_level_num') || "NONE";
    if (vTxt) vTxt.value = localStorage.getItem('keneq_custom_level_txt') || "NONE";
}

// Manejo de etiquetas personalizadas para el nivel
function updateCustomLevelLabel() {
    const numInput = document.getElementById('v-lvl-num');
    const txtInput = document.getElementById('v-lvl-txt');
    if (!numInput || !txtInput) return;

    const num = numInput.value.trim().toUpperCase() || "NONE";
    const txt = txtInput.value.trim().toUpperCase() || "NONE";

    localStorage.setItem('keneq_custom_level_num', num);
    localStorage.setItem('keneq_custom_level_txt', txt);

    // Actualizar en tiempo real si el nivel actual es NONE
    const currentLevelIndex = localStorage.getItem('keneq_system_level');
    if (currentLevelIndex === "0") {
        const classLabel = document.querySelector('.c-bottom');
        if (classLabel) classLabel.innerText = `LEVEL ${num} // ${txt}`;
    }
}

function resetCustomLevelLabel(type) {
    const targetId = type === 'num' ? 'v-lvl-num' : 'v-lvl-txt';
    const input = document.getElementById(targetId);
    if (input) input.value = "NONE";
    updateCustomLevelLabel();
}

// Guardar la configuración personalizada en el navegador
function saveCustomVars() {
    localStorage.setItem('keneq_custom_vars', JSON.stringify(customVars));
    localStorage.setItem('keneq_system_level', "0"); // Guardamos que estamos en LEVEL NONE (0)
    
    closeModal('modal-classification');
}
// ==========================================
//    BASE DE DATOS DE MÚSICA (NATIVA EN UIX)
// ==========================================
const SYSTEM_PLAYLISTS = {
    "NONE": { 
        folder: "TERMINAL.DATA/User", 
        tracks: ["ROUTINE.mp3"] 
    },
    "level-0": { 
        folder: "TERMINAL.Audio/Fragmented", 
        tracks: [
            "Trauma.mp3", 
            "Login.mp3",
            "System Failure.mp3",
            "Sto Obrazov.mp3",
            "untitled.mp3"
        ]
    },
    "level-1": { 
        folder: "TERMINAL.Audio/Legacy", 
        tracks: [
            "Alters.mp3", 
            "Rapidium.mp3",
            "Alters Life.mp3",
            "Circles.mp3",
            "Magnetic Storm.mp3"
        ]
    },
    "level-2": { 
        folder: "TERMINAL.Audio/Unity", 
        tracks: [
            "Unity.mp3", 
            "The world outside.mp3",
            "Base control.mp3",
            "Not a single soul left.mp3",
            "914.mp3",
            "Rock room.mp3"
        ]
    },
    "level-3": { 
        folder: "TERMINAL.Audio/Deus", 
        tracks: [
            "Main Menu.mp3",
            "Home.mp3",
            "Hung Hua Brothel.mp3",
            "Icarus.mp3",
            "Namir.mp3",
            "Endings.mp3",
            "Opening Credits.mp3",
            "Ending - Bill Taggert's.mp3",
            "Ending - David Sarif's.mp3"
        ]
    },
    "level-4": { 
        folder: "TERMINAL.Audio/Ex", 
        tracks: ["Cargo.mp3", "Delta Integrale E.mp3", "Passenger seat.mp3"] 
    },
    "level-5": { 
        folder: "TERMINAL.Audio/Bridges", 
        tracks: [
            "Bridges.mp3",
            "Sleep.mp3",
            "BB-Theme.mp3",
            "Tonight, Tonight, Tonight.mp3",
            "Dead Man.mp3",
            "John.mp3",
            "Cargo.mp3",
            "Cargo High.ogg",
            "Mule.mp3",
            "Porter Syndrome.mp3",
            "Decentralized by Nature.mp3",
            "Demens.mp3"
        ]
    }
};

let currentTrackIndex = 0;
let discLoopActive = false;
let discShuffleActive = false;
let activePlaylistKey = "NONE";
let playingPlaylistKey = "NONE";

// ==========================================
//    MÓDULO DE REPRODUCCIÓN (DISC)
// ==========================================

// MOTOR DE NAVEGACIÓN DE MÓDULOS SONOROS (Independiente del Nivel)
function cycleSoundModule(direction) {
    const keys = Object.keys(SYSTEM_PLAYLISTS);
    let currentIndex = keys.indexOf(activePlaylistKey);
    
    currentIndex += direction;
    if (currentIndex < 0) currentIndex = keys.length - 1;
    if (currentIndex >= keys.length) currentIndex = 0;
    
    const nextKey = keys[currentIndex];
    updateDiscPlaylistUI(nextKey);

    // Audio Feedback
    if (SYSTEM_SOUNDS.snd_click) {
        SYSTEM_SOUNDS.snd_click.currentTime = 0;
        SYSTEM_SOUNDS.snd_click.play().catch(e => {});
    }
}


// 1. Pintar la lista de canciones en la consola
function updateDiscPlaylistUI(levelKey) {
    const stream = document.getElementById('disc-playlist-stream');
    if (!stream) return;

    activePlaylistKey = levelKey;
    stream.innerHTML = ''; // Limpiar lista vieja

    // Actualizar etiqueta del módulo en el Deck
    const label = document.getElementById('current-module-label');
    if (label) label.innerText = `MODULE-S: ${levelKey.toUpperCase()}`;

    const playlist = SYSTEM_PLAYLISTS[levelKey];
    if (!playlist) {
        stream.innerHTML = '<div style="padding:10px; opacity:0.5;">NO_TRACKS_AVAILABLE</div>';
        return;
    }

    playlist.tracks.forEach((track, index) => {
        const originalName = playgroundNames.get(track) || track;
        const cleanName = originalName.replace('.mp3', '').replace('.ogg', '').toUpperCase();

        const trackRow = document.createElement('div');
        trackRow.className = 'playlist-track';
        
        // Sincronizar resaltado activo
        const player = getSequencer();
        const currentPlayingPath = (player && player.src) ? decodeURIComponent(player.src) : "";
        const fullPath = (track.startsWith('blob:')) ? track : `${playlist.folder}/${track}`;

        if (currentPlayingPath.includes(fullPath)) {
            trackRow.classList.add('active');
            updateDiscSpinState(true); 
        }

        let deleteBtn = "";
        if (levelKey === "NONE" && track.startsWith('blob:')) {
            deleteBtn = `<span class="btn-ui-mini del-trigger error-action" style="margin-left:10px;">DEL</span>`;
        }

        trackRow.innerHTML = `<span>> ${cleanName}</span> ${deleteBtn}`;
        
        trackRow.addEventListener('click', (e) => {
            if (e.target.classList.contains('del-trigger')) {
                e.stopPropagation();
                confirmDeletion('music', index, originalName);
            } else {
                playSelectedDiscTrack(index);
            }
        });

        stream.appendChild(trackRow);
    });
}

// 2. Reproducir canción seleccionada
function playSelectedDiscTrack(index, playlistKey = activePlaylistKey, forcePlay = true) {
    const playlist = SYSTEM_PLAYLISTS[playlistKey];
    if (!playlist) return;

    playingPlaylistKey = playlistKey; // Sincronizamos qué lista es la que suena realmente
    currentTrackIndex = index;
    const filename = playlist.tracks[index];
    const path = (filename.startsWith('blob:')) ? filename : `${playlist.folder}/${filename}`;

    const player = getSequencer();
    if (!player) return;

    // Persistencia de sesión (Nombre real si es upload)
    const saveName = playgroundNames.get(filename) || filename;
    localStorage.setItem('keneq_last_track_name', saveName);
    localStorage.setItem('keneq_last_playlist_key', playlistKey);

    player.src = path;
    player.loop = discLoopActive;

    if (forcePlay) {
        player.play()
            .then(() => {
                musicPaused = false;
                localStorage.setItem('keneq_music_paused', 'false');
                updateDiscSpinState(true);
                updateDiscPlaylistUI(playlistKey);
            })
            .catch(e => {
                console.error("Error de audio:", e.message);
                updateDiscSpinState(false);
                updateDiscPlaylistUI(playlistKey);
            });
    } else {
        player.load();
        updateDiscSpinState(false);
        updateDiscPlaylistUI(playlistKey);
        const btn = document.getElementById('btn-play-pause');
        if (btn) btn.innerText = "[ PLAY ]";
    }
}

// 3. Controlar el giro del disco
function updateDiscSpinState(isPlaying) {
    const vinyl = document.getElementById('ui-disc-vinyl');
    if (vinyl) {
        vinyl.style.animationPlayState = isPlaying ? 'running' : 'paused';
    }
}

// --- PANEL DE TRANSPORTE MANUAL ---
function togglePlayPauseMusic() {
    const player = getSequencer();
    if (player.paused) {
        player.play().then(() => {
            musicPaused = false;
            localStorage.setItem('keneq_music_paused', 'false');
        });
    } else {
        player.pause();
        musicPaused = true;
        localStorage.setItem('keneq_music_paused', 'true');
    }
}

function stopMusic() {
    const player = getSequencer();
    player.pause();
    player.currentTime = 0;
    musicPaused = true;
    localStorage.setItem('keneq_music_paused', 'true');
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerText = "[ PLAY ]";
}

function playNextTrack() {
    const playlist = SYSTEM_PLAYLISTS[playingPlaylistKey];
    if (!playlist) return;
    
    let nextIndex = discShuffleActive 
        ? Math.floor(Math.random() * playlist.tracks.length) 
        : (currentTrackIndex + 1) % playlist.tracks.length;
        
    playSelectedDiscTrack(nextIndex, playingPlaylistKey);
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerText = "[ PAUSE ]";
}

// --- MOTOR DE SELECCIÓN TÁCTICA DE PISTAS ---
function changeMusic(theme) {
    const randomTrack = theme.tracks[Math.floor(Math.random() * theme.tracks.length)];
    const path = `TERMINAL.Audio/${theme.folder}/${randomTrack}`;
    
    const player = getSequencer();
    if (player) { player.src = path; player.load(); player.play().catch(e => {}); }
}

// 4. Botones de Bucle y Aleatorio
function toggleDiscLoop() {
    discLoopActive = !discLoopActive;

    // Si se activa Loop, desactivamos Shuffle obligatoriamente
    if (discLoopActive) {
        discShuffleActive = false;
        localStorage.setItem('keneq_disc_shuffle', discShuffleActive);
        const sBtn = document.getElementById('btn-disc-shuffle');
        if (sBtn) sBtn.innerText = "[ SHUFFLE: OFF ]";
    }

    localStorage.setItem('keneq_disc_loop', discLoopActive);

    const player = getSequencer();
    if (player) player.loop = discLoopActive;

    const btn = document.getElementById('btn-disc-loop');
    if (btn) btn.innerText = discLoopActive ? "[ LOOP: ON ]" : "[ LOOP: OFF ]";
}

function toggleDiscShuffle() {
    discShuffleActive = !discShuffleActive;

    // Si se activa Shuffle, desactivamos Loop obligatoriamente
    if (discShuffleActive) {
        discLoopActive = false;
        localStorage.setItem('keneq_disc_loop', discLoopActive);
        const player = getSequencer();
        if (player) player.loop = false;
        const lBtn = document.getElementById('btn-disc-loop');
        if (lBtn) lBtn.innerText = "[ LOOP: OFF ]";
    }

    localStorage.setItem('keneq_disc_shuffle', discShuffleActive);

    const btn = document.getElementById('btn-disc-shuffle');
    if (btn) btn.innerText = discShuffleActive ? "[ SHUFFLE: ON ]" : "[ SHUFFLE: OFF ]";
}

// 5. Siguiente pista automática al terminar
/* Bloque redundante de audio eliminado: la lógica ya reside en el Cargador Maestro (Línea 811) */
// ==========================================
//    MÓDULO DE FONDOS: DECK DE CASETES (UIX)
// ==========================================

const tapes = [
    { name: "NONE", background: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3I0Mm5scnVzcHp1dzFmc2ZqdzRveHU0dmQxeXA2cHZsZTM2em9rNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6vXRxrhj7Ov94Gbu/giphy.gif" },
    {name: "level-0", background: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExajZrZHplYjBibjZweXFyZWJqYmRwcnBqcTJjMHZheW44amRzeWNrbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aedHplWQULpK3EtL0e/giphy.gif"},
    {name: "level-1", background: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2MwOGJsZTI3eGttZmhpcnc1ejhocG9uM2Y5bWpid3lkcGE4ZTRscCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aITBZMqp5oa1eoIday/giphy.gif"},
    {name: "level-2", background: "TERMINAL.Images/gameplay.webp"},
    {name: "level-3", background: "TERMINAL.DATA/Deus_ex.webp"},
    {name: "level-4", background: "TERMINAL.DATA/rally.webp"},
    {name: "level-5", background: "https://media1.tenor.com/m/hL4Z2AmhBkAAAAAd/death-stranding-hideo-kojima.gif"}
]

// 1. Dibujar los casetes disponibles en la lista
function updateCassetteDeckUI() {
    const stream = document.getElementById('cassette-stream');
    if (!stream) return;

    stream.innerHTML = ''; // Limpiar

    tapes.forEach((tape, index) => {
        createCassetteRow(stream, tape.name, tape.background, index);
    });
}

// Auxiliar para crear la fila física del casete
function createCassetteRow(container, name, bgUrl, index) {
    const row = document.createElement('div');
    row.className = 'cassette-item';
    
    // Si este casete es el fondo actual, lo marcamos activo
    if (UIX[0].background === bgUrl) {
        row.classList.add('active');
    }

    let deleteBtn = "";
    if (name.startsWith('USR_')) {
        deleteBtn = `<span class="btn-ui-mini del-trigger error-action" style="font-size:0.55rem; margin-left:10px;">DEL</span>`;
    }

    row.innerHTML = `
        <span style="flex:1">> TAPE_${name}</span>
        ${deleteBtn}
        <div class="cassette-shape" style="margin-left:10px;"></div>
        <!-- Recuadro flotante con el GIF/WebP de fondo de este casete -->
        <div class="cassette-preview" style="background-image: url('${bgUrl}')"></div>
    `;

    row.addEventListener('click', (e) => {
        if (e.target.classList.contains('del-trigger')) {
            e.stopPropagation();
            confirmDeletion('tape', index, name);
        } else {
            selectCassetteBackground(bgUrl, name);
        }
    });

    container.appendChild(row);
}

// 2. Cambiar fondo y actualizar fragmentos en vivo
function selectCassetteBackground(url, name) {
    // Cambiamos el fondo del objeto en memoria
    UIX[0].background = url;
    if (name) localStorage.setItem('keneq_last_tape_name', name);

    // 1. Actualizar el Live Feed al instante (Quita la imagen anterior y pone la nueva)
    const currentBgImg = document.getElementById('ui-image-bg');
    if (currentBgImg) {
        currentBgImg.src = url;
    }

    // 2. Actualizar la cinta de fragmentos para que use el nuevo fondo
    if (typeof generateFragmentTape === 'function') {
        generateFragmentTape();
    }

    // 3. Refrescar la lista de casetes para mover el estado "active"
    updateCassetteDeckUI();
}

// 3. Añadir cargadores a tu escuchador 'window.onload' o 'load' existente:
/* Bloque de carga de fondo eliminado: integrado en el Cargador Maestro para soporte de IndexedDB */

// Inicialización del analizador de espectro
function initMusicVisualizer() {
    const player = getSequencer();
    if (!player || isAudioConnected) return;

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaElementSource(player);
        
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        analyser.fftSize = visFFT; 
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        isAudioConnected = true;
        renderWaveform();
    } catch (e) {
        console.error("Error al conectar el analizador de audio:", e);
    }
}

function renderWaveform() {
    const canvas = document.getElementById('canvas-music-wave');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const label = document.getElementById('audio-freq-label');

    // Ajustar resolución interna del canvas al tamaño real del elemento
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let frameCount = 0;
    const draw = () => {
        requestAnimationFrame(draw);
        
        // SALTO DE CUADROS EN MÓVIL
        if (isMobileDevice && frameCount++ % 2 !== 0) return;
        
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--main-ui').trim() || "#00b7ff";
        const barWidth = (canvas.width / dataArray.length) * visBarWidth;
        let barHeight;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;

            ctx.fillStyle = themeColor;
            ctx.globalAlpha = 0.8;
            // Dibujar barra desde abajo hacia arriba
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            // Efecto de reflejo superior sutil
            ctx.globalAlpha = 0.2;
            ctx.fillRect(x, 0, barWidth, barHeight * 0.2);

            x += barWidth + visBarGap;
        }

        // Actualizar etiqueta de frecuencia con un valor simulado basado en la intensidad
        if (label && Math.random() > 0.8) {
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const freq = (avg * 0.08).toFixed(2);
            label.innerText = `${freq} KHZ`;
        }
    };
    draw();
}

async function loadUpdateLog() {
    const stream = document.getElementById('update-log-stream');
    if (!stream) return;

    try {
        const response = await fetch('TERMINAL.DATA/UPDATE-LOG.txt');
        if (!response.ok) throw new Error("LOG_FILE_NOT_ACCESSIBLE");
        
        const text = await response.text();
        // Dividimos por el separador ---. Como el archivo ya tiene lo más nuevo arriba, no invertimos.
        const entries = text.split('---').map(e => e.trim()).filter(e => e.length > 0);

        stream.innerHTML = ''; // Limpiar mensaje de carga

        entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'update-entry';
            entryDiv.style.borderLeft = '2px solid var(--main-ui)';
            entryDiv.style.padding = '10px 15px';
            entryDiv.style.marginBottom = '15px';
            entryDiv.style.background = 'rgba(255, 255, 255, 0.03)';

            const lines = entry.split('\n');
            lines.forEach((line, i) => {
                const p = document.createElement('div');
                // La primera línea (Versión) resalta más
                p.style.fontSize = i === 0 ? '0.85rem' : '0.75rem';
                p.style.color = i === 0 ? 'var(--second-ui)' : 'var(--white)';
                p.style.opacity = i === 0 ? '1' : '0.6';
                p.style.marginBottom = '3px';
                p.innerText = line.trim();
                entryDiv.appendChild(p);
            });
            stream.appendChild(entryDiv);
        });
    } catch (err) {
        stream.innerHTML = `<div style="opacity:0.5; color:var(--rojo-error);">[ ERROR: ${err.message} ]</div>`;
    }
}

// ==========================================
//    MOTOR DE DIAGNÓSTICO DINÁMICO
// ==========================================
function updateDiagnosticStats() {
    const scanner = document.getElementById('diag-unit-scanner');
    const buffer = document.getElementById('diag-buffer-val');
    const frequency = document.getElementById('diag-uplink-val');

    if (!scanner) return;

    // 1. Escaneo de unidades reales desde tu UNITS.json
    fetch('TERMINAL.DATA/UNITS.json')
        .then(res => res.json())
        .then(data => {
            const allUnits = Object.values(data).flat();
            const randomUnits = [];
            // Seleccionamos 6 unidades al azar para simular el rastreo de red
            for (let i = 0; i < 6; i++) {
                const unit = allUnits[Math.floor(Math.random() * allUnits.length)];
                if (unit) randomUnits.push(unit.id);
            }

            scanner.innerHTML = randomUnits.map((id, i) => {
                const isFirst = i === 0;
                return `<div class="scan-line ${isFirst ? 'active' : ''}">> ${isFirst ? 'SYNCING' : 'IDLE'}_NODE: ${id}</div>`;
            }).join('');
        })
        .catch(() => {
            scanner.innerHTML = '<div class="scan-line">> NETWORK_ERROR: OFFLINE_SCAN</div>';
        });

    // 2. Actualización de valores de enlace y buffer
    if (buffer) buffer.innerText = Math.floor(Math.random() * 100) + "%";
    if (frequency) frequency.innerText = (7.80 + Math.random() * 0.1).toFixed(2) + " GHz";
}

// ==========================================
//    RECONSTRUCCIÓN ACCESO 02: NODE DATABASE
// ==========================================
let nodeDataCache = null;
let currentMountedModule = null; // Rastreo global del módulo cargado en DRIVE_A
let currentActiveSector = null; 
let currentSectorLabel = "";   
let activeLoadTimer = null; // Controlador para evitar colisiones entre carga y búsqueda

async function initNodeDatabase() {
    const qaContainer = document.getElementById('nodes-side-qa');
    const catContainer = document.getElementById('nodes-side-cats');
    const pathExt = document.getElementById('nodes-path-ext');
    const viewport = document.getElementById('nodes-viewport');
    
    if (!qaContainer || !catContainer) return;

    // Abortar cualquier carga pendiente
    if (activeLoadTimer) clearTimeout(activeLoadTimer);

    currentActiveSector = null;
    currentSectorLabel = "";
    const searchInput = document.getElementById('node-search-input');
    if (searchInput) searchInput.value = "";

    // Al volver al ROOT: Limpiamos la extensión de la ruta y reiniciamos el visor
    if (pathExt) pathExt.innerText = "";
    if (viewport) {
        viewport.innerHTML = `
            <div style="opacity:0.2; height:100%; display:flex; align-items:center; justify-content:center; font-size:1.5rem; text-align:center;">
                UPLINK_ESTABLISHED<br>SELECT_NODE_FOR_DATA_DUMP
            </div>`;
    }

    // Limpiar estado activo de los botones de la sidebar
    document.querySelectorAll('#nodes-sidebar-container .tab-btn').forEach(b => b.classList.remove('active'));

    resetFloppyDrive(false); // Reset inmediato sin animación al volver al ROOT

    try {
        const response = await fetch('TERMINAL.DATA/NODE_FOLDER.xml');
        const text = await response.text();
        const xmlDoc = new DOMParser().parseFromString(text, "text/xml");

        // 1. Inyectar Quick Access
        qaContainer.innerHTML = '';
        xmlDoc.querySelectorAll('quick-access node').forEach(node => {
            const label = node.getAttribute('label');
            const icon = node.getAttribute('icon');
            const id = node.getAttribute('id');
            
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.innerHTML = `<span style="opacity:0.6; margin-right:10px;">${icon}</span> ${label}`;
            btn.onclick = () => loadNodeCategory(id, label, btn);
            qaContainer.appendChild(btn);
        });

        // 2. Inyectar Categorías (Sidebar)
        catContainer.innerHTML = '';
        xmlDoc.querySelectorAll('sidebar node').forEach(node => {
            const label = node.getAttribute('label');
            const icon = node.getAttribute('icon');
            const id = node.getAttribute('id');
            
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.innerHTML = `<span style="opacity:0.6; margin-right:10px;">${icon}</span> ${label}`;
            btn.onclick = () => loadNodeCategory(id, label, btn);
            catContainer.appendChild(btn);
        });

    } catch (e) {
        console.error("CRITICAL_ERROR: NODE_FOLDER access denied.", e);
    }
}

// MOTOR DE NAVEGACIÓN: Actualización responsiva de la barra de ruta
async function loadNodeCategory(id, label, btnElement) {
    // PROTOCOLO DE REDIRECCIÓN: Si es el ROOT, volvemos al estado inicial limpio
    if (id === 'view-root') {
        initNodeDatabase();
        return;
    }

    currentActiveSector = id;
    currentSectorLabel = label;
    const pathExt = document.getElementById('nodes-path-ext');
    const viewport = document.getElementById('nodes-viewport');

    // 0. Cancelar cualquier proceso de carga o búsqueda anterior
    if (activeLoadTimer) clearTimeout(activeLoadTimer);

    // 1. Actualización de Breadcrumbs (C:\NODES > NOMBRE_CATEGORIA)
    if (pathExt) {
        pathExt.innerText = ` > ${label.toUpperCase()}`;
    }

    // 2. Gestión de estado activo en la UI
    document.querySelectorAll('#nodes-sidebar-container .tab-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    // 3. Audio Feedback
    if (SYSTEM_SOUNDS.snd_click) {
        SYSTEM_SOUNDS.snd_click.currentTime = 0;
        SYSTEM_SOUNDS.snd_click.play().catch(e => {});
    }

    // 4. Placeholder del visor (Preparando la inyección de unidades para el siguiente paso)
    if (viewport) {
        viewport.innerHTML = `<div class="sync-text-anim" style="padding: 25px; font-family: inherit;">
            > ACCESSING_SECTOR: ${id}...<br>
            > STATUS: SYNCING_MANIFEST...<br><br>
            [ DATA_STREAM_PENDING_INJECTION ]
        </div>`;
    }

    // 5. Motor de Carga y Renderizado de Dossiers
    try {
        if (!nodeDataCache) {
            const res = await fetch('TERMINAL.DATA/UNITS.json');
            nodeDataCache = await res.json();
        }

        const units = nodeDataCache[id] || [];
        
        // Simulamos un breve tiempo de descifrado para ver el placeholder
        setTimeout(() => {
            if (units.length === 0) {
                viewport.innerHTML = `<div style="padding: 25px; opacity: 0.3;">> NO_DATA_NODES_FOUND_IN_SECTOR</div>`;
                return;
            }

            activeLoadTimer = setTimeout(() => {
                if (units.length === 0) {
                    viewport.innerHTML = `<div style="padding: 25px; opacity: 0.3;">> NO_DATA_NODES_FOUND_IN_SECTOR</div>`;
                } else {
                    renderDossierList(units, label);
                }
                viewport.scrollTop = 0;
                activeLoadTimer = null;
            }, 600);
        }, 600);
    } catch (e) { console.error("Dossier injection failed.", e); }
}

// MOTOR DE BÚSQUEDA TÁCTICA
async function filterNodesBySearch(query) {
    const viewport = document.getElementById('nodes-viewport');
    if (!viewport) return;

    playTypingSound(); // Inyectar feedback auditivo de hardware

    // Abortar carga de categoría si el usuario está buscando
    if (activeLoadTimer) clearTimeout(activeLoadTimer);

    const q = query.trim().toUpperCase();

    if (!nodeDataCache) {
        const res = await fetch('TERMINAL.DATA/UNITS.json');
        nodeDataCache = await res.json();
    }

    if (q === "") {
        if (currentActiveSector) loadNodeCategory(currentActiveSector, currentSectorLabel, null);
        else initNodeDatabase();
        return;
    }

    let results = [];
    if (currentActiveSector) {
        // Búsqueda en el sector actual
        results = (nodeDataCache[currentActiveSector] || [])
            .filter(u => u.id.toUpperCase().includes(q))
            .map(u => ({...u, _cat: currentSectorLabel}));
    } else {
        // BÚSQUEDA GLOBAL: Rastreo en toda la base de datos (Home)
        Object.entries(nodeDataCache).forEach(([catId, units]) => {
            const filtered = units.filter(u => u.id.toUpperCase().includes(q));
            filtered.forEach(u => results.push({...u, _cat: catId.replace('view-', '').toUpperCase()}));
        });
    }

    renderDossierList(results, currentActiveSector ? currentSectorLabel : "GLOBAL_SEARCH");
}

// Renderizador unificado de dossiers
function renderDossierList(units, label) {
    const viewport = document.getElementById('nodes-viewport');
    if (units.length === 0) {
        viewport.innerHTML = `<div style="padding: 25px; opacity: 0.3;">> NO_MATCHING_DATA_FOUND</div>`;
        return;
    }

    viewport.innerHTML = `<div class="dossier-grid">` + units.map((unit, index) => {
        const isCorrupted = unit.corrupted === true;
        const ramVal = Math.floor(Math.random() * 40) + (isCorrupted ? 50 : 20);
        const validTags = (unit.tags || []).filter(t => t.trim() !== "");
        const isMounted = currentMountedModule === unit.id;
        const cardCat = unit._cat || label;
        const freqDelay = (Math.random() * 0.5 + 0.3).toFixed(1);
        
        return `
        <div class="dossier-card ${isCorrupted ? 'corrupted' : ''}" style="--i:${index}">
            <div class="dossier-header">
                <div class="dossier-img"><img src="${unit.img}" loading="lazy"></div>
                <div class="dossier-tags">
                    ${validTags.length > 0
                        ? validTags.slice(0, 4).map(t => `<span class="d-tag">${t}</span>`).join('')
                        : `<span class="d-tag ghost-tag">[ DATA_EXPUNGED ]</span>
                                    <span class="d-tag ghost-tag" style="opacity:0.6;">ADDR: 0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase()}</span>
                                    <span class="d-tag ghost-tag" style="opacity:0.4;">CORRUPTION_LEVEL: ${(Math.random() * 99).toFixed(2)}%</span>
                                    <span class="d-tag ghost-tag" style="opacity:0.2;">SIGNAL_LOSS_DETECTED</span>`}
                </div>
            </div>
            <div class="dossier-divider"></div>
            <div class="dossier-mid">
                <div class="dossier-info">
                    <div class="d-name">${unit.id}</div>
                    <div class="d-cat">CATEGORY: ${cardCat.toUpperCase()}</div>
                </div>
                <div class="floppy-icon ${isMounted ? 'picked-up' : ''}" 
                     title="${isMounted ? 'MODULE_IN_DRIVE' : 'HOLD_TO_PICK_UP'}" 
                     data-unitid="${unit.id}"
                     onmousedown="initFloppyDrag(event, '${unit.link}', ${isCorrupted}, '${unit.id}')"
                     ontouchstart="initFloppyDrag(event, '${unit.link}', ${isCorrupted}, '${unit.id}')">
                </div>
            </div>
            <div class="dossier-footer">
                <div class="telemetry-item">
                    <span>RAM_USAGE:</span>
                    <div class="t-bar-bg"><div class="t-bar-fill" style="width:${ramVal}%"></div></div>
                    <span class="t-val">${ramVal}%</span>
                </div>
                <div class="telemetry-item">
                    <span>FREQUENCY:</span>
                    <div class="freq-visual">
                        <div class="f-bar" style="--d:${freqDelay}s"></div><div class="f-bar" style="--d:${freqDelay * 1.2}s"></div><div class="f-bar" style="--d:${freqDelay * 0.8}s"></div><div class="f-bar" style="--d:${freqDelay * 1.5}s"></div>
                    </div>
                </div>
                <span class="kbin-ext">.Kbin</span>
            </div>
        </div>`;
    }).join('') + `</div>`;
}

// --- MOTOR DE ARRASTRE TÉCNICO ---
let activeDragFloppy = null;

function initFloppyDrag(e, link, isCorrupted, unitId) {
    if (activeDragFloppy) return;
    const isTouch = e.type === 'touchstart';
    if (!isTouch && e.button !== 0) return; 
    
    if (isTouch) e.preventDefault(); // Evitar scroll al agarrar
    e.preventDefault(); // Bloqueo de selección de texto en PC y scroll en móvil
    
    // SEGURIDAD: No permitir extraer el mismo módulo que ya está montado
    if (unitId === currentMountedModule) {
        pushLog(`SYSTEM_NOTICE: ${unitId}.kbin is already active in DRIVE_A`, "WARN");
        return;
    }

    // 1. Crear el proxy visual
    const proxy = document.createElement('div');
    proxy.className = 'floppy-icon floppy-dragging';
    if (isCorrupted) proxy.style.background = "var(--error-main)";
    document.body.appendChild(proxy);
    
    activeDragFloppy = {
        element: proxy,
        sourceIcon: e.target,
        data: { link, isCorrupted, unitId }
    };

    // Feedback visual en la tarjeta de origen (Socket vacío)
    activeDragFloppy.sourceIcon.classList.add('picked-up');
    
    updateFloppyPosition(e);
    pushLog(`MODULE_PICKUP: ${unitId}.kbin`, "EXEC");

    if (SYSTEM_SOUNDS.snd_pickup_drive) {
        SYSTEM_SOUNDS.snd_pickup_drive.currentTime = 0;
        SYSTEM_SOUNDS.snd_pickup_drive.play().catch(e => {});
    }

    if (isTouch) {
        document.addEventListener('touchmove', moveFloppyDrag, { passive: false });
        document.addEventListener('touchend', endFloppyDrag);
    } else {
        document.addEventListener('mousemove', moveFloppyDrag);
        document.addEventListener('mouseup', endFloppyDrag);
    }
}

function moveFloppyDrag(e) {
    if (!activeDragFloppy) return;
    const isTouch = e.type === 'touchmove';
    if (isTouch) e.preventDefault(); // Bloquear scroll durante el arrastre

    updateFloppyPosition(e);

    const touch = isTouch ? e.touches[0] : e;

    const slot = document.getElementById('floppy-drive-slot');
    const rect = slot.getBoundingClientRect();
    const isOver = touch.clientX > rect.left && touch.clientX < rect.right && touch.clientY > rect.top && touch.clientY < rect.bottom;

    if (isOver) slot.classList.add('highlight');
    else slot.classList.remove('highlight');
}

function updateFloppyPosition(e) {
    const isTouch = e.type.startsWith('touch');
    const touch = isTouch ? (e.touches[0] || e.changedTouches[0]) : e;
    activeDragFloppy.element.style.left = touch.clientX + 'px';
    activeDragFloppy.element.style.top = touch.clientY + 'px';
}

function endFloppyDrag(e) {
    if (!activeDragFloppy) return;
    const isTouch = e.type === 'touchend';

    const touch = isTouch ? e.changedTouches[0] : e;

    const slot = document.getElementById('floppy-drive-slot');
    const rect = slot.getBoundingClientRect();
    const isDroppedIn = touch.clientX > rect.left && touch.clientX < rect.right && touch.clientY > rect.top && touch.clientY < rect.bottom;

    if (isDroppedIn) {
        slot.classList.remove('highlight');
        processFloppyInsertion(activeDragFloppy.data);
    } else {
        // Si falla la inserción, restauramos el icono original
        activeDragFloppy.sourceIcon.classList.remove('picked-up');
    }

    activeDragFloppy.element.remove();
    activeDragFloppy = null;
    
    document.removeEventListener('touchmove', moveFloppyDrag);
    document.removeEventListener('touchend', endFloppyDrag);
    document.removeEventListener('mousemove', moveFloppyDrag);
    document.removeEventListener('mouseup', endFloppyDrag);
}

function processFloppyInsertion(data) {
    const statusTxt = document.getElementById('drive-status-txt');
    const insertedFloppy = document.getElementById('inserted-floppy');
    const executeBtn = document.getElementById('btn-drive-execute');
    const ejectBtn = document.getElementById('btn-drive-eject');
    const slot = document.getElementById('floppy-drive-slot');

    // PROTOCOLO DE REEMPLAZO DINÁMICO: Si hay otro módulo, primero se expulsa
    if (currentMountedModule && currentMountedModule !== data.unitId) {
        pushLog(`DRIVE_CONFLICT: Ejecting current module for ${data.unitId}.kbin`, "WARN");
        
        resetFloppyDrive(true); // Animación de salida del anterior
        
        // Re-intentar la inserción del nuevo tras el ciclo de eyección
        setTimeout(() => {
            processFloppyInsertion(data);
        }, 1200); 
        return;
    }

    pushLog(`MOUNTING_MODULE: ${data.unitId}.kbin`, "EXEC");
    
    currentMountedModule = data.unitId;
    refreshFloppyIcons();

    // Limpiar estados anteriores para permitir re-inserción
    insertedFloppy.classList.remove('moving-in', 'corrupted');
    executeBtn.style.display = 'none';
    ejectBtn.style.display = 'none';
    slot.classList.remove('active-module');

    if (data.isCorrupted) insertedFloppy.classList.add('corrupted');

    // Iniciar animación mecánica
    setTimeout(() => {
        insertedFloppy.classList.add('moving-in');

        if (SYSTEM_SOUNDS.snd_slide_drive) {
            SYSTEM_SOUNDS.snd_slide_drive.currentTime = 0;
            SYSTEM_SOUNDS.snd_slide_drive.play().catch(e => {});
        }
        
        // Simular tiempo de lectura de hardware
        setTimeout(() => {
            if (statusTxt) statusTxt.innerText = `DRIVE_A: [ ${data.unitId}.kbin ]`;
            slot.classList.add('active-module');
            pushLog(`MODULE_READY: ${data.unitId}`, "OK");

            if (SYSTEM_SOUNDS.snd_insert_drive) {
                SYSTEM_SOUNDS.snd_insert_drive.currentTime = 0;
                SYSTEM_SOUNDS.snd_insert_drive.play().catch(e => {});
            }

            if (ejectBtn) {
                ejectBtn.style.display = 'block';
                ejectBtn.onclick = () => resetFloppyDrive(true);
            }

            if (executeBtn) {
                executeBtn.style.display = 'block';
                executeBtn.onclick = () => {
                    handleNodeClick(null, data.link, data.isCorrupted);
                };
            }
        }, 1000);
    }, 50);
}


function resetFloppyDrive(animate = true) {
    const statusTxt = document.getElementById('drive-status-txt');
    const insertedFloppy = document.getElementById('inserted-floppy');
    const executeBtn = document.getElementById('btn-drive-execute');
    const ejectBtn = document.getElementById('btn-drive-eject');
    const slot = document.getElementById('floppy-drive-slot');

    if (!insertedFloppy) return;

    currentMountedModule = null;
    refreshFloppyIcons();

    if (animate && insertedFloppy.classList.contains('moving-in')) {
        insertedFloppy.classList.remove('moving-in'); // Inicia animación de subida (salida)
        pushLog("EJECTING_MODULE...", "EXEC");

        if (SYSTEM_SOUNDS.snd_remove_drive) {
            SYSTEM_SOUNDS.snd_remove_drive.currentTime = 0;
            SYSTEM_SOUNDS.snd_remove_drive.play().catch(e => {});
        }
        
        setTimeout(() => {
            if (statusTxt) statusTxt.innerText = "DRIVE_A: [ EMPTY ]";
            if (insertedFloppy) insertedFloppy.classList.remove('corrupted');
            if (executeBtn) executeBtn.style.display = 'none';
            if (ejectBtn) ejectBtn.style.display = 'none';
            if (slot) slot.classList.remove('active-module');
        }, 800);
    } else {
        if (statusTxt) statusTxt.innerText = "DRIVE_A: [ EMPTY ]";
        if (insertedFloppy) insertedFloppy.classList.remove('moving-in', 'corrupted');
        if (executeBtn) executeBtn.style.display = 'none';
        if (ejectBtn) ejectBtn.style.display = 'none';
        if (slot) slot.classList.remove('active-module');
    }
}

function closeSecurityGate() {
    closeModal('modal-security-gate');
    resetFloppyDrive(true); // Expulsar el disco al reconocer el fallo
}

function closePanicMonitor() {
    if (corruptionTimer) {
        clearInterval(corruptionTimer);
        corruptionTimer = null;
    }
    const modal = document.getElementById('modal-boot-sequence');
    const screen = document.getElementById('boot-screen');
    if (screen) screen.classList.add('shutdown');
    
    setTimeout(() => {
        if (modal) modal.style.display = 'none';
        resetFloppyDrive(true);
    }, 400);
}

// Sincronizador global de estados de sockets de disquetes
function refreshFloppyIcons() {
    document.querySelectorAll('.floppy-icon[data-unitid]').forEach(icon => {
        if (icon.dataset.unitid === currentMountedModule) icon.classList.add('picked-up');
        else icon.classList.remove('picked-up');
    });
}

// MOTOR DE SEGURIDAD: Control de acceso a nodos corruptos
let corruptionTimer = null;

async function handleNodeClick(event, link, isCorrupted) {
    if (event) event.stopPropagation();
    
    const modal = document.getElementById('modal-boot-sequence');
    const screen = document.getElementById('boot-screen');
    const textContainer = document.getElementById('boot-text-container');
    const panicClose = document.getElementById('boot-panic-close');

    if (!modal || !screen || !textContainer) return;

    // 1. Reset de estado
    textContainer.innerHTML = '';
    if (panicClose) panicClose.style.display = 'none';
    screen.classList.remove('active', 'shutdown', 'corruption-panic');
    modal.style.display = 'flex';

    if (isCorrupted) {
        // --- FLUJO DE ERROR EN EL MONITOR ---
        pushLog(`FATAL_ERROR: KERNEL_PANIC`, "FAIL");
        if (SYSTEM_SOUNDS.snd_format) {
            SYSTEM_SOUNDS.snd_format.currentTime = 0;
            SYSTEM_SOUNDS.snd_format.play().catch(e => {});
        }

        screen.classList.add('active', 'corruption-panic');
        if (panicClose) panicClose.style.display = 'block';

        if (corruptionTimer) clearInterval(corruptionTimer);
        corruptionTimer = setInterval(() => {
            const faults = ["ERR_STACK_OVERFLOW", "ERR_MEMORY_LEAK", "ERR_NULL_PTR", "ERR_SEG_FAULT", "ERR_BITSTREAM_COLLAPSE", "ERR_UPLINK_TERMINATED"];
            const msg = faults[Math.floor(Math.random() * faults.length)];
            const line = document.createElement('div');
            line.style.color = 'var(--error-main)';
            line.style.fontSize = '0.7rem';
            line.innerText = `> CRITICAL_FAULT: ${msg} [0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase()}]`;
            textContainer.appendChild(line);
            
            if (textContainer.children.length > 15) textContainer.removeChild(textContainer.firstChild);
            textContainer.scrollTop = textContainer.scrollHeight;
        }, 80);
        return;
    }

    pushLog(`ACCESS_NODE: STABLE_LINK`, "OK");

    // 2. Audio de secuencia (Solo estables)

    // 2. Audio de secuencia
    if (SYSTEM_SOUNDS.snd_sequence_boot) {
        SYSTEM_SOUNDS.snd_sequence_boot.currentTime = 0;
        SYSTEM_SOUNDS.snd_sequence_boot.play().catch(e => {});
    }

    // 3. Deslizar pantalla hacia el centro
    setTimeout(() => screen.classList.add('active'), 50);

    // 4. Inyectar líneas de arranque
    const steps = [
        "> INITIALIZING MODULE EXECUTION...",
        "> ACCESSING DRIVE_A // PHYSICAL_SECTOR_0",
        "> LOADING KBIN_BUFFER: [||||||||||] 100%",
        "> DECRYPTING RSA-4096 BITSTREAM...",
        "> VERIFYING SECURITY_GATE PROTOCOLS...",
        isCorrupted ? "> [!] WARNING: KERNEL_CORRUPTION_DETECTED" : "> [OK] INTEGRITY_CHECK_PASSED",
        "> ALLOCATING VIRTUAL_ADDR...",
        "> ESTABLISHING NEURAL_UPLINK...",
        "> EXECUTION_READY."
    ];

    // Delays optimizados para sincronizar con la fase de audio de 9s
    const stepDelays = [200, 400, 600, 800, 800, 900, 900, 800, 400];

    for (let i = 0; i < steps.length; i++) {
        const line = document.createElement('div');
        line.className = 'boot-line';
        line.innerText = steps[i];
        if (steps[i].includes('!')) line.style.color = 'var(--error-main)';
        textContainer.appendChild(line);
        
        await new Promise(r => setTimeout(r, stepDelays[i] * bootSpeedMultiplier));
        line.classList.add('visible');
    }

    // 5. Preparar el estado de lanzamiento manual (Anti-Blocker)
    await new Promise(r => setTimeout(r, 500 * bootSpeedMultiplier));
    
    const launchLine = document.createElement('div');
    launchLine.className = 'boot-line visible launch-prompt';
    launchLine.innerText = ">> [ CLICK_TO_ESTABLISH_UPLINK ] <<";
    textContainer.appendChild(launchLine);

    // Convertir toda la pantalla de boot en un botón de disparo
    screen.style.cursor = "pointer";
    screen.onclick = () => {
        screen.onclick = null; // Evitar doble clic
        
        if (SYSTEM_SOUNDS.snd_launch) {
            SYSTEM_SOUNDS.snd_launch.currentTime = 0;
            SYSTEM_SOUNDS.snd_launch.play().catch(e => {});
        }

        screen.classList.add('shutdown');
        
        setTimeout(() => {
            modal.style.display = 'none';
            if (isCorrupted) {
                openModal('modal-security-gate');
            } else {
                window.open(link, '_blank');
                resetFloppyDrive(true);
            }
        }, 600);
    };
    
}

// ==========================================
//    ACCESO 03: CLASSIFIED ARCHIVES CLI
// ==========================================
let pendingSystemReset = false;
let resetTimer = null;
let resetCountdown = 10;
let resetLineRef = null;
let activeDecryptionKey = null; // Clave temporal generada por el minijuego

function openTerminal() {
    openModal('modal-terminal');
    const output = document.getElementById('terminal-output');
    const input = document.getElementById('terminal-input');
    
    if (output.innerHTML === "") {
        output.innerHTML = `
            <div style="color:var(--main-ui)">[ KENEQ_OS CLASSIFIED_UPLINK v3.0.1 ]</div>
            <div style="opacity:0.5">UPLINK_STABILIZED // ADDR: 0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase()}</div>
            <br>
            <div>Type <span style="color:var(--white)">/help</span> or <span style="color:var(--white)">/protocols</span> to list available security commands.</div>
            <br>
        `;
    }

    const promptEl = document.querySelector('.terminal-prompt');
    if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;

    setTimeout(() => input.focus(), 100);
}

// Escuchador de entrada para el prompt
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('terminal-input');
    if (document.activeElement === input) {
        // Purge sequence handling: Capturar Enter/Esc durante la cuenta atrás
        if (pendingSystemReset) {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeSystemReset();
                input.value = "";
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelSystemReset();
                input.value = "";
                return;
            }
        }

        // Feedback sonoro para cada pulsación mecánica (letras, borrar, enter)
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Delete') {
            playTypingSound();
        }

        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (cmd) processTerminalCommand(cmd);
            input.value = "";
        }
    }
});

async function processTerminalCommand(rawCmd) {
    const args = rawCmd.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const output = document.getElementById('terminal-output');
    const promptEl = document.querySelector('.terminal-prompt');

    // 0. ECHO DEL COMANDO (Siempre al principio para evitar que la terminal parezca muerta)
    const displayPath = currentTerminalPath;
    const echo = document.createElement('div');
    echo.className = 't-line-cmd';
    echo.innerText = `${displayPath}> ${rawCmd}`;
    output.appendChild(echo);

    // 1. MODO RECONSTRUCCIÓN ACTIVO (Intercepción de comandos)
    if (inUnfragmentedView) {
        const response = document.createElement('div');
        response.className = 't-line-res';

        if (cmd === '/b' || cmd === '/exit') {
            inUnfragmentedView = false;
            currentTerminalPath = "C:\\ROOT\\TERMINAL\\SYSTEM";
            if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
            response.innerHTML = `> TERMINATING_RECONSTRUCTION_INTERFACE... SESSION_CLOSED.`;
        } else if (cmd === '/fragment-sync') {
            localStorage.removeItem('keneq_manifest_reconstructed');
            localStorage.removeItem('keneq_manifest_unit_count');
            localStorage.removeItem('keneq_manifest_signature');
            localStorage.removeItem('keneq_manifest_shadow');
            inUnfragmentedView = false;
            currentTerminalPath = "C:\\ROOT\\TERMINAL\\SYSTEM";
            if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
            response.innerHTML = `> INITIATING_DECONSTRUCTION...<br>> [!] ALERT: File state reverted to UNFRAGMENTED.KBIN.`;
        } else if (cmd === '/clear') {
            output.innerHTML = "";
            return;
        } else if (cmd === '/ls' || cmd === 'ls') {
            if (!nodeDataCache) {
                const res = await fetch('TERMINAL.DATA/UNITS.json');
                nodeDataCache = await res.json();
            }
            let listHtml = `<br>INDEXING_RECONSTRUCTED_MEMORY_SECTORS:<br>-----------------------------------<br>`;
            for (const [cat, units] of Object.entries(nodeDataCache)) {
                const catName = cat.replace('view-', '').toUpperCase();
                units.forEach(u => {
                    const status = u.corrupted 
                        ? `<span style="color:#ff4444">CORRUPTED</span>` 
                        : `<span style="color:#00ff00">OK</span>`;
                    listHtml += `<div style="font-size:0.75rem; opacity:0.8;">> RECOVERING_NODE: ${catName}::${u.id}... ${status}</div>`;
                });
            }
            listHtml += `<br>TOTAL_NODES_SYNCED: ${localStorage.getItem('keneq_manifest_unit_count') || 0}<br>`;
            listHtml += `> Enter Node ID to inspect raw dossier data.<br>`;
            response.innerHTML = listHtml;
        } else if (cmd === '/help' || cmd === '/protocols') {
            response.innerHTML = `
                RECONSTRUCTION_VIEW_PROTOCOLS:<br>
                ----------------------------<br>
                /ls              - List all reconstructed node IDs.<br>
                /clear           - Clear terminal buffer.<br>
                /b or /exit      - Return to SYSTEM directory.<br>
                /fragment-sync   - Wipe local manifest and return to RAW state.<br>
                [Node ID]        - Inspect specific neural pattern.
            `;
        } else {
            // Buscamos el nodo en nodeDataCache
            if (!nodeDataCache) {
                const res = await fetch('TERMINAL.DATA/UNITS.json');
                nodeDataCache = await res.json();
            }

            let foundUnit = null;
            for (const cat in nodeDataCache) {
                foundUnit = nodeDataCache[cat].find(u => u.id.toLowerCase() === cmd);
                if (foundUnit) break;
            }

            if (foundUnit) {
                const idHex = "#" + Math.floor(Math.random()*0xFFFFFF).toString(16).toUpperCase();
                const status = foundUnit.corrupted ? "CORRUPTED" : "OPERATIONAL";
                const core = "v." + (Math.random() * 9 + 1).toFixed(1);
                const sync = foundUnit.corrupted ? "0%" : "100%";
                
                const asciiBorder = "+-----------------------------------------------------------+";
                
                let descContent = foundUnit.desc;
                if (!descContent || descContent.trim() === "") {
                    let dump = "";
                    for(let k=0; k<24; k++) {
                        dump += "0x" + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4, '0') + (k % 4 === 3 ? "<br>" : "  ");
                    }
                    descContent = `<div style="opacity:0.5; font-size:0.7rem; line-height:1.2; letter-spacing:1px;">${dump}</div>`;
                }

                let galleryHtml = "";
                if (foundUnit.gallery && foundUnit.gallery.length > 0) {
                    galleryHtml = `
                        <div>${asciiBorder}</div>
                        <div style="padding:5px 12px;">
                            <span style="color:var(--white); font-weight:bold; font-size:0.95rem;">[ NEURAL_IMAGE_GALLERY ]</span><br>
                            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
                                ${foundUnit.gallery.map(gUrl => `
                                    <div style="border:1px solid var(--main-dim); padding:2px; background:#000; position:relative; width:140px;">
                                        <div style="position:relative; width:100%; height:90px; overflow:hidden;">
                                            <img src="${gUrl}" style="width:100%; height:100%; object-fit:cover; display:block; filter:grayscale(1) contrast(1.6) brightness(0.7); image-rendering: pixelated;">
                                            <!-- Filtro ASCII reducido para miniaturas -->
                                            <div style="position:absolute; top:0; left:0; width:100%; height:100%; background-image: radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px); background-size: 2px 2px; pointer-events:none;"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>`;
                }

                response.innerHTML = `
                    <div data-node-id="${foundUnit.id}" style="margin-top:15px; font-family:inherit; color:var(--main-ui); line-height:1.2;">
                        <div>${asciiBorder}</div>
                        <div style="display:flex; justify-content:space-between; padding:0 12px; font-size:1rem;">
                            <span>| [ NODE_RECONSTRUCTION: ${foundUnit.id} ]</span>
                            <span>|</span>
                        </div>
                        <div>${asciiBorder}</div>
                        <div style="padding:5px 12px; font-size:0.75rem; color:var(--second-ui); opacity:0.8;">
                            > ADDR_PTR: 0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase()} // CORE: ${core} // SYNC: ${sync} // STATE: ${status}
                        </div>
                        <div>${asciiBorder}</div>
                        <div style="padding:15px; text-align:left; background:rgba(0,0,0,0.3);">
                            <div style="display:inline-block; border:1px solid var(--main-dim); padding:4px; background:#000; position:relative;">
                                <div style="position:relative; width:280px; height:auto; overflow:hidden;">
                                    <img src="${foundUnit.img}" style="width:100%; height:auto; display:block; filter:grayscale(1) contrast(1.6) brightness(0.7); image-rendering: pixelated;">
                                    <!-- Simulación de Filtro ASCII / Halftone mediante rejilla -->
                                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; background-image: radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px); background-size: 3px 3px; pointer-events:none;"></div>
                                </div>
                                <div style="font-size:0.6rem; opacity:0.4; margin-top:5px; letter-spacing:2px;">// BINARY_IMAGE_STREAM_LINK_STABLE //</div>
                            </div>
                        </div>
                        <div>${asciiBorder}</div>
                        <div style="padding:5px 12px;">
                            <span style="color:var(--white); font-weight:bold; font-size:0.95rem;">[ SYSTEM_TAGS ]</span><br>
                            <span style="font-size:0.85rem; letter-spacing:1px;">${foundUnit.tags && foundUnit.tags[0] !== "" ? foundUnit.tags.join(' | ') : '[ DATA_EXPUNGED ]'}</span>
                        </div>
                        <div>${asciiBorder}</div>
                        <div style="padding:5px 12px;">
                            <span style="color:var(--white); font-weight:bold; font-size:0.95rem;">[ NEURAL_MANIFEST_LOG ]</span><br>
                            <div style="font-size:0.9rem; color:var(--second-ui); text-align:justify; margin-top:5px;">${descContent}</div>
                        </div>
                        ${galleryHtml}
                        <div>${asciiBorder}</div>
                        ${foundUnit.corrupted ? `
                        <div style="padding:8px 12px; background:rgba(255,0,0,0.15); color:#ff4444; font-weight:bold; text-align:center; font-size:0.85rem;">
                            [!!] CRITICAL_FAULT: NEURAL_PATTERN_CORRUPTED [!!]
                        </div>
                        <div>${asciiBorder}</div>` : ''}
                    </div>
                `;
            } else {
                response.innerHTML = `<span class="t-line-err">ERROR: Node ID '${rawCmd}' not found in reconstructed manifest.</span>`;
            }
        }
        output.appendChild(response);
        output.scrollTop = output.scrollHeight;
        return;
    }

    // 2. Lógica de respuesta
    const response = document.createElement('div');
    response.className = 't-line-res';

    switch(cmd) {
        case '/help':
        case '/protocols':
            response.innerHTML = `
                AVAILABLE_SECURITY_PROTOCOLS:<br>
                ----------------------------<br>
                /help            - Displays this manual.<br>
                /protocols       - Displays active command directory.<br>
                /sys-reset       - Re-initialize terminal environment.<br>
                /uplink-addr     - Display permanent proxy identifier.<br>
                /hw-audit        - Execute real-time hardware diagnostic.<br>
                /decrypt-sync    - Initialize bit-stream alignment puzzle.<br>
                use [PROTOCOL]   - Execute recovery protocol on local sectors.<br>
                /fragment-sync   - (Admin) Force local manifest deconstruction.<br>
                /ls              - List restricted data fragments.<br>
                /pwd             - Print working directory details.<br>
                /b               - Move to parent directory.<br>
                /clear           - Clear terminal buffer.<br>
                /exit            - Terminate classified uplink.
            `;
            break;
        case '/fragment-sync':
            localStorage.removeItem('keneq_manifest_reconstructed');
            localStorage.removeItem('keneq_manifest_unit_count');
            localStorage.removeItem('keneq_manifest_signature');
            localStorage.removeItem('keneq_manifest_shadow');
            response.innerHTML = `> [!] ALERT: MANIFEST_PURGED. System reverted to UNFRAGMENTED.KBIN state.`;
            if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
            break;
        case '/pwd':
            const vfsData = getArchiveVFS()[currentTerminalPath];
            const pFiles = vfsData ? vfsData.files.length : 0;
            const pDirs = vfsData ? vfsData.dirs.length : 0;
            const pWeight = (pFiles * 24.8 + pDirs * 1.2 + (localStorage.getItem('keneq_manifest_reconstructed') ? 450 : 0)).toFixed(2);
            response.innerHTML = `
                LOCATION_TRACE_RESULTS:<br>
                ----------------------------<br>
                > ABSOLUTE_PATH: <span style="color:var(--white); text-shadow:var(--main-glow);">${currentTerminalPath}</span><br>
                > NODE_CONTENT: ${pFiles} Fragment(s), ${pDirs} Cluster(s)<br>
                > CLUSTER_WEIGHT: ${pWeight} KB<br>
                > ACCESS_STATUS: <span style="color:#00ff00;">AUTHENTICATED</span>
            `;
            break;
        case '/b':
            if (currentTerminalPath !== "C:\\ROOT\\TERMINAL") {
                const parts = currentTerminalPath.split('\\');
                parts.pop();
                currentTerminalPath = parts.join('\\');
                if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
                response.innerHTML = `> MOVED_TO: ${currentTerminalPath}<br>` + getDirListingHTML(currentTerminalPath);
            } else {
                response.innerHTML = `<span class="t-line-warn">ROOT_DIRECTORY_REACHED. Cannot move back.</span>`;
            }
            break;
        case '/clear':
            output.innerHTML = "";
            // Al limpiar, restauramos el prompt a la base de la ruta actual
            if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
            return;
        case '/decrypt-sync':
            if (!checkFileAccess('unfragmented.kbin', response)) break;
            
            const generatePuzzleHex = () => "0x" + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4, '0');
            const basePuzzleHex = generatePuzzleHex();
            let diffPuzzleHex = basePuzzleHex;
            while(diffPuzzleHex === basePuzzleHex) diffPuzzleHex = generatePuzzleHex();
            activeDecryptionKey = diffPuzzleHex;
            const puzzleCodes = [basePuzzleHex, basePuzzleHex, basePuzzleHex, diffPuzzleHex].sort(() => Math.random() - 0.5);

            response.innerHTML = `
                [!] INITIATING_BIT_STREAM_ALIGNMENT...<br>
                Identify the unique HEX sequence to generate the access key:<br><br>
                <span style="color:var(--white); letter-spacing:8px; font-weight:bold;">${puzzleCodes.join("  ")}</span><br><br>
                > HINT: The key is the sequence that breaks the parity.<br>
                > Use: <span style="color:var(--white)">unfragmented.kbin [KEY]</span> to unlock.
            `;
            break;
        case '/sys-reset':
            startSystemResetSequence();
            return;
        case '/uplink-addr':
            const proxy = localStorage.getItem('keneq_proxy_id');
            response.innerHTML = `LOCAL_PROXY_IDENTIFIER: <span style="color:var(--white); text-shadow:var(--main-glow);">${proxy}</span><br><span style="opacity:0.4;">[!] This address is permanent and device-bound.</span>`;
            break;
        case '/hw-audit':
            response.innerHTML = "EXECUTING_HARDWARE_SCAN...<br>";
            const info = await getRealHardwareSpecs();
            response.innerHTML += `
                > OS_PLATFORM: <span style="color:var(--white);">${info.os}</span><br>
                > CPU_COMPUTE_NODE: <span style="color:var(--white);">${info.cpu}</span><br>
                > MEMORY_VOLATILE: <span style="color:var(--white);">~${info.ram} GB</span> // [ DDR4_ECC_SYNC ]<br>
                > GPU_RENDER_MATRIX: <span style="color:var(--white);">${info.gpu}</span><br>
                > STORAGE_CAPACITY: <span style="color:var(--white);">${info.storage}</span><br>
                > STATUS: <span style="color:#00ff00;">OPTIMAL</span>
            `;
            break;
        case '/ls':
            response.innerHTML = getDirListingHTML(currentTerminalPath);
            break;
        case 'encrypted_memo.txt':
            if (!checkFileAccess('encrypted_memo.txt', response)) break;
            response.innerHTML = `
                <div style="background:rgba(255,255,255,0.05); padding:15px; border:1px solid var(--white); color:var(--white); font-family:monospace;">
                    [ MEMO_NOTEPAD v1.0 ]<br>
                    ---------------------<br>
                    FROM: OPERATOR_09<br>
                    SUBJECT: THE_VOID_ECHO<br><br>
                    I've seen it. The "None" level isn't empty. It's a buffer.<br>
                    Something is trying to climb out through the uplink.<br>
                    If the spectrum shifts to 7.83GHz... cut the power.<br>
                    Don't trust the sync. They are watching.<br>
                    ---------------------
                </div>
            `;
            break;
        case 'sys_dump.log':
            if (!checkFileAccess('sys_dump.log', response)) break;
            response.innerHTML = `
                <div style="color:#00ff00; font-family:monospace; font-size:0.75rem;">
                    [LOG] 00:01:04 - KERNEL_INIT: OK<br>
                    [LOG] 00:02:15 - NEURAL_LINK_STABILIZED<br>
                    [LOG] 04:20:00 - <span style="color:var(--orange-txt)">WARNING: BUFFER_OVERFLOW_IN_SECTOR_7</span><br>
                    [LOG] 04:20:05 - ERR_NULL_PTR: Accessing memory 0xDEADBEEF<br>
                    [LOG] 04:21:12 - DUMPING STACK TRACE... SUCCESS.<br>
                    [LOG] 05:00:00 - SYSTEM_IDLE. MONITORING_ACTIVE.
                </div>
            `;
            break;
        case 'neural_interface.bin':
            if (!checkFileAccess('neural_interface.bin', response)) break;
            response.innerHTML = `> ERROR: RAW_BINARY_DATA cannot be parsed in text mode. Use hardware bridge.`;
            break;
        case 'vault_key.kbin':
            if (!checkFileAccess('vault_key.kbin', response)) break;
            response.innerHTML = `> KEY_FRAGMENT: <span style="color:var(--white); text-shadow:var(--main-glow);">KQ-77-ALPHA-X</span>`;
            break;
        case 'project_neven.log':
            if (!checkFileAccess('project_neven.log', response)) break;
            response.innerHTML = `
                <div style="background:rgba(0,183,255,0.05); padding:15px; border:1px solid var(--second-ui); color:var(--white); font-family:monospace; font-size:0.8rem;">
                    <span style="color:var(--second-ui)">[ NEVEN_PROJECT_DOSSIER // CONFIDENTIAL ]</span><br>
                    ------------------------------------------------------------<br>
                    [LOG] 2026-06-08: Initializing Project NEVEN.<br>
                    [LOG] Status: Class-0 nodes merged into the hive.<br>
                    [LOG] Warning: Level-5 operator detected unauthorized feedback.<br><br>
                    [DATA] Integrating <span style="color:var(--main-ui)">UPGRADE_V.20</span> templates for cognitive expansion.<br>
                    [DATA] Neural mapping suggests a bridge between THE ALTERS and A51.<br>
                    [NOTE] If synchronization reaches 100%, the "NEVEN" theme (v.0) will override standard terminal logic.<br>
                    [!] WARNING: Cognitive leakage detected in sector C:\\NODES\\SPECIAL.<br>
                    ------------------------------------------------------------
                </div>
            `;
            break;
        case '/exit':
            closeModal('modal-terminal');
            return;
        default:
            // Comprobar si es un intento de navegar a una carpeta
            const currentDirs = getArchiveVFS()[currentTerminalPath].dirs;
            const targetDir = currentDirs.find(d => d.toLowerCase() === cmd);
            if (targetDir) {
                currentTerminalPath += "\\" + targetDir;
                if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
                response.innerHTML = `> ACCESSING_SUBDIRECTORY: ${targetDir}<br>` + getDirListingHTML(currentTerminalPath);
                break;
            }

            // Manejo de manifest_reconstructed.kbin (Persistencia y Sync)
            if (cmd === 'manifest_reconstructed.kbin') {
                if (localStorage.getItem('keneq_manifest_reconstructed') !== 'true') {
                    response.innerHTML = `<span class="t-line-err">FILE_NOT_FOUND: 'manifest_reconstructed.kbin' is not initialized.</span>`;
                    break;
                }
                if (!checkFileAccess('manifest_reconstructed.kbin', response)) break;

                const currentCount = await getTotalUnitCount();
                const storedCount = parseInt(localStorage.getItem('keneq_manifest_unit_count') || 0);
                const currentSig = await getUnitsSignature();
                const storedSig = parseInt(localStorage.getItem('keneq_manifest_signature') || 0);

                if (currentCount !== storedCount || currentSig !== storedSig) {
                    const shadow = JSON.parse(localStorage.getItem('keneq_manifest_shadow') || "{}");
                    let inconsistencies = [];
                    
                    for (const [cat, units] of Object.entries(nodeDataCache)) {
                        const catName = cat.replace('view-', '').toUpperCase();
                        for (const unit of units) {
                            if (!shadow[unit.id]) {
                                inconsistencies.push(`<span class="t-line-err">[!] NEW_MEMORY_NODE: ${catName}::${unit.id}</span>`);
                            } else if (shadow[unit.id].l !== JSON.stringify(unit).length) {
                                inconsistencies.push(`<span class="t-line-err">[!] INTEGRITY_FAULT: SECTOR_${unit.id} (0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase()})</span>`);
                            }
                        }
                    }
                    
                    const errorType = (currentCount !== storedCount) 
                        ? `BITSTREAM_MISMATCH: ${Math.abs(currentCount - storedCount)} NODES`
                        : `DATA_INTEGRITY_VIOLATION: BIT_FLIP_DETECTED`;

                    response.innerHTML = `
                        <span class="t-line-err">> CRITICAL_ERROR: BITSTREAM_OUT_OF_SYNC</span><br>
                        > ERROR_TYPE: ${errorType}<br>
                        > STORED_SIG: ${storedSig} // CURRENT_SIG: ${currentSig}<br><br>
                        <div style="font-size:0.75rem; opacity:0.8; max-height:150px; overflow-y:auto; border-left:1px solid var(--rojo-error); padding-left:10px;">
                            ${inconsistencies.length > 0 ? inconsistencies.join('<br>') : '[!] CHECKSUM_FAILURE: UNKNOWN_SECTOR_MODIFICATION'}
                        </div><br>
                        > RECOMMENDATION: Execute <span style="color:var(--white)">/fragment-sync</span> to purge sectors and re-index.
                    `;
                } else {
                    startUnfragmentedSequence(output, promptEl, true); 
                    return;
                }
                break;
            }

            // Manejo de apertura de unfragmented.kbin con clave
            if (cmd.startsWith('unfragmented.kbin')) {
                if (localStorage.getItem('keneq_manifest_reconstructed') === 'true') {
                    response.innerHTML = `
                        <span class="t-line-err">ERROR: 'unfragmented.kbin' no longer exists.</span><br>
                        > STATUS: File has been reconstructed into <span style="color:var(--white)">'manifest_reconstructed.kbin'</span>.
                    `;
                    break;
                }
                if (!checkFileAccess('unfragmented.kbin', response)) break;

                // Protocolo de inicialización con keyword 'use'
                if (args[1] && args[1].toLowerCase() === 'use' && args[2] && args[2].toLowerCase() === 'decrypt-sync') {
                    const generateHex = () => "0x" + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4, '0');
                    const baseHex = generateHex();
                    let impostorHex = baseHex;
                    while(impostorHex === baseHex) impostorHex = generateHex();
                    activeDecryptionKey = impostorHex;
                    const codes = [baseHex, baseHex, baseHex, impostorHex].sort(() => Math.random() - 0.5);
                    response.innerHTML = `
                        [!] INITIATING_BIT_STREAM_ALIGNMENT...<br>
                        Identify the unique HEX sequence to generate the access key:<br><br>
                        <span style="color:var(--white); letter-spacing:8px; font-weight:bold;">${codes.join("  ")}</span><br><br>
                        > HINT: The key is the sequence that breaks the parity.<br>
                        > Use: <span style="color:var(--white)">unfragmented.kbin [KEY]</span> to unlock.
                    `;
                    break;
                }

                const providedKey = args[1];
                if (!providedKey) {
                    response.innerHTML = `<span class="t-line-err">ERROR: File is AES-LOCKED.</span><br>Initialize with: <span style="color:var(--white)">unfragmented.kbin use decrypt-sync</span>`;
                } else if (activeDecryptionKey && providedKey.toUpperCase() === activeDecryptionKey.toUpperCase()) {
                    activeDecryptionKey = null; // Consumir la clave
                    startUnfragmentedSequence(output, promptEl);
                    return;
                } else {
                    response.innerHTML = `<span class="t-line-err">INTEGRITY_CHECK_FAILED: Invalid decryption key.</span>`;
                }
            } else {
                response.innerHTML = `<span class="t-line-err">ERROR: '${rawCmd}' is not recognized as an command or valid file.</span>`;
            }
    }
    output.appendChild(response);
    output.scrollTop = output.scrollHeight;
}

async function getTotalUnitCount() {
    if (!nodeDataCache) {
        try { const res = await fetch('TERMINAL.DATA/UNITS.json'); nodeDataCache = await res.json(); } catch(e) { return 0; }
    }
    let total = 0;
    for (const cat in nodeDataCache) total += nodeDataCache[cat].length;
    return total;
}

async function getUnitsSignature() {
    if (!nodeDataCache) {
        try { const res = await fetch('TERMINAL.DATA/UNITS.json'); nodeDataCache = await res.json(); } catch(e) { return 0; }
    }
    return JSON.stringify(nodeDataCache).length;
}

// --- MOTOR DE MENÚ CONTEXTUAL Y TRANSMISIÓN ---
document.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('#terminal-output img');
    if (img) {
        e.preventDefault();
        const menu = document.getElementById('terminal-context-menu');
        const dossier = img.closest('[data-node-id]');
        if (!dossier) return;

        contextTargetNodeId = dossier.getAttribute('data-node-id');
        menu.style.display = 'block';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        // Cerrar menú al hacer clic fuera
        const closeMenu = () => { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }
});

async function executeTransmission() {
    if (!contextTargetNodeId || !nodeDataCache) return;
    
    // Reproducir sonido de transmisión aleatorio (gui_trans)
    const transSnd = SYSTEM_SOUNDS.snd_terminal_trans;
    if (transSnd && transSnd.length > 0) {
        const randTrans = transSnd[Math.floor(Math.random() * transSnd.length)];
        randTrans.currentTime = 0;
        randTrans.volume = sfxVol;
        randTrans.play().catch(e => {});
    }

    let unit = null;
    for (const cat in nodeDataCache) {
        unit = nodeDataCache[cat].find(u => u.id === contextTargetNodeId);
        if (unit) break;
    }

    if (unit) {
        // Compilar set de imágenes (Principal + Galería)
        currentTransmissionSet = [unit.img];
        if (unit.gallery) currentTransmissionSet = currentTransmissionSet.concat(unit.gallery.filter(g => g !== ""));
        
        currentTransmissionIndex = 0;
        openTransmission(unit.id);
    }
}

function openTransmission(nodeId) {
    const modal = document.getElementById('modal-transmission');
    const title = document.getElementById('transmission-title');
    if (!modal) return;

    title.innerText = `// IMAGE_STREAM_UPLINK :: ${nodeId}`;
    updateTransmissionDisplay();
    modal.style.display = 'flex';
}

function updateTransmissionDisplay() {
    const img = document.getElementById('transmission-img');
    const counter = document.getElementById('transmission-counter');
    
    img.src = currentTransmissionSet[currentTransmissionIndex];
    counter.innerText = `FRAME_INDEX: ${currentTransmissionIndex + 1} / ${currentTransmissionSet.length}`;
}

function changeTransmissionImg(dir) {
    currentTransmissionIndex += dir;
    if (currentTransmissionIndex < 0) currentTransmissionIndex = currentTransmissionSet.length - 1;
    if (currentTransmissionIndex >= currentTransmissionSet.length) currentTransmissionIndex = 0;
    updateTransmissionDisplay();
    if (SYSTEM_SOUNDS.snd_click) SYSTEM_SOUNDS.snd_click.play();
}

function closeTransmission() {
    document.getElementById('modal-transmission').style.display = 'none';
}

// GENERADOR DE HTML PARA LISTADO DE DIRECTORIO
function getDirListingHTML(path) {
    const dirData = getArchiveVFS()[path];
    const isReconstructed = localStorage.getItem('keneq_manifest_reconstructed') === 'true';
    let listHtml = `<br>DIRECTORY: ${path}<br>-----------------------------------<br>`;
    if (dirData) {
        dirData.dirs.forEach(d => listHtml += `<span style="color:var(--main-ui)">[DIR]</span>  ${d}<br>`);
        dirData.files.forEach(f => {
            let displayFile = f;
            if (path === "C:\\ROOT\\TERMINAL\\SYSTEM" && isReconstructed && f === 'unfragmented.kbin') {
                displayFile = 'manifest_reconstructed.kbin';
            }
            listHtml += `<span style="color:var(--white)">[FILE]</span> ${displayFile}<br>`;
        });
        if (dirData.dirs.length === 0 && dirData.files.length === 0) {
            listHtml += `<span style="opacity:0.5;">(Empty directory)</span>`;
        }
    }
    return listHtml;
}

function checkFileAccess(filename, responseEl) {
    // Si el archivo buscado es el manifiesto reconstruido, validamos contra la ruta de unfragmented
    const lookupKey = filename === 'manifest_reconstructed.kbin' ? 'unfragmented.kbin' : filename;
    const requiredPath = getAllFileLocations()[lookupKey];
    if (currentTerminalPath !== requiredPath) {
        responseEl.innerHTML = `
            <span class="t-line-err">FILE_NOT_FOUND: '${filename}' is not in the current directory.</span><br>
            <span style="opacity:0.5;">Hint: Type 'ls' to see files in ${currentTerminalPath}</span>
        `;
        return false;
    }
    return true;
}

async function getRealHardwareSpecs() {
    // El navegador limita el reporte de RAM por privacidad (máximo suele ser 8)
    const ram = navigator.deviceMemory || "DETECTION_BLOCKED";
    const threads = navigator.hardwareConcurrency || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    let cpuModel = "INTL-CORE_Q_SERIES";
    let arch = "X86_64_STABLE";

    if (isMobile) {
        // HEURÍSTICA MÓVIL
        if (threads === 6) {
            // Patrón exclusivo de Apple (iPhone/iPad A-Series)
            cpuModel = "APPL-A_BIONIC_CORE";
            arch = "ARM_V9_NEURAL";
        } else if (threads === 8) {
            // Estándar de la industria (Snapdragon Gen, Dimensity, Exynos)
            cpuModel = "QCOM-SNAPDRAGON_ADRENO";
            arch = "KRYO_ARM_OCTA";
        } else if (threads === 4) {
            cpuModel = "MTK-HELIO_SERIES";
            arch = "ARM_V8_QUAD";
        } else {
            cpuModel = "GENERIC_ARM_UNIT";
            arch = "AARCH64_MOBILE";
        }
    } else {
        // HEURÍSTICA PC (AMD vs Intel)
        if (threads === 6 || threads === 12 || threads === 16 || threads === 24 || threads === 32) {
            cpuModel = "RYZN-ZEN_X_SERIES";
            arch = "AMD_ZEN_NODE";
        } else if (threads === 14 || threads === 20 || threads === 28) {
            cpuModel = "INTL-V_CORE_HYBRID";
            arch = "ALDER_LAKE_X";
        } else if (threads >= 16) {
            cpuModel = "INTL-XEON_QUANTUM";
            arch = "SERVER_GRADE_X64";
        }
    }

    const cpu = `${threads} THREADS // [ ${cpuModel} ] ARCH: ${arch}`;
    
    let os = navigator.platform;
    
    // Intentar obtener datos más precisos de Windows si el navegador lo permite
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        try {
            const ua = await navigator.userAgentData.getHighEntropyValues(["platform", "platformVersion"]);
            if (ua.platform === "Windows") {
                const majorVersion = parseInt(ua.platformVersion.split('.')[0]);
                os = `Windows ${majorVersion >= 13 ? '11' : '10'} (Build ${ua.platformVersion})`;
            }
        } catch (e) {}
    }
    
    let gpu = "GENERIC_DISPLAY_ADAPTER";
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const rawGpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            gpu = rawGpu.replace(/ANGLE \((.*)\)/, '$1'); // Limpiar el prefijo ANGLE
            if (gpu.toUpperCase().includes("NVIDIA")) gpu += " // [ CUDA_CORES_ACTIVE ]";
            if (gpu.toUpperCase().includes("AMD")) gpu += " // [ RDNA_STREAM_LINK ]";
        }
    } catch(e) {}

    let storage = "ACCESS_DENIED";
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const quotaGB = (estimate.quota / (1024 * 1024 * 1024)).toFixed(2);
        storage = `${quotaGB} GB // [ SSD_NVME_VIRTUAL ]`;
    }

    return { ram, cpu, os, gpu, storage };
}

function startSystemResetSequence() {
    const output = document.getElementById('terminal-output');
    if (pendingSystemReset) return;

    pendingSystemReset = true;
    resetCountdown = 10;

    const warn = document.createElement('div');
    warn.className = 't-line-warn';
    warn.innerHTML = `
        <br>
        [!!!] WARNING: DESTRUCTIVE_RESET_PROTOCOL_INITIALIZED [!!!]<br>
        This operation will PURGE all operator credentials, local repositories,<br>
        uploaded modules, and playground data. Permanent UPLINK_ADDR will persist.<br>
        <br>
        PRESS [ENTER] TO EXECUTE IMMEDIATELY | PRESS [ESC] TO ABORT.<br>
    `;
    output.appendChild(warn);

    resetLineRef = document.createElement('div');
    resetLineRef.style.color = '#ff4444';
    resetLineRef.innerText = `ABORT_WINDOW_CLOSING_IN: ${resetCountdown}...`;
    output.appendChild(resetLineRef);
    output.scrollTop = output.scrollHeight;

    resetTimer = setInterval(() => {
        resetCountdown--;
        if (resetCountdown <= 0) {
            cancelSystemReset();
        } else {
            resetLineRef.innerText = `ABORT_WINDOW_CLOSING_IN: ${resetCountdown}...`;
        }
    }, 1000);
}

function cancelSystemReset() {
    clearInterval(resetTimer);
    pendingSystemReset = false;
    const output = document.getElementById('terminal-output');
    const promptEl = document.querySelector('.terminal-prompt');
    if (promptEl) promptEl.innerText = "C:\\ROOT\\TERMINAL> ";

    const msg = document.createElement('div');
    msg.className = 't-line-res';
    msg.innerText = "> RESET_PROTOCOL_ABORTED. SYSTEM_IDLE.";
    output.appendChild(msg);
    output.scrollTop = output.scrollHeight;
}

function executeSystemReset() {
    clearInterval(resetTimer);
    pendingSystemReset = false;
    const output = document.getElementById('terminal-output');
    const input = document.getElementById('terminal-input');
    if (input) input.disabled = true; // Bloquear entrada durante la purga
    output.innerHTML = '<div class="t-line-err" style="font-size:1.1rem; margin-bottom:10px;">!! INITIATING CRITICAL DATA PURGE !!</div>';

    // 1. ESCANEO DINÁMICO ABSOLUTO DE REGISTROS REALES
    const realWipeTasks = [
        "TERMINATING_SECURITY_UPLINK...",
        "SCANNING_LOCAL_STORAGE_REGISTRY...",
    ];
    
    // Recoger CADA clave real que existe en el almacenamiento del navegador
    Object.keys(localStorage).forEach(key => {
        let val = localStorage.getItem(key) || "NULL";
        // Truncar si el valor es muy largo (ej. JSON de colores o variables) para mantener la estética
        let displayVal = val.length > 25 ? val.substring(0, 22) + "..." : val;

        if (key === 'keneq_proxy_id') {
            realWipeTasks.push(`STABILIZING_UPLINK_IDENTITY: ${key} -> [ ${displayVal} ]`);
        } else {
            realWipeTasks.push(`ERASING_LS_DATA_BLOCK: ${key} -> [ ${displayVal} ]`);
        }
    });

    // Auditoría de SessionStorage
    Object.keys(sessionStorage).forEach(key => {
        let val = sessionStorage.getItem(key) || "NULL";
        let displayVal = val.length > 25 ? val.substring(0, 22) + "..." : val;
        realWipeTasks.push(`WIPING_SESSION_CACHE: ${key} -> [ ${displayVal} ]`);
    });

    // 2. TAREAS DE INFRAESTRUCTURA DE DATOS Y MEMORIA VOLÁTIL
    realWipeTasks.push(`DESTRUCTIVE_CLEAN: INDEXED_DB -> ${DB_NAME}`);

    // Listado real de archivos de audio subidos al Playground
    SYSTEM_PLAYLISTS["NONE"].tracks.forEach(track => {
        const trackName = playgroundNames.get(track) || track;
        realWipeTasks.push(`PURGING_VOLATILE_FILE: audio/${trackName}`);
    });

    // Listado real de casetes en memoria
    tapes.forEach(tape => {
        realWipeTasks.push(`PURGING_VOLATILE_TAPE: ${tape.name}`);
    });

    realWipeTasks.push("FLUSHING_SYSTEM_REGISTRY_CORE...");
    realWipeTasks.push("SHUTTING_DOWN_SYSTEM_KERNEL...");

    let animationDone = false;
    let audioDone = false;

    const finalizePurge = () => {
        const proxyId = localStorage.getItem('keneq_proxy_id');
        localStorage.clear();
        sessionStorage.clear();
        if (proxyId) localStorage.setItem('keneq_proxy_id', proxyId);
        indexedDB.deleteDatabase(DB_NAME);
        window.location.reload();
    };

    const checkCompletion = () => {
        if (animationDone && audioDone) {
            // Pequeño delay de 500ms tras terminar todo para el fundido a negro
            setTimeout(finalizePurge, 500);
        }
    };

    const snd = SYSTEM_SOUNDS.snd_terminal_purge_data;
    if (snd) {
        snd.currentTime = 0;
        snd.volume = sfxVol;
        snd.onended = () => {
            audioDone = true;
            checkCompletion();
        };
        snd.play().catch(() => {
            audioDone = true;
            checkCompletion();
        });
    } else {
        audioDone = true;
    }

    let i = 0;
    const purgeInterval = setInterval(() => {
        if (i < realWipeTasks.length) {
            const line = document.createElement('div');
            line.className = 't-line-err';
            line.style.fontSize = '0.75rem';
            line.innerText = `> [PURGE] ${realWipeTasks[i]}`;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
            i++;
        } else {
            clearInterval(purgeInterval);
            animationDone = true;
            const finalMsg = document.createElement('div');
            finalMsg.style.marginTop = "15px";
            finalMsg.style.color = "var(--white)";
            finalMsg.innerText = "> DATA_WIPE_COMPLETE. WAITING_FOR_HARDWARE_SYNC...";
            output.appendChild(finalMsg);
            
            checkCompletion();
        }
    }, 120); // Velocidad de caída de líneas
}

async function startUnfragmentedSequence(output, promptEl, skipAnim = false) {
    localStorage.setItem('keneq_manifest_reconstructed', 'true');
    inUnfragmentedView = true;
    
    const intro = document.createElement('div');
    intro.className = 't-line-res';
    intro.innerHTML = `<br>[ ACCESS_GRANTED ]<br>[ INITIALIZING_NEURAL_MAPPING_PROTOCOL ]<br>`;
    output.appendChild(intro);

    // Barra de progreso CLI (Omitida si ya estaba abierto y no es /sync)
    if (!skipAnim) {
    const progressLine = document.createElement('div');
    progressLine.className = 't-line-res';
    output.appendChild(progressLine);
    
    for (let i = 0; i <= 20; i++) {
        const percent = i * 5;
        const bar = "█".repeat(i) + "░".repeat(20 - i);
        progressLine.innerText = `RECONSTRUCTING_BITSTREAM: [${bar}] ${percent}%`;
        output.scrollTop = output.scrollHeight;
        await new Promise(r => setTimeout(r, 60));
    }
    }

    if (!nodeDataCache) {
        try {
            const res = await fetch('TERMINAL.DATA/UNITS.json');
            nodeDataCache = await res.json();
        } catch(e) {
            output.innerHTML += `<div class="t-line-err">> CRITICAL_ERROR: REMOTE_DATABASE_UNREACHABLE</div>`;
            inUnfragmentedView = false;
            return;
        }
    }

    let totalCount = 0;
    let shadow = {};
    // Listado de descarga de nodos
    for (const [cat, units] of Object.entries(nodeDataCache)) {
        for (const unit of units) {
            totalCount++;
            shadow[unit.id] = { l: JSON.stringify(unit).length };
            if (!skipAnim) {
            const line = document.createElement('div');
            line.style.fontSize = '0.7rem';
            line.style.opacity = '0.6';
            line.innerText = `> RECOVERING_NODE: ${cat.replace('view-', '').toUpperCase()}::${unit.id}... OK`;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
            await new Promise(r => setTimeout(r, 30));
            }
        }
    }
    
    const finalSig = await getUnitsSignature();
    localStorage.setItem('keneq_manifest_unit_count', totalCount);
    localStorage.setItem('keneq_manifest_signature', finalSig);
    localStorage.setItem('keneq_manifest_shadow', JSON.stringify(shadow));

    const finalMsg = document.createElement('div');
    finalMsg.className = 't-line-res';
    finalMsg.style.color = 'var(--main-ui)';
    finalMsg.innerHTML = `<br>[ RECONSTRUCTION_COMPLETE ]<br>Stored Map: ${totalCount} nodes. Type <span style="color:white">/ls</span> to view all synced IDs or enter Node ID directly.<br>Type <span style="color:white">/b</span> to exit reconstructed view.<br>`;
    output.appendChild(finalMsg);
    
    currentTerminalPath = "C:\\ROOT\\TERMINAL\\SYSTEM\\manifest_reconstructed.kbin\\RECONSTRUCTED";
    if (promptEl) promptEl.innerText = `${currentTerminalPath}> `;
    output.scrollTop = output.scrollHeight;
}

// Iniciar el ciclo de actualización cada 2 segundos
setInterval(updateDiagnosticStats, 2000);


// ==========================================
//    MÓDULO SYSTEM STATUS: LEER KENEQ.TXT Y DIRECCIÓN DINÁMICA
// ==========================================

// 1. Leer y procesar el archivo keneq.txt de tu servidor
async function loadKeneqStatus() {
    const statusEl = document.getElementById('hud-user-status');
    const notesEl = document.getElementById('hud-user-notes');
    
    if (!statusEl || !notesEl) return;

    try {
        // Hacemos el fetch con un timestamp (?t=) para evitar que GitHub cachee tu estado antiguo
        const response = await fetch(`keneq.txt?t=${Date.now()}`);
        if (!response.ok) throw new Error("STATUS_FILE_NOT_FOUND");

        const text = await response.text();

        // Extraer la línea de STATUS usando Expresión Regular
        const statusMatch = text.match(/STATUS:\s*(.*)/i);
        const statusVal = statusMatch ? statusMatch[1].trim() : "OPERATIONAL // NO_MESSAGE";

        // Extraer la línea de NOTES usando Expresión Regular
        const notesMatch = text.match(/NOTES:\s*(.*)/i);
        const notesVal = notesMatch ? notesMatch[1].trim() : "No active system logs detected from creator.";

        // Inyectamos los datos reales en el HTML
        statusEl.innerText = statusVal.toUpperCase();
        notesEl.innerText = `"${notesVal}"`;

        console.log("Estatus y notas del operador sincronizadas con keneq.txt");
    } catch (e) {
        console.error("Error al sincronizar keneq.txt:", e);
        statusEl.innerText = "OFFLINE // DISCONNECTED";
        notesEl.innerText = `"System failed to sync with keneq.txt. Operator uplink is offline."`;
    }
}

// 2. Rotador de direcciones de red (Hexadecimal dinámico)
function startAddressRotator() {
    const addressEl = document.getElementById('hud-dynamic-address');
    if (!addressEl) return;

    setInterval(() => {
        // Genera una dirección física de memoria simulada (ej: 0x7FFA8F4E)
        const hex = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0');
        addressEl.innerText = `UPLINK_ADDR: 0x${hex}`;
    }, 1500); // Cambia el código de conexión cada 1.5 segundos
}

// Inicializar el rotador al cargar la página para que esté funcionando en background
window.addEventListener('load', () => {
    startAddressRotator();
});