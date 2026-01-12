// --- 1. CONFIGURACIÓN Y DATOS INICIALES ---

// Tareas
let DATA = JSON.parse(localStorage.getItem('AGRO_DATA')) || {
    "Estancia La Suiza": [],
    "Don Ismael": []
};

// Stock
let STOCK_POR_CLIENTE = JSON.parse(localStorage.getItem('AGRO_STOCK')) || {
    "Estancia La Suiza": [{ n: "Glifosato", q: 500 }],
    "Don Ismael": []
};

// Perfil de Usuario (Máquina y Tanque)
let PERFIL = JSON.parse(localStorage.getItem('AGRO_PERFIL')) || {
    nombre: "Operario",
    maquina: "Sin asignar",
    tanque: 3000
};

// Aplicadores por cliente (nombre simple por ahora)
let APLICADORES = JSON.parse(localStorage.getItem('AGRO_APLICADORES')) || {};

let usuarioActual = { rol: "operario" };
let seleccion = { cliente: "", tarea: null, tabActual: "Nueva" };
let pilaNavegacion = [];

// Función Global de Guardado
function guardarTodo() {
    localStorage.setItem('AGRO_DATA', JSON.stringify(DATA));
    localStorage.setItem('AGRO_STOCK', JSON.stringify(STOCK_POR_CLIENTE));
    localStorage.setItem('AGRO_PERFIL', JSON.stringify(PERFIL));
    localStorage.setItem('AGRO_APLICADORES', JSON.stringify(APLICADORES));
}

/* ===== Helpers de UI: modales simples (promesas) y utilidades ===== */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}

function showAlert(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('modal');
        const previouslyFocused = document.activeElement;
        modal.querySelector('.modal-title').innerText = 'Aviso';
        modal.querySelector('.modal-body').innerHTML = escapeHtml(message);
        const inputBox = modal.querySelector('.modal-input');
        inputBox.innerHTML = '';
        const ok = modal.querySelector('.btn-modal-ok');
        const cancel = modal.querySelector('.btn-modal-cancel');
        const backdrop = modal.querySelector('.modal-backdrop');
        cancel.style.display = 'none';

        const cleanup = () => {
            document.removeEventListener('keydown', onKey);
            backdrop.removeEventListener('click', onBackdrop);
            modal.querySelector('.modal-content').removeEventListener('click', stopProp);
            try { if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus(); } catch(e) {}
            // Asegurarnos de que ningún elemento dentro del modal quede enfocado antes de esconderlo.
            setTimeout(() => {
                try { if (modal.contains(document.activeElement)) document.activeElement.blur(); } catch(e) {}
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden','true');
            }, 10);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(); }
        };
        const onBackdrop = () => { cleanup(); resolve(); };
        const stopProp = (e) => e.stopPropagation();

        ok.onclick = () => { cleanup(); resolve(); };

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
        setTimeout(()=>ok.focus(), 50);

        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('click', onBackdrop);
        modal.querySelector('.modal-content').addEventListener('click', stopProp);
    });
}

function showConfirm(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('modal');
        const previouslyFocused = document.activeElement;
        modal.querySelector('.modal-title').innerText = 'Confirmar';
        modal.querySelector('.modal-body').innerHTML = escapeHtml(message);
        const inputBox = modal.querySelector('.modal-input');
        inputBox.innerHTML = '';
        const ok = modal.querySelector('.btn-modal-ok');
        const cancel = modal.querySelector('.btn-modal-cancel');
        const backdrop = modal.querySelector('.modal-backdrop');
        cancel.style.display = 'inline-block';

        const cleanup = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.removeEventListener('click', onBackdrop);
            modal.querySelector('.modal-content').removeEventListener('click', stopProp);
            try { if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus(); } catch(e) {}
            setTimeout(() => {
                try { if (modal.contains(document.activeElement)) document.activeElement.blur(); } catch(e) {}
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden','true');
                resolve(result);
            }, 10);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
        };
        const onBackdrop = () => { cleanup(false); };
        const stopProp = (e) => e.stopPropagation();

        ok.onclick = () => { cleanup(true); };
        cancel.onclick = () => { cleanup(false); };

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
        setTimeout(()=>ok.focus(), 50);

        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('click', onBackdrop);
        modal.querySelector('.modal-content').addEventListener('click', stopProp);
    });
}

