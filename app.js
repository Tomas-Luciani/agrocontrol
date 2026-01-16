// --- 1. CONFIGURACIÓN Y DATOS INICIALES ---

/*
  PRUEBAS RÁPIDAS (instrucciones):
  1) Login como Ingeniero -> crear cliente -> +Agregar aplicador -> crear tarea asignando ese aplicador.
  2) Logout -> Login como Aplicador (mismo nombre) -> Verificar que sólo aparece el cliente asignado.
  3) Como Ingeniero -> Abrir tarea -> Cambiar aplicador -> Verificar que el nuevo aplicador ve el cliente.

  Nota: El sistema normaliza automáticamente nombres legacy a user-ids con
  `normalizeAplicadoresForClient(cliente)` y persiste usuarios en `AGRO_USERS`.
  Existe un helper opcional `window.runSmokeTests(client)` para pruebas (log de consola eliminado).
*/

// Tareas
let DATA = JSON.parse(localStorage.getItem('AGRO_DATA')) || {
    "Estancia La Suiza": [],
    "Don Ismael": []
};

// Historial (tareas completadas con timestamp y detalles)
let HISTORIAL = JSON.parse(localStorage.getItem('AGRO_HISTORIAL')) || [];

// Cola de sincronización (cambios pendientes cuando hay conexión)
let SYNC_QUEUE = JSON.parse(localStorage.getItem('AGRO_SYNC_QUEUE')) || [];

// Estado de conexión
let CONEXION_ONLINE = navigator.onLine;
let MODO_OFFLINE = !CONEXION_ONLINE;

// Perfil de Usuario (Máquina y Tanque)
let PERFIL = JSON.parse(localStorage.getItem('AGRO_PERFIL')) || {
    nombre: "Operario",
    maquina: "Sin asignar",
    tanque: 3000
};

// Stock
let STOCK_POR_CLIENTE = JSON.parse(localStorage.getItem('AGRO_STOCK')) || {
    "Estancia La Suiza": [{ n: "Glifosato", q: 500 }],
    "Don Ismael": []
};

// Monitores de conexión
window.addEventListener('online', function() {
    CONEXION_ONLINE = true;
    MODO_OFFLINE = false;
    actualizarIndicadorConexion();
    sincronizarCola();
});

window.addEventListener('offline', function() {
    CONEXION_ONLINE = false;
    MODO_OFFLINE = true;
    actualizarIndicadorConexion();
});

// Aplicadores por cliente (almacena ids de usuarios)
let APLICADORES = JSON.parse(localStorage.getItem('AGRO_APLICADORES')) || {};

// Usuarios y sesión
let USERS = JSON.parse(localStorage.getItem('AGRO_USERS')) || {}; // { id: {id,name,rol} }
let SESSION = JSON.parse(localStorage.getItem('AGRO_SESSION')) || null;
let usuarioActual = SESSION || { id: null, name: '', rol: 'operario' };
let seleccion = { cliente: "", tarea: null, tabActual: "Nueva" };
let pilaNavegacion = [];

// Función Global de Guardado
function guardarTodo() {
    try {
        localStorage.setItem('AGRO_DATA', JSON.stringify(DATA));
        localStorage.setItem('AGRO_STOCK', JSON.stringify(STOCK_POR_CLIENTE));
        localStorage.setItem('AGRO_PERFIL', JSON.stringify(PERFIL));
        localStorage.setItem('AGRO_APLICADORES', JSON.stringify(APLICADORES));
        localStorage.setItem('AGRO_USERS', JSON.stringify(USERS));
        localStorage.setItem('AGRO_HISTORIAL', JSON.stringify(HISTORIAL));
        localStorage.setItem('AGRO_SYNC_QUEUE', JSON.stringify(SYNC_QUEUE));
        localStorage.setItem('AGRO_NOTIFICACIONES', JSON.stringify(NOTIFICACIONES));
        try { localStorage.setItem('AGRO_SESSION', JSON.stringify(usuarioActual)); } catch(e) {}
        
        // En modo offline, agregar a cola de sincronización
        if (MODO_OFFLINE) {
            agregarACola({ tipo: 'guardado', timestamp: new Date().toISOString() });
        }
    } catch(e) {
        if (e.name === 'QuotaExceededError') {
            console.error('⚠️ localStorage lleno:', e);
            limpiarHistorialAntiguo();
            try {
                localStorage.setItem('AGRO_DATA', JSON.stringify(DATA));
                localStorage.setItem('AGRO_HISTORIAL', JSON.stringify(HISTORIAL));
            } catch(e2) {
                console.error('Error incluso después de limpiar:', e2);
                throw new Error('Almacenamiento lleno. Debe limpiar datos antiguos.');
            }
        } else {
            throw e;
        }
    }
}

// Limpiar historial de tareas completadas hace más de 30 días
function limpiarHistorialAntiguo() {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    
    const tareasAnteriores = HISTORIAL.filter(t => 
        new Date(t.fechaFinalizacion) < hace30dias
    ).length;
    
    HISTORIAL = HISTORIAL.filter(t => 
        new Date(t.fechaFinalizacion) >= hace30dias
    );
    
    console.log('🧹 Se eliminaron ' + tareasAnteriores + ' tareas del historial (>30 días)');
}

// Comprimir imagen reduciendo calidad
function comprimirImagen(base64, calidad = 0.7, maxAncho = 1024) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let ancho = img.width;
            let alto = img.height;
            
            // Redimensionar si es muy grande
            if (ancho > maxAncho) {
                alto = Math.round(alto * (maxAncho / ancho));
                ancho = maxAncho;
            }
            
            canvas.width = ancho;
            canvas.height = alto;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, ancho, alto);
            
            // Convertir a JPEG comprimido
            const comprimido = canvas.toDataURL('image/jpeg', calidad);
            resolve(comprimido);
        };
        img.onerror = () => resolve(base64); // Si falla, devolver original
        img.src = base64;
    });
}

// Obtener tamaño estimado del localStorage en MB
function obtenerTamanoStorage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
        }
    }
    return (total / 1024 / 1024).toFixed(2); // MB
}

// Advertencia si storage está cerca del límite
async function advertirSiStorageLleno() {
    const tamanio = parseFloat(obtenerTamanoStorage());
    if (tamanio > 4) { // Más de 4MB de 5-10MB disponibles
        const resultado = await showConfirm(
            '⚠️ Almacenamiento casi lleno (' + tamanio + 'MB).\n' +
            '¿Desea limpiar tareas completadas hace >30 días?'
        );
        if (resultado) {
            limpiarHistorialAntiguo();
            guardarTodo();
            await showAlert('✅ Historial limpiado. Espacio liberado.');
        }
    }
}


