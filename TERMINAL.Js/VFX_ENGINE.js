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

// Paleta térmica exacta del GIF
const colors = [
    '#ffcc00', // Oro (Base)
    '#ff3c00', // Naranja Fuego
    '#ff006c', // Magenta
    '#ffffff', // Blanco Calor
    '#b8f2ff'  // Cian Frío (Cima)
];

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
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.jitter = Math.random() * 4;
    }

    update() {
        this.y -= this.speed;
        // Jitter horizontal violento (Efecto Glitch del GIF)
        this.x += (Math.random() - 0.5) * this.jitter;

        if (this.y + this.h < -50) this.init();
    }

    draw() {
        // Dibujamos un degradado que se ensancha en el centro
        let g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.2, this.color);
        g.addColorStop(0.8, this.color);
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

// Activador
/*setInterval(() => {
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
}, 500);*/