function showPrompt(message, placeholder='') {
    return new Promise(resolve => {
        const modal = document.getElementById('modal');
        const previouslyFocused = document.activeElement;
        modal.querySelector('.modal-title').innerText = 'Ingrese valor';
        modal.querySelector('.modal-body').innerHTML = escapeHtml(message);
        const inputBox = modal.querySelector('.modal-input');
        inputBox.innerHTML = '<input id="modal-prompt-input" placeholder="' + escapeHtml(placeholder) + '" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd;">';
        const input = inputBox.querySelector('#modal-prompt-input');
        const ok = modal.querySelector('.btn-modal-ok');
        const cancel = modal.querySelector('.btn-modal-cancel');
        const backdrop = modal.querySelector('.modal-backdrop');
        cancel.style.display = 'inline-block';

        const cleanup = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.removeEventListener('click', onBackdrop);
            modal.querySelector('.modal-content').removeEventListener('click', stopProp);
            try { if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus(); } catch(e) {}
            setTimeout(() => {
                try { if (modal.contains(document.activeElement)) document.activeElement.blur(); } catch(e) {}
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden','true');
                resolve(result);
            }, 10);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
        };
        const onBackdrop = () => { cleanup(null); };
        const stopProp = (e) => e.stopPropagation();

        ok.onclick = () => { cleanup(input.value.trim()); };
        cancel.onclick = () => { cleanup(null); };

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
        setTimeout(()=>input.focus(),50);

        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('click', onBackdrop);
        modal.querySelector('.modal-content').addEventListener('click', stopProp);
    });
}

/* ======================================== */

async function agregarAplicadorPrompt() {
    if(!seleccion.cliente) { await showAlert('Seleccione un cliente antes.'); return; }
    const nombre = await showPrompt('Nombre del aplicador:', 'Nombre Apellido');
    if(!nombre) return;
    if(!APLICADORES[seleccion.cliente]) APLICADORES[seleccion.cliente] = [];
    if(APLICADORES[seleccion.cliente].includes(nombre)) { await showAlert('Ese aplicador ya existe para este cliente.'); return; }
    APLICADORES[seleccion.cliente].push(nombre);
    guardarTodo();
    // actualizar select
    const sel = document.getElementById('new-task-aplicador');
    const opt = document.createElement('option'); opt.value = nombre; opt.innerText = nombre; sel.appendChild(opt);
    sel.value = nombre;
}


async function showSelectOption(message, options){
    return new Promise(resolve => {
        const modal = document.getElementById('modal');
        const previouslyFocused = document.activeElement;
        modal.querySelector('.modal-title').innerText = 'Seleccionar aplicador';
        modal.querySelector('.modal-body').innerHTML = escapeHtml(message);
        const inputBox = modal.querySelector('.modal-input');
        inputBox.innerHTML = '';
        const ok = modal.querySelector('.btn-modal-ok');
        const cancel = modal.querySelector('.btn-modal-cancel');
        const backdrop = modal.querySelector('.modal-backdrop');
        cancel.style.display = 'inline-block';

        const cleanup = () => {
            document.removeEventListener('keydown', onKey);
            backdrop.removeEventListener('click', onBackdrop);
            modal.querySelector('.modal-content').removeEventListener('click', stopProp);
            try { if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus(); } catch(e) {}
            setTimeout(() => {
                try { if (modal.contains(document.activeElement)) document.activeElement.blur(); } catch(e) {}
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden','true');
            }, 10);
        };

        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(null); } };
        const onBackdrop = () => { cleanup(); resolve(null); };
        const stopProp = (e) => e.stopPropagation();

        // Opciones como botones
        options.forEach(opt => {
            const b = document.createElement('button');
            b.className = 'btn-secondary';
            b.style.marginRight = '8px';
            b.style.marginBottom = '8px';
            b.innerText = opt;
            b.onclick = () => { cleanup(); resolve(opt); };
            inputBox.appendChild(b);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-primary';
        addBtn.style.display = 'block';
        addBtn.style.marginTop = '8px';
        addBtn.innerText = '+ Agregar nuevo aplicador';
        addBtn.onclick = async () => {
            const name = await showPrompt('Nombre del aplicador nuevo:', 'Nombre Apellido');
            if (name) { cleanup(); resolve(name); }
        };
        inputBox.appendChild(addBtn);

        // Ocultamos botones por defecto: el OK no se usa
        ok.style.display = 'none';
        cancel.onclick = () => { cleanup(); resolve(null); };

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
        setTimeout(()=>{ const first = inputBox.querySelector('button'); if(first) first.focus(); }, 50);

        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('click', onBackdrop);
        modal.querySelector('.modal-content').addEventListener('click', stopProp);
    });
}