// Normalizar aplicadores: convertir valores legacy (nombres) en user-ids y crear usuarios si es necesario
function normalizeAplicadoresForClient(cliente) {
    if(!APLICADORES[cliente] || APLICADORES[cliente].length === 0) return [];
    const lista = APLICADORES[cliente];
    const newList = lista.map(item => {
        if (USERS[item]) return item; // ya es id
        // buscar usuario por nombre (case-insensitive)
        const found = Object.values(USERS).find(u => u.name && u.name.toLowerCase() === String(item).toLowerCase());
        if (found) return found.id;
        // crear nuevo usuario con ese nombre
        const id = 'u' + (Date.now() + Math.floor(Math.random()*999));
        USERS[id] = { id, name: String(item), rol: 'operario' };
        return id;
    });
    // deduplicar
    const dedup = [...new Set(newList)];
    APLICADORES[cliente] = dedup;
    guardarTodo();
    return dedup;
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

// Variables para el gestor de aplicadores
let aplicadorSeleccionadoEnManager = null;

// Notificaciones
let NOTIFICACIONES = JSON.parse(localStorage.getItem('AGRO_NOTIFICACIONES')) || [];

// Función para agregar notificación
function agregarNotificacion(titulo, mensaje, tipo = 'info', duracion = 5000) {
    const id = Date.now();
    const notif = {
        id,
        titulo,
        mensaje,
        tipo, // 'info', 'success', 'warning', 'error'
        timestamp: new Date().toISOString(),
        leida: false
    };
    
    NOTIFICACIONES.push(notif);
    localStorage.setItem('AGRO_NOTIFICACIONES', JSON.stringify(NOTIFICACIONES));
    
    // Mostrar toast en pantalla
    mostrarNotificacionToast(titulo, mensaje, tipo, duracion);
    
    // Si tiene permisos, enviar notificación del navegador
    if (Notification.permission === 'granted') {
        new Notification(titulo, {
            body: mensaje,
            icon: '🚜'
        });
    }
}

function mostrarNotificacionToast(titulo, mensaje, tipo = 'info', duracion = 5000) {
    const container = document.getElementById('notificaciones-container');
    if (!container) {
        // Crear contenedor si no existe
        const div = document.createElement('div');
        div.id = 'notificaciones-container';
        div.style.cssText = 'position: fixed; top: 80px; right: 15px; z-index: 999; max-width: 350px;';
        document.body.appendChild(div);
    }
    
    const toast = document.createElement('div');
    toast.className = 'notif-toast notif-' + tipo;
    toast.style.cssText = 'padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s; font-size: 14px; cursor: pointer;';
    
    const colores = {
        'info': '#2196F3',
        'success': '#4CAF50',
        'warning': '#FF9800',
        'error': '#f44336'
    };
    
    toast.style.background = colores[tipo] || colores['info'];
    toast.style.color = 'white';
    
    const iconos = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    };
    
    toast.innerHTML = '<b>' + iconos[tipo] + ' ' + titulo + '</b><br><small>' + mensaje + '</small>';
    
    document.getElementById('notificaciones-container').appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

// Solicitar permisos de notificación
function solicitarPermisosNotificaciones() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

async function abrirGestorAplicadores() {
    if (!seleccion.cliente) {
        await showAlert('Seleccione un cliente antes.');
        return;
    }

    aplicadorSeleccionadoEnManager = null;
    document.getElementById('aplicadores-cliente-nombre').innerText = seleccion.cliente;
    document.getElementById('buscar-aplicador-input').value = '';
    document.getElementById('btn-aplicador-confirmar').disabled = true;
    
    // Normalizar aplicadores
    normalizeAplicadoresForClient(seleccion.cliente);
    
    renderAplicadoresExistentes();
    navegarA('screen-aplicadores-manager');
}

function renderAplicadoresExistentes() {
    const container = document.getElementById('lista-aplicadores-existentes');
    const listaApp = APLICADORES[seleccion.cliente] || [];
    
    if (listaApp.length === 0) {
        container.innerHTML = '<small style="color:#999;">No hay aplicadores asignados a este cliente aún.</small>';
        return;
    }
    
    let html = '<h4 style="color:#666; font-size:13px; margin-bottom:10px;">Aplicadores Actuales</h4>';
    listaApp.forEach(appId => {
        const user = USERS[appId];
        const name = user ? user.name : appId;
        html += '<div class="aplicador-card" style="display:flex; align-items:center; gap:10px; padding:12px; background:#f5f5f5; border-radius:8px; margin-bottom:8px; cursor:pointer; border:2px solid transparent; transition:0.2s;" onclick="seleccionarAplicadorEnManager(\'' + appId + '\')">' +
                    '<div style="flex:1;">' +
                    '<b style="display:block;">' + name + '</b>' +
                    '<small style="color:#888;">ID: ' + appId.substring(0, 8) + '...</small>' +
                    '</div>' +
                    '<div id="check-' + appId + '" style="font-size:20px;">☐</div>' +
                '</div>';
    });
    
    container.innerHTML = html;
}

function seleccionarAplicadorEnManager(appId) {
    // Limpiar selección anterior
    const previousCheck = document.querySelectorAll('.aplicador-card');
    previousCheck.forEach(card => card.style.borderColor = 'transparent');
    
    // Marcar nueva selección
    const card = document.querySelector('[onclick*="' + appId + '"]');
    if (card) {
        card.style.borderColor = '#2d4031';
        card.style.backgroundColor = '#e8f5e9';
    }
    
    // Actualizar checkbox
    document.querySelectorAll('.aplicador-card div:last-child').forEach(check => {
        check.innerText = '☐';
    });
    document.getElementById('check-' + appId).innerText = '☑';
    
    aplicadorSeleccionadoEnManager = appId;
    document.getElementById('btn-aplicador-confirmar').disabled = false;
}

async function confirmarSeleccionAplicador() {
    if (!aplicadorSeleccionadoEnManager) {
        await showAlert('Seleccione un aplicador.');
        return;
    }
    
    seleccion.tarea.aplicador = aplicadorSeleccionadoEnManager;
    guardarTodo();
    
    // Actualizar display en detalle de tarea
    const detBox = document.getElementById('det-aplicador-box');
    const detName = document.getElementById('det-aplicador-name');
    detBox.classList.remove('hidden');
    detName.innerText = '👨‍🌾 ' + (USERS[aplicadorSeleccionadoEnManager] ? USERS[aplicadorSeleccionadoEnManager].name : aplicadorSeleccionadoEnManager);
    
    await showAlert('Aplicador actualizado correctamente.');
    volverAtras();
}

async function agregarAplicadorPrompt() {
    if (!seleccion.cliente) { 
        await showAlert('Seleccione un cliente antes.');
        return;
    }
    
    const nombre = await showPrompt('Nombre del aplicador:', 'Nombre Apellido');
    if (!nombre) return;
    
    // Buscar usuario existente
    let user = Object.values(USERS).find(u => u.name.toLowerCase() === nombre.toLowerCase() && u.rol === 'operario');
    if (!user) {
        const id = 'u' + Date.now();
        user = { id, name: nombre, rol: 'operario' };
        USERS[id] = user;
    }
    
    if (!APLICADORES[seleccion.cliente]) APLICADORES[seleccion.cliente] = [];
    
    if (APLICADORES[seleccion.cliente].includes(user.id)) {
        await showAlert('Ese aplicador ya está asignado a este cliente.');
        return;
    }
    
    APLICADORES[seleccion.cliente].push(user.id);
    guardarTodo();
    
    // Actualizar select en nueva tarea
    const sel = document.getElementById('new-task-aplicador');
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.innerText = user.name;
    sel.appendChild(opt);
    sel.value = user.id;
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

        // Opciones como botones (si la opción corresponde a un user-id, mostrar su nombre)
        options.forEach(opt => {
            const b = document.createElement('button');
            b.className = 'btn-secondary';
            b.style.marginRight = '8px';
            b.style.marginBottom = '8px';
            b.innerText = (USERS[opt] ? USERS[opt].name : opt);
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
    if(!seleccion.cliente || !seleccion.tarea) { 
        await showAlert('No hay tarea seleccionada.'); 
        return; 
    }
    
    normalizeAplicadoresForClient(seleccion.cliente);
    const lista = APLICADORES[seleccion.cliente] || [];
    
    if(lista.length === 0){
        const nombre = await showPrompt('No existen aplicadores para este cliente. Ingrese nombre para crear:', 'Nombre Apellido');
        if(!nombre) return;
        
        let user = Object.values(USERS).find(u => u.name.toLowerCase() === nombre.toLowerCase() && u.rol === 'operario');
        if(!user) { 
            const id = 'u' + Date.now(); 
            user = { id, name: nombre, rol: 'operario' }; 
            USERS[id] = user; 
        }
        
        APLICADORES[seleccion.cliente] = [user.id];
        seleccion.tarea.aplicador = user.id;
    } else {
        // Abrir gestor de aplicadores
        await abrirGestorAplicadores();
        return;
    }
    
    guardarTodo();
    
    const detBox = document.getElementById('det-aplicador-box');
    const detName = document.getElementById('det-aplicador-name');
    detBox.classList.remove('hidden');
    detName.innerText = '👨‍🌾 ' + (USERS[seleccion.tarea.aplicador] ? USERS[seleccion.tarea.aplicador].name : seleccion.tarea.aplicador);
    
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

async function login() {
    const name = document.getElementById('login-name').value.trim();
    const role = document.getElementById('login-role').value;
    if(!name) { await showAlert('Ingrese su nombre para continuar.'); return; }

    // Buscar usuario existente por nombre+rol
    let user = Object.values(USERS).find(u => u.name.toLowerCase() === name.toLowerCase() && u.rol === role);
    if(!user) {
        const id = 'u' + Date.now();
        user = { id, name, rol: role };
        USERS[id] = user;
    }

    usuarioActual = user;
    guardarTodo();

    document.getElementById('app-title-display').innerText = usuarioActual.name + (usuarioActual.rol === "ingeniero" ? " (ING)" : "");
    
    configurarMenu();
    renderClientes();
    
    // Solicitar permisos de notificación
    solicitarPermisosNotificaciones();
    
    // Mostrar botón de crear cliente solo si es Ingeniero
    const btnAdd = document.getElementById('btn-add-client');
    if(usuarioActual.rol === "ingeniero") btnAdd.classList.remove('hidden');
    else btnAdd.classList.add('hidden');
    
    navegarA('screen-main');
}

function configurarMenu() {
    const menu = document.getElementById('menu-options');
    // texto con nombre de usuario y opciones
    let html = '<div style="padding:8px 0; font-weight:bold;">' + (usuarioActual.name || (usuarioActual.rol === 'ingeniero' ? 'Ingeniero' : 'Aplicador')) + '</div>';
    html += '<button onclick="toggleMenu(); navegarA(\'screen-main\')">Mis Clientes</button>';

    // Opciones para ingeniero
    if(usuarioActual.rol === "ingeniero") {
        html += '<button onclick="toggleMenu(); abrirDashboard()">📊 Dashboard</button>';
        html += '<button onclick="toggleMenu(); abrirEstadisticasAplicadores()">👥 Mi Equipo</button>';
        html += '<button onclick="toggleMenu(); abrirHistorial()">📋 Historial</button>';
    }

    // Opción extra para operario
    if(usuarioActual.rol === "operario") {
        html += '<button onclick="toggleMenu(); irAPerfil()">Mi Máquina</button>';
    }

    // Opción de almacenamiento (todos)
    const tamanio = obtenerTamanoStorage();
    html += '<button onclick="toggleMenu(); advertirSiStorageLleno()" style="color:#ff9800; font-size:12px;">💾 Almacenamiento (' + tamanio + 'MB)</button>';
    
    html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin:10px 0;"></hr><button onclick="logout()" style="color:#ff8a80;">Cerrar Sesión</button>';
    menu.innerHTML = html;
}

function logout() {
    usuarioActual = { id: null, name: '', rol: 'operario' };
    localStorage.removeItem('AGRO_SESSION');
    configurarMenu();
    navegarA('screen-login');
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
    let clientes = Object.keys(DATA);
    // Normalizar aplicadores para todos los clientes (convierte nombres legacy en ids)
    Object.keys(APLICADORES).forEach(c => normalizeAplicadoresForClient(c));
    // Si es aplicador, mostrar solo clientes a los que está asignado por el ingeniero
    if (usuarioActual && usuarioActual.rol === 'operario') {
        clientes = clientes.filter(c => {
            const list = APLICADORES[c] || [];
            return list.some(a => String(a) === String(usuarioActual.id) || (USERS[a] && USERS[a].id === usuarioActual.id) || (String(a).toLowerCase() === String(usuarioActual.name).toLowerCase()));
        });
    }
    clientes.forEach(c => {
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
    
    // Filtrar tareas por estado (si es aplicador, mostrar solo sus tareas asignadas)
    let filtradas = DATA[seleccion.cliente].filter(t => t.estado === estado);
    if (usuarioActual && usuarioActual.rol === 'operario') {
        filtradas = filtradas.filter(t => t.aplicador && String(t.aplicador) === String(usuarioActual.id));
    }
    
    if(filtradas.length === 0) {
        cont.innerHTML = '<p style="text-align:center; color:#999; margin-top:30px;">No hay tareas en esta sección.</p>'; 
    } else {
        filtradas.forEach(t => {
            const div = document.createElement('div');
            div.className = "card";
            // Mostramos si es lote completo o parcial en la tarjeta
            const detalleHa = t.haTotal !== t.haAplicar ? '<span style="color:#d32f2f;">Parcial: ' + t.haAplicar + ' Ha</span>' : '<span>Lote: ' + t.haTotal + ' Ha</span>';
            const aplicName = (t.aplicador && USERS[t.aplicador]) ? USERS[t.aplicador].name : t.aplicador;
            
            div.innerHTML = '<div class="task-row">' +
                                '<div class="task-title">' +
                                    '<div><b>' + t.nombre + '</b></div>' +
                                    (aplicName ? '<div class="task-aplicador">👨‍🌾 ' + aplicName + '</div>' : '') +
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
    // Aplicador en su propia caja — mostrar siempre para permitir asignación por Ingeniero
    const detBox = document.getElementById('det-aplicador-box');
    const detName = document.getElementById('det-aplicador-name');
    detBox.classList.remove('hidden');
    detName.innerText = tarea.aplicador ? ('👨‍🌾 ' + (USERS[tarea.aplicador] ? USERS[tarea.aplicador].name : tarea.aplicador)) : '(Sin asignar)';
    // Mostrar u ocultar botón cambiar según rol
    const changeBtn = document.querySelector('#det-aplicador-box .aplicador-actions .btn-secondary');
    if(changeBtn) changeBtn.style.display = (usuarioActual && usuarioActual.rol === 'ingeniero') ? 'inline-block' : 'none';

    document.getElementById('det-tarea-desc').innerText = tarea.desc || "Sin observaciones.";
    document.getElementById('det-ha-total').innerText = tarea.haTotal;
    document.getElementById('det-ha-aplicar').innerText = tarea.haAplicar;

    const lista = document.getElementById('det-receta-lista');
    lista.innerHTML = "";
    tarea.receta.forEach(p => {
        lista.innerHTML += '<li>🔹 ' + p.n + ': <b>' + p.d + ' L/Ha</b></li>'; 
    });

    // Mostrar fotografías de referencia si existen
    const fotosBox = document.getElementById('det-fotos-box');
    const fotosGaleria = document.getElementById('det-fotos-galeria');
    if (tarea.fotos && tarea.fotos.length > 0) {
        fotosBox.style.display = 'block';
        fotosGaleria.innerHTML = '';
        tarea.fotos.forEach(foto => {
            const imgDiv = document.createElement('div');
            imgDiv.style.cssText = 'border-radius:8px; overflow:hidden; background:#f0f0f0; aspect-ratio:1; cursor:pointer;';
            imgDiv.innerHTML = '<img src="' + foto.base64 + '" style="width:100%; height:100%; object-fit:cover;" onclick="abrirImagenGrande(this.src)">';
            fotosGaleria.appendChild(imgDiv);
        });
    } else {
        fotosBox.style.display = 'none';
    }

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

    // Limpiar fotos
    fotosNuevaTarea = [];
    document.getElementById('new-task-fotos').value = '';
    document.getElementById('preview-fotos-nueva').innerHTML = '';
    document.getElementById('new-task-fotos').onchange = function(e) {
        manejarCargaFotos(e, 'nueva');
    };

    // Normalizar aplicadores (asegurar ids) y cargar aplicadores para este cliente
    normalizeAplicadoresForClient(seleccion.cliente);
    const listaApp = APLICADORES[seleccion.cliente] || [];
    listaApp.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.innerText = USERS[a] ? USERS[a].name : a;
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

function manejarCargaFotos(e, tipo) {
    if (!e || !e.target || !e.target.files) return;
    
    const files = Array.from(e.target.files);
    const container = tipo === 'nueva' ? 
        document.getElementById('preview-fotos-nueva') : 
        document.getElementById('preview-fotos-finalizacion');
    
    if (!container) return;
    
    const arrayFotos = tipo === 'nueva' ? fotosNuevaTarea : fotosFinalizacion;
    
    files.forEach((file, idx) => {
        // Validar tamaño del archivo (máx 5MB antes de comprimir)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('⚠️ La imagen "' + file.name + '" es muy grande (>' + (file.size / 1024 / 1024).toFixed(1) + 'MB). Se comprimirá.');
        }
        
        const reader = new FileReader();
        reader.onload = async function(event) {
            let base64 = event.target.result;
            
            // Comprimir imagen si es JPEG o PNG
            if (file.type === 'image/jpeg' || file.type === 'image/png') {
                base64 = await comprimirImagen(base64, 0.65, 800);
            }
            
            arrayFotos.push({
                nombre: file.name,
                base64: base64,
                size: file.size,
                tipo: file.type
            });
            
            // Mostrar preview
            const previewDiv = document.createElement('div');
            previewDiv.style.cssText = 'position:relative; border-radius:8px; overflow:hidden; background:#f0f0f0; aspect-ratio:1;';
            previewDiv.innerHTML = '<img src="' + base64 + '" style="width:100%; height:100%; object-fit:cover;">' +
                                  '<button type="button" style="position:absolute; top:4px; right:4px; background:#d32f2f; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; z-index:10;" onclick="this.parentNode.remove();">✕</button>';
            container.appendChild(previewDiv);
        };
        reader.onerror = function(err) {
            console.error('Error leyendo archivo:', file.name, err);
        };
        reader.readAsDataURL(file);
    });
    
    // Actualizar contador
    const countNew = fotosNuevaTarea.length;
    const countFin = fotosFinalizacion.length;
    
    if (tipo === 'nueva' && countNew > 0) {
        const label = document.querySelector('label[for="new-task-fotos"]');
        if (label) label.innerText = '📷 Fotografías de Referencia (' + countNew + ')';
    }
}

function agregarInsumoInput() {
    const cont = document.getElementById('lista-insumos-nueva');
    const div = document.createElement('div');
    div.className = "insumo-row";
    div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
    div.innerHTML = '<input type="text" placeholder="Prod" class="in-nombre" style="flex:2; margin:0;"><input type="number" placeholder="L/Ha" class="in-dosis" style="flex:1; margin:0;"><button type="button" class="btn-secondary" style="width:80px; margin-left:5px;" onclick="this.parentNode.remove();">Eliminar</button>'; 
    cont.appendChild(div);
}

function abrirImagenGrande(src) {
    const modal = document.getElementById('modal-imagen');
    document.getElementById('modal-imagen-src').src = src;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
}

function cerrarImagenGrande() {
    const modal = document.getElementById('modal-imagen');
    modal.classList.add('hidden');
}

async function guardarNuevaTarea() {
    try {
        const nombre = document.getElementById('new-task-nombre-input').value.trim();
        const haTotalStr = document.getElementById('new-task-ha-total').value;

        if(!seleccion.cliente) { 
            await showAlert('No hay cliente seleccionado.'); 
            return; 
        }
        
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

        // Convertir aplicador seleccionado (puede ser nombre legacy) en user-id y normalizar lista
        let aplicadorRaw = document.getElementById('new-task-aplicador').value || null;
        let aplicador = null;
        if (aplicadorRaw) {
            if (USERS[aplicadorRaw]) aplicador = aplicadorRaw;
            else {
                // intentar encontrar por nombre
                const found = Object.values(USERS).find(u => u.name && u.name.toLowerCase() === String(aplicadorRaw).toLowerCase());
                if(found) aplicador = found.id;
                else {
                    const id = 'u' + Date.now();
                    USERS[id] = { id, name: aplicadorRaw, rol: 'operario' };
                    aplicador = id;
                    if(!APLICADORES[seleccion.cliente]) APLICADORES[seleccion.cliente] = [];
                    APLICADORES[seleccion.cliente].push(id);
                }
            }
        }

        const ubicRaw = document.getElementById('new-task-ubic-desc').dataset.coords || null;
        let ubic = null;
        if (ubicRaw) {
            const parts = ubicRaw.split(','); ubic = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        }

        // Crear objeto de tarea
        const nuevaTarea = {
            id: Date.now(),
            nombre,
            haTotal,
            haAplicar,
            desc: document.getElementById('new-task-desc-input').value,
            fotos: fotosNuevaTarea.slice(), // Copiar array de fotos
            receta,
            estado: "Nueva",
            aplicador,
            ubicacion: ubic,
            fechaCreacion: new Date().toISOString()
        };

        // Agregar a datos
        DATA[seleccion.cliente].push(nuevaTarea);
        
        // asegurar que aplicador almacenado está normalizado en APLICADORES
        if (aplicador) normalizeAplicadoresForClient(seleccion.cliente);
        
        // Notificación para el aplicador asignado
        if (aplicador && USERS[aplicador]) {
            agregarNotificacion(
                '📋 Nueva Tarea Asignada',
                'Tarea "' + nombre + '" en ' + seleccion.cliente + ' (' + haAplicar + ' Ha)',
                'info',
                6000
            );
        }
        
        fotosNuevaTarea = [];
        guardarTodo();
        await showAlert('✅ Tarea creada exitosamente');
        verTareas(seleccion.cliente);
    } catch(e) {
        console.error('Error en guardarNuevaTarea:', e);
        
        // Si es error de quota, ofrecer limpiar
        if (e.message.includes('Almacenamiento lleno')) {
            const resultado = await showConfirm(
                '⚠️ El almacenamiento está lleno.\n\n' +
                'Tamaño actual: ' + obtenerTamanoStorage() + 'MB\n\n' +
                '¿Desea limpiar tareas completadas hace >30 días?'
            );
            if (resultado) {
                limpiarHistorialAntiguo();
                guardarTodo();
                await showAlert('✅ Almacenamiento limpiado. Intente crear la tarea nuevamente.');
            }
        } else {
            await showAlert('❌ Error al guardar: ' + e.message);
        }
    }
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
    if (!container) return;
    
    try {
        // Validar coordenadas
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Coordenadas inválidas.</div>';
            return;
        }
        
        lat = parseFloat(lat);
        lng = parseFloat(lng);
        
        // Destruir mapa anterior
        if (detailMap) {
            try { 
                detailMap.off();
                detailMap.remove(); 
            } catch(e) {}
            detailMap = null;
        }
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Crear mapa con opciones mejoradas
        detailMap = L.map(container, {
            zoomControl: true,
            dragging: true,
            touchZoom: true,
            zoom: 14
        }).setView([lat, lng], 14);
        
        // TileLayer con mejores opciones
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abc'
        }).addTo(detailMap);
        
        // Marcador en la ubicación
        L.marker([lat, lng], {
            title: 'Ubicación del lote'
        }).addTo(detailMap)
            .bindPopup('📍 Lote: Lat ' + lat.toFixed(4) + ', Lng ' + lng.toFixed(4));
        
        // Invalidar size para que se redibuje correctamente
        setTimeout(() => {
            try { 
                if (detailMap) detailMap.invalidateSize(true); 
            } catch(e) {}
        }, 200);
        
    } catch(e) {
        console.error('Error en renderDetailMap:', e);
        container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Error al cargar el mapa: ' + e.message + '</div>';
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

let ubicacionSeleccionada = null;
let mapaSelectorUbicacion = null;
let markerSelectorUbicacion = null;

async function abrirSelectorUbicacion() {
    ubicacionSeleccionada = null;
    
    // Limpiar pantalla anterior
    const container = document.getElementById('ubicacion-map');
    container.innerHTML = '';
    document.getElementById('ubicacion-coords').innerHTML = 'Coordenadas: <b>(No seleccionadas)</b>';
    const btnConfirmar = document.getElementById('btn-confirmar-ubicacion');
    btnConfirmar.disabled = true;
    
    // Cargar Leaflet si no está disponible
    if (typeof L === 'undefined') {
        await loadLeaflet();
    }
    
    navegarA('screen-ubicacion-selector');
    
    // Inicializar mapa después de navegar y asegurar que el contenedor es visible
    setTimeout(() => {
        try {
            const mapContainer = document.getElementById('ubicacion-map');
            
            // Destruir mapa anterior si existe
            if (mapaSelectorUbicacion) {
                try { 
                    mapaSelectorUbicacion.off();
                    mapaSelectorUbicacion.remove(); 
                } catch(e) {}
                mapaSelectorUbicacion = null;
            }
            
            // Verificar que el contenedor está visible y tiene dimensiones
            if (!mapContainer || mapContainer.offsetHeight === 0) {
                console.error('Contenedor del mapa no es visible');
                mapContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Cargando mapa...</div>';
                
                // Reintentar después de otro delay
                setTimeout(() => abrirSelectorUbicacion(), 200);
                return;
            }
            
            // Crear mapa centrado en Argentina
            mapaSelectorUbicacion = L.map('ubicacion-map', {
                zoomControl: true,
                dragging: true,
                touchZoom: true
            }).setView([-34.6037, -58.3816], 6);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                subdomains: 'abc'
            }).addTo(mapaSelectorUbicacion);
            
            // Evento de click en el mapa
            mapaSelectorUbicacion.on('click', function(e) {
                if (!e.latlng) return;
                
                const lat = e.latlng.lat.toFixed(5);
                const lng = e.latlng.lng.toFixed(5);
                
                // Remover marcador anterior
                if (markerSelectorUbicacion) {
                    mapaSelectorUbicacion.removeLayer(markerSelectorUbicacion);
                }
                
                // Agregar nuevo marcador
                markerSelectorUbicacion = L.marker([lat, lng], {
                    draggable: true
                }).addTo(mapaSelectorUbicacion)
                    .bindPopup('📍 Ubicación seleccionada<br>Lat: ' + lat + '<br>Lng: ' + lng);
                
                ubicacionSeleccionada = { lat: parseFloat(lat), lng: parseFloat(lng) };
                
                // Actualizar display y habilitar botón
                document.getElementById('ubicacion-coords').innerHTML = 
                    'Coordenadas: <b>' + lat + ', ' + lng + '</b>';
                document.getElementById('btn-confirmar-ubicacion').disabled = false;
                
                // Auto-zoom al punto
                mapaSelectorUbicacion.setView([lat, lng], 15);
                
                // Abrir popup
                markerSelectorUbicacion.openPopup();
            });
            
            // Permitir búsqueda por geolocalización
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        if (mapaSelectorUbicacion) {
                            mapaSelectorUbicacion.setView([lat, lng], 15);
                        }
                    },
                    function() {
                        // Sin permiso, mantener vista de Argentina
                    }
                );
            }
            
            // Asegurar render correcto
            setTimeout(() => {
                try { 
                    if (mapaSelectorUbicacion) {
                        mapaSelectorUbicacion.invalidateSize(true); 
                    }
                } catch(e) {}
            }, 150);
            
        } catch(e) {
            console.error('Error inicializando mapa selector:', e);
            document.getElementById('ubicacion-map').innerHTML = 
                '<div style="padding:20px; text-align:center; color:red;">Error al cargar el mapa: ' + e.message + '</div>';
        }
    }, 300);
}

function confirmarUbicacion() {
    if (!ubicacionSeleccionada) {
        showAlert('Debe seleccionar una ubicación en el mapa.');
        return;
    }
    
    // Guardar coordenadas en el elemento de display
    const ubic = document.getElementById('new-task-ubic-desc');
    ubic.innerText = '📍 ' + ubicacionSeleccionada.lat.toFixed(4) + ', ' + ubicacionSeleccionada.lng.toFixed(4);
    ubic.dataset.coords = ubicacionSeleccionada.lat + ',' + ubicacionSeleccionada.lng;
    
    volverAtras();
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
        fotosFinalizacion = [];
        document.getElementById('clima-ha-real').value = seleccion.tarea.haAplicar;
        document.getElementById('clima-obs').value = "";
        document.getElementById('fotos-finalizacion').value = '';
        document.getElementById('preview-fotos-finalizacion').innerHTML = '';
        document.getElementById('fotos-finalizacion').onchange = function(e) {
            manejarCargaFotos(e, 'finalizacion');
        };
        navegarA('screen-finish');
    }
}

async function finalizarDefinitivo() {
    try {
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

        // Actualizar estado de la tarea en DATA
        seleccion.tarea.estado = "Hecho";
        seleccion.tarea.haReales = haReales;
        seleccion.tarea.observaciones = document.getElementById('clima-obs').value;
        seleccion.tarea.fotos = fotosFinalizacion.slice(); // Usar 'fotos' en lugar de 'fotosFinalizacion'
        seleccion.tarea.fechaFinalizacion = new Date().toISOString();
        
        // Guardar en historial para trazabilidad
        const registro = {
            id: seleccion.tarea.id,
            cliente: seleccion.cliente,
            nombre: seleccion.tarea.nombre,
            aplicador: seleccion.tarea.aplicador,
            haTotal: seleccion.tarea.haTotal,
            haAplicar: seleccion.tarea.haAplicar,
            haReales: haReales,
            receta: seleccion.tarea.receta,
            observaciones: seleccion.tarea.observaciones,
            fotos: fotosFinalizacion.slice(), // Copiar array de fotos
            fechaFinalizacion: seleccion.tarea.fechaFinalizacion,
            ubicacion: seleccion.tarea.ubicacion
        };
        HISTORIAL.push(registro);
        
        fotosFinalizacion = [];
        guardarTodo();
        
        // Notificación de finalización
        agregarNotificacion(
            '✅ Tarea Completada',
            seleccion.tarea.nombre + ': ' + haReales.toFixed(1) + ' Ha aplicadas',
            'success',
            5000
        );
        
        await showAlert("¡Trabajo Finalizado!\n" + reporte);
        verTareas(seleccion.cliente);
    } catch(e) {
        console.error('Error en finalizarDefinitivo:', e);
        await showAlert('Error al finalizar la tarea: ' + e.message);
    }
}

async function suspenderTarea() {
    const ok = await showConfirm("¿Seguro desea anular la tarea?");
    if(ok) {
        seleccion.tarea.estado = "Suspendida";
        guardarTodo();
        
        agregarNotificacion(
            '🔴 Tarea Anulada',
            seleccion.tarea.nombre + ' ha sido suspendida',
            'warning',
            5000
        );
        
        verTareas(seleccion.cliente);
    }
}

function abrirHistorial() {
    // Llenar dropdown de clientes
    const select = document.getElementById('historial-filtro-cliente');
    select.innerHTML = '<option value="">Todos los clientes</option>';
    Object.keys(DATA).forEach(cliente => {
        const opt = document.createElement('option');
        opt.value = cliente;
        opt.innerText = cliente;
        select.appendChild(opt);
    });
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    document.getElementById('historial-fecha-hasta').valueAsDate = hoy;
    document.getElementById('historial-fecha-desde').valueAsDate = hace30dias;
    
    // Agregar event listeners para filtros
    document.getElementById('historial-filtro-cliente').addEventListener('change', renderHistorial);
    document.getElementById('historial-fecha-desde').addEventListener('change', renderHistorial);
    document.getElementById('historial-fecha-hasta').addEventListener('change', renderHistorial);
    
    renderHistorial();
    navegarA('screen-historial');
}


function abrirDashboard() {
    renderDashboard();
    navegarA('screen-dashboard');
}

function abrirEstadisticasAplicadores() {
    renderEstadisticasAplicadores();
    navegarA('screen-aplicadores-stats');
}

function renderEstadisticasAplicadores() {
    const container = document.getElementById('lista-aplicadores-stats');
    container.innerHTML = '';
    
    // Calcular estadísticas por aplicador
    let estadisticasApp = {};
    
    // Procesar tareas en historial
    HISTORIAL.forEach(tarea => {
        const appId = tarea.aplicador;
        if (!appId) return;
        
        if (!estadisticasApp[appId]) {
            estadisticasApp[appId] = {
                nombre: USERS[appId] ? USERS[appId].name : appId,
                tareasCompletadas: 0,
                hectareasRealizadas: 0,
                hectareasPromedio: 0,
                eficienciaPromedio: 0,
                clientesAtendidos: new Set(),
                totalEficiencias: 0,
                totalTareas: 0
            };
        }
        
        estadisticasApp[appId].tareasCompletadas++;
        estadisticasApp[appId].hectareasRealizadas += parseFloat(tarea.haReales) || 0;
        estadisticasApp[appId].clientesAtendidos.add(tarea.cliente);
        
        const eficiencia = ((parseFloat(tarea.haReales) || 0) / (parseFloat(tarea.haAplicar) || 1)) * 100;
        estadisticasApp[appId].totalEficiencias += eficiencia;
        estadisticasApp[appId].totalTareas++;
    });
    
    // Calcular promedios
    Object.keys(estadisticasApp).forEach(appId => {
        const stats = estadisticasApp[appId];
        stats.hectareasPromedio = stats.tareasCompletadas > 0 ? stats.hectareasRealizadas / stats.tareasCompletadas : 0;
        stats.eficienciaPromedio = stats.totalTareas > 0 ? stats.totalEficiencias / stats.totalTareas : 0;
    });
    
    // Ordenar por tareas completadas
    const ordenados = Object.values(estadisticasApp).sort((a, b) => b.tareasCompletadas - a.tareasCompletadas);
    
    if (ordenados.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:30px;">No hay aplicadores registrados aún.</p>';
        return;
    }
    
    ordenados.forEach((stats, index) => {
        const colorPerfil = ['#667eea', '#f093fb', '#4facfe', '#fa709a', '#36b9a8'][index % 5];
        const colorFondo = ['#e8eaf6', '#f3e5f5', '#e1f5fe', '#fce4ec', '#e0f2f1'][index % 5];
        
        const card = document.createElement('div');
        card.style.cssText = 'padding:16px; background:' + colorFondo + '; border-radius:12px; margin-bottom:12px; border-left:5px solid ' + colorPerfil + '; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
        
        let clientesHtml = '';
        if (stats.clientesAtendidos.size > 0) {
            clientesHtml = '<div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.1); font-size:12px; color:#666;">';
            clientesHtml += '<b>Clientes atendidos:</b> ' + Array.from(stats.clientesAtendidos).join(', ');
            clientesHtml += '</div>';
        }
        
        card.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">' +
                            '<div>' +
                            '<h4 style="margin:0; color:' + colorPerfil + '; font-size:16px;">' + stats.nombre + '</h4>' +
                            '<small style="color:#999;">Aplicador</small>' +
                            '</div>' +
                            '<div style="background:white; padding:8px 12px; border-radius:8px; text-align:center; border:2px solid ' + colorPerfil + ';">' +
                            '<div style="font-size:20px; font-weight:bold; color:' + colorPerfil + ';">' + stats.tareasCompletadas + '</div>' +
                            '<small style="color:#666;">tareas</small>' +
                            '</div>' +
                        '</div>' +
                        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">' +
                            '<div style="background:white; padding:10px; border-radius:8px;">' +
                            '<small style="color:#666;">Hectáreas totales</small><br>' +
                            '<b style="font-size:18px; color:' + colorPerfil + ';">' + stats.hectareasRealizadas.toFixed(1) + ' Ha</b>' +
                            '</div>' +
                            '<div style="background:white; padding:10px; border-radius:8px;">' +
                            '<small style="color:#666;">Eficiencia promedio</small><br>' +
                            '<b style="font-size:18px; color:' + colorPerfil + ';">' + stats.eficienciaPromedio.toFixed(0) + '%</b>' +
                            '</div>' +
                        '</div>' +
                        '<div style="background:white; padding:10px; border-radius:8px; text-align:center;">' +
                        '<small style="color:#666;">Promedio por tarea</small><br>' +
                        '<b style="font-size:14px; color:' + colorPerfil + ';">' + stats.hectareasPromedio.toFixed(2) + ' Ha/tarea</b>' +
                        '</div>' +
                        clientesHtml;
        
        container.appendChild(card);
    });
}

function renderDashboard() {
    try {
        // Calcular métricas globales
        let totalTareas = 0, tareasNuevas = 0, tareasEnProceso = 0, tareasHechas = 0;
        let totalHectareas = 0, hectareasReales = 0;
        let totalStock = 0;
        let aplicadoresUnicos = new Set();
        let resumenClientes = {};
        
        // Procesar tareas actuales
        Object.keys(DATA).forEach(cliente => {
            if (!Array.isArray(DATA[cliente])) return;
            
            DATA[cliente].forEach(tarea => {
                totalTareas++;
                if (tarea.estado === 'Nueva') tareasNuevas++;
                else if (tarea.estado === 'En Proceso') tareasEnProceso++;
                else if (tarea.estado === 'Hecho') tareasHechas++;
                
                const haAplicar = parseFloat(tarea.haAplicar) || 0;
                totalHectareas += haAplicar;
                
                if (tarea.aplicador) aplicadoresUnicos.add(String(tarea.aplicador));
                
                if (!resumenClientes[cliente]) {
                    resumenClientes[cliente] = { tareas: 0, hectareas: 0, stock: 0 };
                }
                resumenClientes[cliente].tareas++;
                resumenClientes[cliente].hectareas += haAplicar;
            });
            
            // Stock por cliente
            const stockCliente = STOCK_POR_CLIENTE[cliente] || [];
            if (Array.isArray(stockCliente)) {
                stockCliente.forEach(item => {
                    const qty = parseFloat(item.q) || 0;
                    totalStock += qty;
                    resumenClientes[cliente].stock += qty;
                });
            }
        });
        
        // Datos del historial
        if (Array.isArray(HISTORIAL)) {
            HISTORIAL.forEach(h => {
                const haReales = parseFloat(h.haReales) || 0;
                hectareasReales += haReales;
            });
        }
        
        // Renderizar KPIs
        document.getElementById('kpi-tareas-totales').innerText = totalTareas;
        document.getElementById('kpi-tareas-desglose').innerText = 
            tareasNuevas + ' nuevas • ' + tareasEnProceso + ' en curso • ' + tareasHechas + ' hechas';
        
        document.getElementById('kpi-hectareas-aplicadas').innerText = hectareasReales.toFixed(0) + ' Ha';
        const porcentajeCumplimiento = totalHectareas > 0 ? ((hectareasReales / totalHectareas) * 100).toFixed(0) : 0;
        document.getElementById('kpi-hectareas-porcentaje').innerText = porcentajeCumplimiento + '% del planificado';
        
        document.getElementById('kpi-stock-total').innerText = totalStock.toFixed(0) + ' Lts';
        const estadoStock = totalStock < 500 ? '⚠️ BAJO' : '✅ Adecuado';
        document.getElementById('kpi-stock-estado').innerText = estadoStock;
        
        document.getElementById('kpi-aplicadores').innerText = aplicadoresUnicos.size;
        const promTareasPorApp = aplicadoresUnicos.size > 0 ? (tareasHechas / aplicadoresUnicos.size).toFixed(1) : 0;
        document.getElementById('kpi-aplicadores-promedio').innerText = promTareasPorApp + ' tareas c/u';
        
        // Renderizar resumen por cliente
        const resumenContainer = document.getElementById('resumen-clientes');
        if (!resumenContainer) return;
        resumenContainer.innerHTML = '';
        
        Object.keys(resumenClientes).forEach(cliente => {
            const r = resumenClientes[cliente];
            const div = document.createElement('div');
            div.style.cssText = 'padding:12px; background:#f9f9f9; border-radius:8px; margin-bottom:8px; border-left:4px solid #2d4031;';
            div.innerHTML = '<b>' + cliente + '</b><br>' +
                            '<small style="color:#666;">📋 ' + r.tareas + ' tareas | 🌾 ' + r.hectareas.toFixed(1) + ' Ha | 📦 ' + r.stock.toFixed(0) + ' Lts</small>';
            resumenContainer.appendChild(div);
        });
        
        // Renderizar alertas
        const alertasContainer = document.getElementById('alertas-criticas');
        if (!alertasContainer) return;
        let alertas = [];
        
        if (totalStock < 500) {
            alertas.push('🔴 Stock crítico: ' + totalStock.toFixed(0) + ' Lts disponibles');
        }
        
        if (tareasEnProceso > 5) {
            alertas.push('🟡 ' + tareasEnProceso + ' tareas en proceso - revisar asignaciones');
        }
        
        Object.keys(DATA).forEach(cliente => {
            if (!Array.isArray(DATA[cliente])) return;
            const tareasPendientes = DATA[cliente].filter(t => t.estado === 'Nueva').length;
            if (tareasPendientes > 3) {
                alertas.push('🟡 ' + cliente + ': ' + tareasPendientes + ' tareas nuevas sin iniciar');
            }
        });
        
        if (alertas.length === 0) {
            alertasContainer.innerHTML = '<small style="color:#2e7d32;">✅ Sin alertas críticas - Sistema operativo normal</small>';
        } else {
            alertasContainer.innerHTML = '';
            alertas.forEach(alerta => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:10px; background:#fff3e0; border-left:3px solid #ff9800; margin-bottom:8px; border-radius:4px; font-size:13px;';
                div.innerText = alerta;
                alertasContainer.appendChild(div);
            });
        }
    } catch(e) {
        console.error('Error en renderDashboard:', e);
        document.getElementById('contenedor-historial') ? document.getElementById('contenedor-historial').innerHTML = '<p style="color:red;">Error al cargar el dashboard. Intente nuevamente.</p>' : null;
    }
}

function limpiarFiltrosHistorial() {
    document.getElementById('historial-filtro-cliente').value = '';
    document.getElementById('historial-fecha-desde').value = '';
    document.getElementById('historial-fecha-hasta').value = '';
    renderHistorial();
}

function renderHistorial() {
    const clienteFiltro = document.getElementById('historial-filtro-cliente').value;
    const fechaDesde = document.getElementById('historial-fecha-desde').value ? new Date(document.getElementById('historial-fecha-desde').value) : null;
    const fechaHasta = document.getElementById('historial-fecha-hasta').value ? new Date(document.getElementById('historial-fecha-hasta').value) : null;
    
    let filtrados = HISTORIAL;
    
    if (clienteFiltro) {
        filtrados = filtrados.filter(h => h.cliente === clienteFiltro);
    }
    
    if (fechaDesde) {
        filtrados = filtrados.filter(h => new Date(h.fechaFinalizacion) >= fechaDesde);
    }
    
    if (fechaHasta) {
        const proximoDia = new Date(fechaHasta);
        proximoDia.setDate(proximoDia.getDate() + 1);
        filtrados = filtrados.filter(h => new Date(h.fechaFinalizacion) < proximoDia);
    }
    
    const container = document.getElementById('contenedor-historial');
    
    if (filtrados.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:30px;">No hay tareas completadas con esos filtros.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    filtrados.forEach(tarea => {
        const fecha = new Date(tarea.fechaFinalizacion);
        const fechaFormato = fecha.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const horaFormato = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const aplicadorNombre = tarea.aplicador && USERS[tarea.aplicador] ? USERS[tarea.aplicador].name : (tarea.aplicador || 'Sin asignar');
        
        const eficiencia = ((tarea.haReales / tarea.haAplicar) * 100).toFixed(0);
        
        const div = document.createElement('div');
        div.className = 'card';
        
        const fotoCount = (tarea.fotos && tarea.fotos.length) || 0;
        const fotoIndicador = fotoCount > 0 ? ' 📷' : '';
        
        div.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">' +
                            '<div>' +
                            '<b>' + tarea.nombre + fotoIndicador + '</b><br>' +
                            '<small style="color:#666;">' + tarea.cliente + '</small>' +
                            '</div>' +
                            '<span style="background:#e8f5e9; color:#2e7d32; padding:4px 8px; border-radius:8px; font-size:12px; font-weight:bold;">' + eficiencia + '%</span>' +
                        '</div>' +
                        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; font-size:13px;">' +
                            '<div><small style="color:#666;">Planificadas</small><br><b>' + tarea.haAplicar + ' Ha</b></div>' +
                            '<div><small style="color:#666;">Realizadas</small><br><b>' + tarea.haReales + ' Ha</b></div>' +
                        '</div>' +
                        '<div style="border-top:1px solid #eee; padding-top:8px; font-size:12px;">' +
                            '<small style="color:#888;">👨‍🌾 ' + aplicadorNombre + ' | 📅 ' + fechaFormato + ' ' + horaFormato + '</small>' +
                        '</div>' +
                        (tarea.observaciones ? '<div style="margin-top:8px; padding:8px; background:#f5f5f5; border-radius:6px; font-size:12px; color:#555;">"' + tarea.observaciones + '"</div>' : '');
        
        // Mostrar galería de fotos si existen
        if (fotoCount > 0) {
            div.innerHTML += '<div style="margin-top:10px; display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">';
            tarea.fotos.forEach(foto => {
                div.innerHTML += '<img src="' + foto.base64 + '" style="width:100%; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="abrirImagenGrande(this.src)">';
            });
            div.innerHTML += '</div>';
        }
        
        container.appendChild(div);
    });
}

