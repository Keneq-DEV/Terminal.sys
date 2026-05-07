/* ===================================================
   VFX_ENGINE v9.0 - RAPIDIUM PIXEL MELT (THE ALTERS)
   =================================================== */
const canvas = document.getElementById('vfx-canvas');
const ctx = canvas.getContext('2d');
let vfxId = null;

function resize() {
    canvas.width = window.innerWidth / 2; // Menos resolución = más textura de píxel
    canvas.height = window.innerHeight / 2;
}
window.addEventListener('resize', resize);
resize();

// --- CONFIGURACIÓN DEL MOTOR ---
const VFX_CONFIG = {
    USE_REAL_TIME: false, // true = usa la hora del sistema (24h) | false = ciclo automático
    CYCLE_SPEED: 15,      // Segundos que tarda en pasar de una paleta a otra (en modo automático)
};

// Sistema de Paletas por Horario
const PALETTE_SETS = [
    ['#000814', '#001d3d', '#003566', '#ffc300', '#ffd60a'], // 00-06: Deep Night (Gold/Navy)
    ['#b8f2ff', '#ffffff', '#00d4ff', '#0081a7', '#00afb9'], // 06-12: Dawn (Cyan/White)
    ['#ffcc00', '#ff3c00', '#ff006c', '#ffffff', '#b8f2ff'], // 12-18: Day (Original Thermal)
    ['#2d0a18', '#ff006c', '#8a2be2', '#4b0082', '#000000']  // 18-00: Dusk (Magenta/Purple)
];

let colors = [...PALETTE_SETS[2]]; // Inicializar con la paleta de día

const lerpColor = (a, b, t) => {
    const hex = (x) => x.toString(16).padStart(2, '0');
    const getR = (x) => parseInt(x.substring(1, 3), 16);
    const getG = (x) => parseInt(x.substring(3, 5), 16);
    const getB = (x) => parseInt(x.substring(5, 7), 16);
    return `#${hex(Math.round(getR(a) + (getR(b) - getR(a)) * t))}${hex(Math.round(getG(a) + (getG(b) - getG(a)) * t))}${hex(Math.round(getB(a) + (getB(b) - getB(a)) * t))}`;
};

class EnergyMelt {
    constructor() {
        this.init();
        this.y = Math.random() * canvas.height;
    }

    init() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 50;
        this.w = Math.random() * 8 + 2; // Columnas más anchas
        this.h = Math.random() * 300 + 100;
        this.speed = Math.random() * 15 + 10;
        this.colorIndex = Math.floor(Math.random() * colors.length);
        this.jitter = Math.random() * 4;
    }

    update() {
        this.y -= this.speed;
        // Jitter horizontal violento (Efecto Glitch del GIF)
        this.x += (Math.random() - 0.5) * this.jitter;

        if (this.y + this.h < -50) this.init();
    }

    draw() {
        const activeColor = colors[this.colorIndex];
        // Dibujamos un degradado que se ensancha en el centro
        let g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.2, activeColor);
        g.addColorStop(0.8, activeColor);
        g.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = g;
        // Dibujamos el bloque estirado con bordes "sucios"
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        // Capa de "Core" blanco para la incandescencia
        if (Math.random() > 0.7) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(this.x + this.w/3, this.y + 10, this.w/3, this.h - 20);
        }
    }
}

let streams = [];

function render() {
    // --- ACTUALIZACIÓN DINÁMICA DE COLORES ---
    let t, idx;

    if (VFX_CONFIG.USE_REAL_TIME) {
        const now = new Date();
        const hour = now.getHours();
        const totalSec = (hour * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        const segmentSec = 6 * 3600; 
        idx = Math.floor(hour / 6);
        t = (totalSec % segmentSec) / segmentSec;
    } else {
        // Modo Ciclo Rápido (Configurable en segundos)
        const ms = Date.now();
        const cycleMs = VFX_CONFIG.CYCLE_SPEED * 1000;
        idx = Math.floor((ms / cycleMs) % PALETTE_SETS.length);
        t = (ms % cycleMs) / cycleMs;
    }

    const nextIdx = (idx + 1) % PALETTE_SETS.length;

    for (let i = 0; i < colors.length; i++) {
        colors[i] = lerpColor(PALETTE_SETS[idx][i], PALETTE_SETS[nextIdx][i], t);
    }

    // --- TÉCNICA DE FEEDBACK (SMEAR) ---
    // Dibujamos la imagen anterior sobre sí misma movida 1px hacia arriba
    // Esto crea el efecto de "estiramiento de píxeles" infinito del GIF
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, -2, canvas.width, canvas.height);
    
    // Oscurecemos un poco para que el rastro no sea eterno
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'lighter';
    
    streams.forEach(s => {
        s.update();
        s.draw();
    });

    // GLITCH HORIZONTAL DE PÍXELES (Desgarro)
    if (Math.random() > 0.9) {
        const sy = Math.random() * canvas.height;
        const sh = Math.random() * 40;
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, (Math.random() - 0.5) * 20, sy, canvas.width, sh);
    }

    vfxId = requestAnimationFrame(render);
}


setInterval(() => {
    const isAlter = document.body.classList.contains('theme-legacy');
    if (isAlter && !vfxId) {
        canvas.style.display = "block";
        streams = Array.from({length: 80}, () => new EnergyMelt());
        render();
    } else if (!isAlter && vfxId) {
        canvas.style.display = "none";
        cancelAnimationFrame(vfxId);
        vfxId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}, 500);