async function cambiarAplicador(){
    if(!seleccion.cliente || !seleccion.tarea) { await showAlert('No hay tarea seleccionada.'); return; }
    const lista = APLICADORES[seleccion.cliente] || [];
    let elegido = null;
    if(lista.length === 0){
        const nombre = await showPrompt('No existen aplicadores para este cliente. Ingrese nombre para crear:', 'Nombre Apellido');
        if(!nombre) return;
        APLICADORES[seleccion.cliente] = [nombre];
        elegido = nombre;
    } else {
        const opt = await showSelectOption('Elija aplicador para esta tarea:', lista);
        if(!opt) return;
        elegido = opt;
        if(!APLICADORES[seleccion.cliente].includes(elegido)) APLICADORES[seleccion.cliente].push(elegido);
    }

    seleccion.tarea.aplicador = elegido;
    guardarTodo();

    const detBox = document.getElementById('det-aplicador-box');
    const detName = document.getElementById('det-aplicador-name');
    if(seleccion.tarea.aplicador){ detBox.classList.remove('hidden'); detName.innerText = '👨‍🌾 ' + seleccion.tarea.aplicador; }
    else { detBox.classList.add('hidden'); detName.innerText = ''; }

    // Re-renderizar lista de tareas y detalle
    cambiarTab(seleccion.tabActual);
    await showAlert('Aplicador actualizado.');
}


// --- 2. NAVEGACIÓN ---

function navegarA(id, push = true) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    if (push) pilaNavegacion.push(id);
    
    // Configuración del Header
    const header = document.getElementById('main-header');
    header.classList.toggle('hidden', id === 'screen-login');
    
    // Botón volver visible excepto en Main y Login
    const btnVolver = document.getElementById('btn-volver');
    btnVolver.style.visibility = (id === 'screen-main' || id === 'screen-login') ? 'hidden' : 'visible';
}

function volverAtras() {
    if (pilaNavegacion.length > 1) {
        // Quitamos la pantalla actual y navegamos a la anterior sin duplicar la entrada en la pila
        pilaNavegacion.pop(); // quitar actual
        const anterior = pilaNavegacion[pilaNavegacion.length - 1];
        if (anterior) navegarA(anterior, false);
    }
}

function toggleMenu() {
    document.getElementById('side-panel').classList.toggle('open');
}

// --- 3. LOGIN Y MENÚ ---

function login() {
    usuarioActual.rol = document.getElementById('login-role').value;
    document.getElementById('app-title-display').innerText = usuarioActual.rol === "ingeniero" ? "AgroControl (ING)" : "AgroControl";
    
    configurarMenu();
    renderClientes();
    
    // Mostrar botón de crear cliente solo si es Ingeniero
    const btnAdd = document.getElementById('btn-add-client');
    if(usuarioActual.rol === "ingeniero") btnAdd.classList.remove('hidden');
    else btnAdd.classList.add('hidden');
    
    navegarA('screen-main');
}

function configurarMenu() {
    const menu = document.getElementById('menu-options');
    // textos sin emojis (evita problemas de encoding)
    let html = '<button onclick="toggleMenu(); navegarA(\'screen-main\')">Mis Clientes</button>';

    // Opción extra para operario
    if(usuarioActual.rol === "operario") {
        html += '<button onclick="irAPerfil()">Mi Máquina</button>';
    }

    html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin:10px 0;"></hr><button onclick="location.reload()" style="color:#ff8a80;">Cerrar Sesión</button>';
    menu.innerHTML = html;
}

// --- 4. GESTIÓN DE PERFIL (OPERARIO) ---
function irAPerfil() {
    document.getElementById('prof-nombre').value = PERFIL.nombre;
    document.getElementById('prof-maquina').value = PERFIL.maquina;
    document.getElementById('prof-tanque').value = PERFIL.tanque;
    toggleMenu();
    navegarA('screen-profile');
}