function limpiarFiltrosHistorial() {
    document.getElementById('historial-filtro-cliente').value = '';
    document.getElementById('historial-fecha-desde').value = '';
    document.getElementById('historial-fecha-hasta').value = '';
    renderHistorial();
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
    // Log eliminado intencionalmente para limpieza
}

// Exportar helper para ejecutar desde consola
window.runSmokeTests = runSmokeTests;

// --- SINCRONIZACIÓN OFFLINE ---

function agregarACola(evento) {
    if (!SYNC_QUEUE) SYNC_QUEUE = [];
    SYNC_QUEUE.push({
        ...evento,
        timestamp: evento.timestamp || new Date().toISOString()
    });
    localStorage.setItem('AGRO_SYNC_QUEUE', JSON.stringify(SYNC_QUEUE));
}

function actualizarIndicadorConexion() {
    const indicator = document.getElementById('conexion-indicator');
    if (indicator) {
        if (MODO_OFFLINE) {
            indicator.innerHTML = '🔴 SIN CONEXIÓN';
            indicator.style.color = '#d32f2f';
        } else {
            indicator.innerHTML = '🟢 En línea';
            indicator.style.color = '#2e7d32';
        }
    }
}

async function sincronizarCola() {
    if (!CONEXION_ONLINE || !SYNC_QUEUE || SYNC_QUEUE.length === 0) {
        return;
    }
    
    try {
        // Simular envío al servidor (en producción, aquí iría una llamada a API)
        console.log('Sincronizando ' + SYNC_QUEUE.length + ' cambios con servidor...');
        
        // Aquí iría la lógica de sincronización real:
        // await fetch('/api/sync', { method: 'POST', body: JSON.stringify(SYNC_QUEUE) })
        
        // Por ahora, solo limpiamos la cola después de "sincronizar"
        await new Promise(r => setTimeout(r, 500)); // Simular delay de red
        
        SYNC_QUEUE = [];
        localStorage.setItem('AGRO_SYNC_QUEUE', JSON.stringify(SYNC_QUEUE));
        
        console.log('✅ Sincronización completada');
        actualizarIndicadorConexion();
    } catch(e) {
        console.error('Error en sincronización:', e);
    }
}

// Inicializar indicador de conexión al cargar la página
window.addEventListener('DOMContentLoaded', function() {
    actualizarIndicadorConexion();
    // Verificar conexión cada 5 segundos
    setInterval(() => {
        CONEXION_ONLINE = navigator.onLine;
        if (CONEXION_ONLINE && SYNC_QUEUE.length > 0) {
            sincronizarCola();
        }
    }, 5000);
});

// --- EXPORTACIÓN A PDF Y EXCEL ---

function obtenerDatosExportar() {
    // Obtener filtros
    const clienteFilter = document.getElementById('historial-filtro-cliente')?.value || '';
    const desde = document.getElementById('historial-fecha-desde')?.value || '';
    const hasta = document.getElementById('historial-fecha-hasta')?.value || '';
    
    // Filtrar historial
    let tareasFiltradas = HISTORIAL;
    
    if (clienteFilter) {
        tareasFiltradas = tareasFiltradas.filter(t => t.cliente === clienteFilter);
    }
    
    if (desde) {
        const fechaDesde = new Date(desde);
        tareasFiltradas = tareasFiltradas.filter(t => new Date(t.fecha) >= fechaDesde);
    }
    
    if (hasta) {
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        tareasFiltradas = tareasFiltradas.filter(t => new Date(t.fecha) <= fechaHasta);
    }
    
    return tareasFiltradas;
}