async function guardarPerfil() {
    PERFIL.nombre = document.getElementById('prof-nombre').value.trim();
    PERFIL.maquina = document.getElementById('prof-maquina').value.trim();
    const t = parseFloat(document.getElementById('prof-tanque').value);
    PERFIL.tanque = (t && !isNaN(t)) ? t : 3000;
    
    guardarTodo();
    await showAlert("Datos de máquina actualizados.");
    volverAtras();
}

// --- 5. GESTIÓN DE CLIENTES ---

async function crearNuevoCliente() {
    const nombreRaw = await showPrompt("Ingrese el nombre del nuevo cliente:", "Nombre del cliente");
    if(!nombreRaw) return;
    const nombre = nombreRaw.trim();
    if(nombre.length === 0) return;
    if(DATA[nombre]) {
        await showAlert("Ese cliente ya existe.");
        return;
    }
    
    DATA[nombre] = [];
    STOCK_POR_CLIENTE[nombre] = [];
    guardarTodo();
    renderClientes();
}

function renderClientes() {
    const cont = document.getElementById('lista-clientes');
    cont.innerHTML = "";
    Object.keys(DATA).forEach(c => {
        const div = document.createElement('div');
        div.className = "card";
        div.innerHTML = '<strong>' + c + '</strong><br><small>' + DATA[c].length + ' tareas registradas</small>'; 
        div.onclick = () => verTareas(c);
        cont.appendChild(div);
    });
}

// --- 6. GESTIÓN DE TAREAS ---

function verTareas(cliente) {
    seleccion.cliente = cliente;
    document.getElementById('cliente-titulo').innerText = cliente;
    cambiarTab(seleccion.tabActual);
    navegarA('screen-tasks');
}

function cambiarTab(estado) {
    seleccion.tabActual = estado;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.id === 'tab-' + estado);
    });
    
    const cont = document.getElementById('contenedor-tareas-tab');
    cont.innerHTML = "";
    
    // Filtrar tareas por estado
    const filtradas = DATA[seleccion.cliente].filter(t => t.estado === estado);
    
    if(filtradas.length === 0) {
        cont.innerHTML = '<p style="text-align:center; color:#999; margin-top:30px;">No hay tareas en esta sección.</p>'; 
    } else {
        filtradas.forEach(t => {
            const div = document.createElement('div');
            div.className = "card";
            // Mostramos si es lote completo o parcial en la tarjeta
            const detalleHa = t.haTotal !== t.haAplicar ? '<span style="color:#d32f2f;">Parcial: ' + t.haAplicar + ' Ha</span>' : '<span>Lote: ' + t.haTotal + ' Ha</span>';
            
            div.innerHTML = '<div class="task-row">' +
                                '<div class="task-title">' +
                                    '<div><b>' + t.nombre + '</b></div>' +
                                    (t.aplicador ? '<div class="task-aplicador">👨‍🌾 ' + t.aplicador + '</div>' : '') +
                                    '<small>' + detalleHa + '</small>' +
                                '</div>' +
                                '<span class="task-badge badge-status status-' + t.estado.toLowerCase().replace(' ', '') + '">' + t.estado + '</span>' +
                            '</div>';
            div.onclick = () => prepararDetalle(t.id);
            cont.appendChild(div);
        });
    }
}

// --- 7. DETALLE DE TAREA ---

function prepararDetalle(tareaId) {
    const tarea = DATA[seleccion.cliente].find(t => t.id === tareaId);
    if (!tarea) return;

    seleccion.tarea = tarea;
    // Título
    document.getElementById('det-tarea-nombre').innerText = tarea.nombre;
    // Aplicador en su propia caja
    const detBox = document.getElementById('det-aplicador-box');
    const detName = document.getElementById('det-aplicador-name');
    if (tarea.aplicador) { detBox.classList.remove('hidden'); detName.innerText = '👨‍🌾 ' + tarea.aplicador; }
    else { detBox.classList.add('hidden'); detName.innerText = ''; }

    document.getElementById('det-tarea-desc').innerText = tarea.desc || "Sin observaciones.";
    document.getElementById('det-ha-total').innerText = tarea.haTotal;
    document.getElementById('det-ha-aplicar').innerText = tarea.haAplicar;

    const lista = document.getElementById('det-receta-lista');
    lista.innerHTML = "";
    tarea.receta.forEach(p => {
        lista.innerHTML += '<li>🔹 ' + p.n + ': <b>' + p.d + ' L/Ha</b></li>'; 
    });

    // Preparar el contenedor y navegar primero para asegurar visibilidad antes de renderizar mapa
    const detMap = document.getElementById('det-map');
    detMap.innerHTML = '';
    document.getElementById('det-weather').innerHTML = '';
    actualizarBotonesTarea();
    navegarA('screen-task-detail');

    // Si existe ubicación, pedir clima y renderizar mapa (si es posible)
    if (tarea.ubicacion && tarea.ubicacion.lat) {
        document.getElementById('det-weather').innerText = 'Cargando clima...';
        fetchWeather(tarea.ubicacion.lat, tarea.ubicacion.lng).then(info => {
            if(info) document.getElementById('det-weather').innerText = 'Clima: ' + info + '.';
            else document.getElementById('det-weather').innerText = '(Clima no disponible)';
        }).catch(e => {
            console.error('Error fetchWeather:', e);
            document.getElementById('det-weather').innerText = '(Clima no disponible)';
        });

        setTimeout(() => {
            if (typeof L !== 'undefined') {
                renderDetailMap(tarea.ubicacion.lat, tarea.ubicacion.lng);
            } else {
                loadLeaflet().then(() => renderDetailMap(tarea.ubicacion.lat, tarea.ubicacion.lng)).catch(() => {
                    document.getElementById('det-map').innerText = 'Mapa no disponible.';
                });
            }
        }, 200);
    } else {
        document.getElementById('det-weather').innerText = '(Ubicación no definida)';
    }
}

function actualizarBotonesTarea() {
    const est = seleccion.tarea.estado;
    const badge = document.getElementById('det-tarea-estado-badge');
    badge.innerText = est;
    badge.className = "badge-status status-" + est.toLowerCase().replace(' ', '');
    
    const btnComenzar = document.getElementById('btn-accion-tarea');
    const btnAnular = document.getElementById('btn-suspender-tarea');
    
    // Visibilidad por Rol
    if (usuarioActual.rol === "operario") {
        if (est === "Nueva") {
            btnComenzar.style.display = "block";
            btnComenzar.innerText = "COMENZAR TAREA";
        } else if (est === "En Proceso") {
            btnComenzar.style.display = "block";
            btnComenzar.innerText = "FINALIZAR TAREA";
        } else {
            btnComenzar.style.display = "none";
        }
    } else {
        btnComenzar.style.display = "none"; // El ingeniero no inicia tareas
    }
    
    // Botón anular
    btnAnular.style.display = (est !== "Hecho" && est !== "Suspendida") ? "block" : "none";
}

// --- 8. CREACIÓN DE NUEVA TAREA ---

function abrirNuevaTarea() {
    if(!seleccion.cliente) return showAlert('Seleccione un cliente antes de crear una tarea.');

    // Limpiar formulario
    document.getElementById('new-task-nombre-input').value = "";
    document.getElementById('new-task-ha-total').value = "";
    document.getElementById('new-task-ha-aplicar').value = "";
    document.getElementById('new-task-desc-input').value = "";
    document.getElementById('new-task-ubic-desc').innerText = '(No definida)';
    document.getElementById('new-task-aplicador').innerHTML = '<option value="">(Sin asignar)</option>';

    // Cargar aplicadores para este cliente
    const listaApp = APLICADORES[seleccion.cliente] || [];
    listaApp.forEach(a => {
        const opt = document.createElement('option'); opt.value = a; opt.innerText = a;
        document.getElementById('new-task-aplicador').appendChild(opt);
    });

    // Resetear Checkbox
    const check = document.getElementById('check-parcial');
    check.checked = false;
    toggleParcial();
    
    document.getElementById('lista-insumos-nueva').innerHTML = "";
    agregarInsumoInput();
    
    navegarA('screen-new-task');
}

function toggleParcial() {
    const isChecked = document.getElementById('check-parcial').checked;
    const box = document.getElementById('box-ha-aplicar');
    if (isChecked) box.classList.remove('hidden');
    else box.classList.add('hidden');
}