function exportarExcel() {
    const tareas = obtenerDatosExportar();
    
    if (tareas.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Crear CSV (Excel acepta CSV)
    let csv = 'Cliente,Aplicador,Fecha,Lote,Hectáreas,Insumo,Observaciones,Fotos\n';
    
    tareas.forEach(t => {
        const fecha = new Date(t.fecha).toLocaleDateString('es-AR');
        const lote = t.lote || '';
        const hectareas = t.hectareas || 0;
        const insumo = t.insumo || '';
        const observaciones = (t.observaciones || '').replace(/"/g, '""'); // Escapar comillas
        const fotoCount = (t.fotos && t.fotos.length) || 0;
        
        csv += `"${t.cliente || ''}","${t.aplicador || ''}","${fecha}","${lote}","${hectareas}","${insumo}","${observaciones}","${fotoCount} fotos"\n`;
    });
    
    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Historial_AgroApp_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    agregarNotificacion('Exportación Excel completada', 'success');
}

function exportarPDF() {
    const tareas = obtenerDatosExportar();
    
    if (tareas.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Crear documento HTML para PDF
    let htmlPDF = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; color: #1a5c3a; }
            .header p { margin: 5px 0; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #1a5c3a; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total { font-weight: bold; background-color: #f0f0f0; }
            .footer { margin-top: 20px; text-align: center; color: #999; font-size: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🌾 AGROAPP - REPORTE DE TAREAS</h1>
            <p>Generado: ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}</p>
            <p style="color: #666;">Total de tareas registradas: ${tareas.length}</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Cliente</th>
                    <th>Aplicador</th>
                    <th>Fecha</th>
                    <th>Lote</th>
                    <th>Hectáreas</th>
                    <th>Insumo</th>
                    <th>Observaciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let totalHectareas = 0;
    tareas.forEach(t => {
        const fecha = new Date(t.fecha).toLocaleDateString('es-AR');
        const lote = t.lote || '-';
        const hectareas = parseFloat(t.hectareas) || 0;
        const insumo = t.insumo || '-';
        const observaciones = (t.observaciones || '').substring(0, 50) + (t.observaciones?.length > 50 ? '...' : '');
        
        totalHectareas += hectareas;
        
        htmlPDF += `
            <tr>
                <td>${t.cliente || '-'}</td>
                <td>${t.aplicador || '-'}</td>
                <td>${fecha}</td>
                <td>${lote}</td>
                <td>${hectareas.toFixed(2)}</td>
                <td>${insumo}</td>
                <td>${observaciones}</td>
            </tr>
        `;
    });
    
    htmlPDF += `
            </tbody>
        </table>
        
        <table style="margin-top: 20px; width: 40%; margin-left: auto; margin-right: auto;">
            <tr class="total">
                <td>TOTAL HECTÁREAS:</td>
                <td style="text-align: right;">${totalHectareas.toFixed(2)}</td>
            </tr>
            <tr class="total">
                <td>TOTAL TAREAS:</td>
                <td style="text-align: right;">${tareas.length}</td>
            </tr>
        </table>
        
        <div class="footer">
            <p>Este reporte fue generado automáticamente por AgroApp.</p>
            <p>Información confidencial - Uso interno únicamente</p>
        </div>
    </body>
    </html>
    `;
    
    // Usar la función de impresión del navegador
    const ventanaPDF = window.open('', '_blank');
    ventanaPDF.document.write(htmlPDF);
    ventanaPDF.document.close();
    
    // Esperar a que se cargue y luego imprimir a PDF
    setTimeout(() => {
        ventanaPDF.print();
    }, 250);
    
    agregarNotificacion('PDF abierto para exportar', 'success');
}