function agregarInsumoInput() {
    const cont = document.getElementById('lista-insumos-nueva');
    const div = document.createElement('div');
    div.className = "insumo-row";
    div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
    div.innerHTML = '<input type="text" placeholder="Prod" class="in-nombre" style="flex:2; margin:0;"><input type="number" placeholder="L/Ha" class="in-dosis" style="flex:1; margin:0;"><button class="btn-secondary" style="width:80px; margin-left:5px;" onclick="this.parentNode.remove();">Eliminar</button>'; 
    cont.appendChild(div);
}

async function guardarNuevaTarea() {
    const nombre = document.getElementById('new-task-nombre-input').value.trim();
    const haTotalStr = document.getElementById('new-task-ha-total').value;

    if(!seleccion.cliente) { await showAlert('No hay cliente seleccionado.'); return; }
    
    if(!nombre || !haTotalStr) {
        await showAlert("Falta nombre o hectáreas totales.");
        return;
    }
    
    const haTotal = parseFloat(haTotalStr);
    if(isNaN(haTotal) || haTotal <= 0) {
        await showAlert("Ingrese hectáreas totales válidas.");
        return;
    }

    const isParcial = document.getElementById('check-parcial').checked;
    let haAplicar = haTotal;
    
    if (isParcial) {
        const p = parseFloat(document.getElementById('new-task-ha-aplicar').value);
        if(isNaN(p) || p <= 0) {
            await showAlert("Indique las hectáreas a aplicar.");
            return;
        }
        haAplicar = p;
    }

    const receta = [];
    document.querySelectorAll('.insumo-row').forEach(row => {
        const n = row.querySelector('.in-nombre').value.trim();
        const dRaw = row.querySelector('.in-dosis').value;
        const d = parseFloat(dRaw);
        if(n && !isNaN(d) && d > 0) receta.push({ n, d: parseFloat(d) });
    });

    if(receta.length === 0) {
        await showAlert("Debe agregar al menos un insumo con dosis válida.");
        return;
    }

    const aplicador = document.getElementById('new-task-aplicador').value || null;
    const ubicRaw = document.getElementById('new-task-ubic-desc').dataset.coords || null;
    let ubic = null;
    if (ubicRaw) {
        const parts = ubicRaw.split(','); ubic = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
    }

    DATA[seleccion.cliente].push({
        id: Date.now(),
        nombre,
        haTotal,
        haAplicar,
        desc: document.getElementById('new-task-desc-input').value,
        receta,
        estado: "Nueva",
        aplicador,
        ubicacion: ubic
    });
    
    guardarTodo();
    verTareas(seleccion.cliente);
}

// --- 9. CALCULADORA ---

// Map & Weather helpers
let detailMap = null; // instancia reutilizable para el mapa de detalle

function loadLeaflet() {
    return new Promise((resolve, reject) => {
        if (typeof L !== 'undefined') return resolve();
        // cargar CSS si hace falta
        if(!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        // cargar script
        if(!document.querySelector('script[data-leaflet]')) {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.setAttribute('data-leaflet','1');
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Leaflet load failed'));
            document.body.appendChild(s);
        } else {
            const existing = document.querySelector('script[data-leaflet]');
            if (typeof L !== 'undefined') resolve();
            else existing.addEventListener('load', () => resolve(), { once: true });
        }
    });
}

function renderDetailMap(lat, lng) {
    const container = document.getElementById('det-map');
    container.innerHTML = '';
    try {
        if (detailMap) try { detailMap.remove(); } catch(e) {}
        detailMap = L.map(container).setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap contributors' }).addTo(detailMap);
        L.marker([lat, lng]).addTo(detailMap);
        // asegurar render correcto si el contenedor estaba oculto
        setTimeout(()=>{ try { detailMap.invalidateSize(); } catch(e){} }, 150);
    } catch(e) {
        container.innerHTML = 'Mapa no disponible.';
    }
}

async function fetchWeather(lat, lng) {
    // Reintentos simples con timeout
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current_weather=true&timezone=auto';
    const tryFetch = (signal) => fetch(url, { signal });

    for(let attempt=1; attempt<=3; attempt++){
        try{
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const res = await tryFetch(controller.signal);
            clearTimeout(id);
            if(!res.ok) { console.warn('Open-Meteo not ok', res.status); throw new Error('Bad status'); }
            const json = await res.json();
            if(json && json.current_weather) {
                const w = json.current_weather;
                return w.temperature + '°C, viento ' + w.windspeed + ' m/s';
            }
        } catch(e) {
            // console.warn('Weather fetch attempt failed', attempt, e);
            if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt));
            else return null;
        }
    }
    return null;
}

async function abrirSelectorUbicacion() {
    // Temporarily disabled selector during syntax fix — returns null
    return null;
}

function abrirCalculadora() {
    document.getElementById('resumen-tanque').innerText = PERFIL.tanque;
    document.getElementById('resumen-ha-tarea').innerText = seleccion.tarea.haAplicar;
    document.getElementById('resultado-calc').classList.add('hidden');
    navegarA('screen-calc');
}

async function calcularMezcla() {
    const caudal = parseFloat(document.getElementById('caudal-input').value);
    if(!caudal || isNaN(caudal) || caudal <= 0) {
        await showAlert("Ingrese un caudal válido (L/Ha).");
        return;
    }

    const haPorTanque = PERFIL.tanque / caudal;
    const haTotales = seleccion.tarea.haAplicar;
    const tachadas = haTotales / haPorTanque;
    
    document.getElementById('ha-por-tanque').innerText = haPorTanque.toFixed(2);
    document.getElementById('cant-tanques').innerText = tachadas.toFixed(1) + " (" + Math.ceil(tachadas) + ")";
    
    const list = document.getElementById('lista-mezcla');
    const aviso = document.getElementById('aviso-stock-insuficiente');
    list.innerHTML = "";
    aviso.innerHTML = "";
    
    seleccion.tarea.receta.forEach(p => {
        const totalNecesario = haTotales * p.d;
        // Buscar stock
        const itemStock = STOCK_POR_CLIENTE[seleccion.cliente]?.find(i => i.n.toLowerCase() === p.n.toLowerCase());
        const disponible = itemStock ? itemStock.q : 0;
        
        const color = totalNecesario > disponible ? "red" : "green";
        if (totalNecesario > disponible) aviso.innerHTML = '<p style="color:red; font-weight:bold;">Faltante: ' + p.n + '</p>';
        
        list.innerHTML += '<li style="color:' + color + '">' + p.n + ': <b>' + totalNecesario.toFixed(1) + ' Lts</b> <small>(Stock: ' + disponible + ')</small></li>';
    });
    
    document.getElementById('resultado-calc').classList.remove('hidden');
}

// --- 10. STOCK ---

function irAStock(cliente) {
    seleccion.cliente = cliente;
    document.getElementById('stock-cliente-titulo').innerText = "Stock: " + cliente;
    const area = document.getElementById('area-carga-ingeniero');
    // Solo ingeniero ve la carga manual
    usuarioActual.rol === "ingeniero" ? area.classList.remove('hidden') : area.classList.add('hidden');
    renderStock();
    navegarA('screen-stock');
}

async function agregarStock() {
    const n = document.getElementById('stock-nombre').value.trim();
    const q = parseFloat(document.getElementById('stock-cantidad').value);
    if(!n || isNaN(q) || q <= 0) {
        await showAlert("Ingrese nombre y cantidad válidos para el stock.");
        return;
    }
    
    if (!STOCK_POR_CLIENTE[seleccion.cliente]) STOCK_POR_CLIENTE[seleccion.cliente] = [];
    let lista = STOCK_POR_CLIENTE[seleccion.cliente];
    let existe = lista.find(i => i.n.toLowerCase() === n.toLowerCase());
    
    if(existe) existe.q += q;
    else lista.push({ n, q });
    
    guardarTodo();
    renderStock();
    document.getElementById('stock-nombre').value = "";
    document.getElementById('stock-cantidad').value = "";
}

function renderStock() {
    const cont = document.getElementById('lista-stock');
    cont.innerHTML = "";
    const lista = STOCK_POR_CLIENTE[seleccion.cliente] || [];
    if(lista.length === 0) cont.innerHTML = "<p>Sin stock registrado.</p>";
    lista.forEach(i => {
        cont.innerHTML += '<div class="stock-item"><span>' + i.n + '</span> <b>' + i.q.toFixed(1) + ' Lts</b></div>'; 
    });
}

// --- 11. CIERRE Y EJECUCIÓN ---

function cambiarEstado() {
    if (seleccion.tarea.estado === "Nueva") {
        seleccion.tarea.estado = "En Proceso";
        guardarTodo();
        actualizarBotonesTarea();
    } else {
        // Ir a pantalla de cierre
        // Pre-cargamos el valor planificado como sugerencia
        document.getElementById('clima-ha-real').value = seleccion.tarea.haAplicar;
        document.getElementById('clima-obs').value = "";
        navegarA('screen-finish');
    }
}

async function finalizarDefinitivo() {
    const haReales = parseFloat(document.getElementById('clima-ha-real').value);
    if(isNaN(haReales) || haReales <= 0) {
        await showAlert("Debe confirmar las Hectáreas realizadas.");
        return;
    }

    // Descuento de Stock
    const receta = seleccion.tarea.receta;
    if (!STOCK_POR_CLIENTE[seleccion.cliente]) STOCK_POR_CLIENTE[seleccion.cliente] = [];
    
    let reporte = "Stock actualizado:\n";
    
    receta.forEach(insumo => {
        const consumo = insumo.d * haReales;
        const item = STOCK_POR_CLIENTE[seleccion.cliente].find(s => s.n.toLowerCase() === insumo.n.toLowerCase());
        
        if (item) {
            item.q = Math.max(0, item.q - consumo);
            reporte += '- ' + insumo.n + ': -' + consumo.toFixed(1) + ' Lts\n';
        } else {
            reporte += '- ' + insumo.n + ': No había stock para descontar.\n';
        }
    });

    seleccion.tarea.estado = "Hecho";
    seleccion.tarea.haReales = haReales; // Guardamos el dato histórico
    guardarTodo();
    
    await showAlert("¡Trabajo Finalizado!\n" + reporte);
    verTareas(seleccion.cliente);
}

async function suspenderTarea() {
    const ok = await showConfirm("¿Seguro desea anular la tarea?");
    if(ok) {
        seleccion.tarea.estado = "Suspendida";
        guardarTodo();
        verTareas(seleccion.cliente);
    }
}

// Utilidad de prueba: crea cliente/tarea/stock y simula cálculo y cierre.
async function runSmokeTests() {
    const client = 'TEST_CLIENT_' + Date.now();
    if(!DATA[client]) DATA[client] = [];
    if(!STOCK_POR_CLIENTE[client]) STOCK_POR_CLIENTE[client] = [];

    // Añadir stock
    STOCK_POR_CLIENTE[client].push({ n: 'Glifosato', q: 100 });

    // Crear tarea de prueba
    const tarea = {
        id: Date.now() + 1,
        nombre: 'TareaTest',
        haTotal: 10,
        haAplicar: 10,
        desc: 'Prueba automática',
        receta: [{ n: 'Glifosato', d: 2 }],
        estado: 'Nueva'
    };
    // Añadir tarea y datos adicionales
    DATA[client].push(tarea);
    // Añadir aplicador de prueba
    APLICADORES[client] = ['TestApp'];
    // Asignar ubicación de prueba (Buenos Aires aproximado)
    tarea.aplicador = 'TestApp';
    tarea.ubicacion = { lat: -34.613, lng: -58.377 };
    guardarTodo();

    // Seleccionar cliente y tarea y abrir detalle para ver mapa y clima
    seleccion.cliente = client;
    seleccion.tarea = tarea;
    prepararDetalle(tarea.id);
    // Esperar un momento a que el mapa y el clima se procesen
    await new Promise(r => setTimeout(r, 1500));

    // Medir mezcla (simular abrir calculadora y cálculo)
    document.getElementById('caudal-input').value = 80;
    abrirCalculadora();
    await calcularMezcla();

    // Iniciar y finalizar tarea
    seleccion.tarea.estado = 'En Proceso';
    guardarTodo();
    document.getElementById('clima-ha-real').value = String(tarea.haAplicar);
    await finalizarDefinitivo();

    const remaining = (STOCK_POR_CLIENTE[client].find(i => i.n.toLowerCase() === 'glifosato') || { q: 0 }).q;
    await showAlert('Prueba completada. Stock restante de Glifosato: ' + remaining.toFixed(1) + ' Lts. Cliente: ' + client);
    console.log('runSmokeTests finished for', client, 'remaining stock', remaining);
}

// Exportar helper para ejecutar desde consola
window.runSmokeTests = runSmokeTests;