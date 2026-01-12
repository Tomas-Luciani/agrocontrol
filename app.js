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

let usuarioActual = { rol: "operario" };
let seleccion = { cliente: "", tarea: null, tabActual: "Nueva" };
let pilaNavegacion = [];

// Función Global de Guardado
function guardarTodo() {
    localStorage.setItem('AGRO_DATA', JSON.stringify(DATA));
    localStorage.setItem('AGRO_STOCK', JSON.stringify(STOCK_POR_CLIENTE));
    localStorage.setItem('AGRO_PERFIL', JSON.stringify(PERFIL));
}

// --- 2. NAVEGACIÓN ---

function navegarA(id) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    pilaNavegacion.push(id);
    
    // Configuración del Header
    const header = document.getElementById('main-header');
    header.classList.toggle('hidden', id === 'screen-login');
    
    // Botón volver visible excepto en Main y Login
    const btnVolver = document.getElementById('btn-volver');
    btnVolver.style.visibility = (id === 'screen-main' || id === 'screen-login') ? 'hidden' : 'visible';
}

function volverAtras() {
    if (pilaNavegacion.length > 1) {
        pilaNavegacion.pop(); // Sacar actual
        const anterior = pilaNavegacion.pop(); // Sacar anterior para ir
        navegarA(anterior);
    }
}

function toggleMenu() {
    document.getElementById('side-panel').classList.toggle('hidden');
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
    let html = `<button onclick="toggleMenu(); navegarA('screen-main')">🏠 Mis Clientes</button>`;
    
    // Opción extra para operario
    if(usuarioActual.rol === "operario") {
        html += `<button onclick="irAPerfil()">🚜 Mi Máquina</button>`;
    }
    
    html += `<hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin:10px 0;">
             <button onclick="location.reload()" style="color:#ff8a80;">🚪 Cerrar Sesión</button>`;
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

function guardarPerfil() {
    PERFIL.nombre = document.getElementById('prof-nombre').value;
    PERFIL.maquina = document.getElementById('prof-maquina').value;
    const t = parseFloat(document.getElementById('prof-tanque').value);
    PERFIL.tanque = t || 3000;
    
    guardarTodo();
    alert("Datos de máquina actualizados.");
    volverAtras();
}

// --- 5. GESTIÓN DE CLIENTES ---

function crearNuevoCliente() {
    const nombre = prompt("Ingrese el nombre del nuevo cliente:");
    if(nombre && nombre.trim().length > 0) {
        if(DATA[nombre]) return alert("Ese cliente ya existe.");
        
        DATA[nombre] = [];
        STOCK_POR_CLIENTE[nombre] = [];
        guardarTodo();
        renderClientes();
    }
}

function renderClientes() {
    const cont = document.getElementById('lista-clientes');
    cont.innerHTML = "";
    Object.keys(DATA).forEach(c => {
        const div = document.createElement('div');
        div.className = "card";
        div.innerHTML = `<strong>${c}</strong><br><small>${DATA[c].length} tareas registradas</small>`;
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
        cont.innerHTML = `<p style="text-align:center; color:#999; margin-top:30px;">No hay tareas en esta sección.</p>`;
    } else {
        filtradas.forEach(t => {
            const div = document.createElement('div');
            div.className = "card";
            // Mostramos si es lote completo o parcial en la tarjeta
            const detalleHa = t.haTotal !== t.haAplicar ? 
                `<span style="color:#d32f2f;">Parcial: ${t.haAplicar} Ha</span>` : 
                `<span>Lote: ${t.haTotal} Ha</span>`;
                
            div.innerHTML = `<b>${t.nombre}</b><br><small>${detalleHa}</small>`;
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
    document.getElementById('det-tarea-nombre').innerText = tarea.nombre;
    document.getElementById('det-tarea-desc').innerText = tarea.desc || "Sin observaciones.";
    document.getElementById('det-ha-total').innerText = tarea.haTotal;
    document.getElementById('det-ha-aplicar').innerText = tarea.haAplicar;
    
    const lista = document.getElementById('det-receta-lista');
    lista.innerHTML = "";
    tarea.receta.forEach(p => {
        lista.innerHTML += `<li>🔹 ${p.n}: <b>${p.d} L/Ha</b></li>`;
    });
    
    actualizarBotonesTarea();
    navegarA('screen-task-detail');
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
    // Limpiar formulario
    document.getElementById('new-task-nombre-input').value = "";
    document.getElementById('new-task-ha-total').value = "";
    document.getElementById('new-task-ha-aplicar').value = "";
    document.getElementById('new-task-desc-input').value = "";
    
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
    div.innerHTML = `<input type="text" placeholder="Prod" class="in-nombre" style="flex:2; margin:0;"><input type="number" placeholder="L/Ha" class="in-dosis" style="flex:1; margin:0;">`;
    cont.appendChild(div);
}

function guardarNuevaTarea() {
    const nombre = document.getElementById('new-task-nombre-input').value;
    const haTotalStr = document.getElementById('new-task-ha-total').value;
    
    if(!nombre || !haTotalStr) return alert("Falta nombre o hectáreas totales.");
    
    const haTotal = parseFloat(haTotalStr);
    const isParcial = document.getElementById('check-parcial').checked;
    let haAplicar = haTotal;
    
    if (isParcial) {
        const p = parseFloat(document.getElementById('new-task-ha-aplicar').value);
        if(!p) return alert("Indique las hectáreas a aplicar.");
        haAplicar = p;
    }

    const receta = [];
    document.querySelectorAll('.insumo-row').forEach(row => {
        const n = row.querySelector('.in-nombre').value;
        const d = row.querySelector('.in-dosis').value;
        if(n && d) receta.push({ n, d: parseFloat(d) });
    });

    DATA[seleccion.cliente].push({
        id: Date.now(),
        nombre,
        haTotal,
        haAplicar,
        desc: document.getElementById('new-task-desc-input').value,
        receta,
        estado: "Nueva"
    });
    
    guardarTodo();
    verTareas(seleccion.cliente);
}

// --- 9. CALCULADORA ---

function abrirCalculadora() {
    document.getElementById('resumen-tanque').innerText = PERFIL.tanque;
    document.getElementById('resumen-ha-tarea').innerText = seleccion.tarea.haAplicar;
    document.getElementById('resultado-calc').classList.add('hidden');
    navegarA('screen-calc');
}

function calcularMezcla() {
    const caudal = parseFloat(document.getElementById('caudal-input').value);
    if(!caudal) return;

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
        if (totalNecesario > disponible) aviso.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ Faltante: ${p.n}</p>`;
        
        list.innerHTML += `<li style="color:${color}">${p.n}: <b>${totalNecesario.toFixed(1)} Lts</b> <small>(Stock: ${disponible})</small></li>`;
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

function agregarStock() {
    const n = document.getElementById('stock-nombre').value;
    const q = parseFloat(document.getElementById('stock-cantidad').value);
    if(!n || !q) return;
    
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
        cont.innerHTML += `<div class="stock-item"><span>${i.n}</span> <b>${i.q.toFixed(1)} Lts</b></div>`;
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

function finalizarDefinitivo() {
    const haReales = parseFloat(document.getElementById('clima-ha-real').value);
    if(!haReales) return alert("Debe confirmar las Hectáreas realizadas.");

    // Descuento de Stock
    const receta = seleccion.tarea.receta;
    if (!STOCK_POR_CLIENTE[seleccion.cliente]) STOCK_POR_CLIENTE[seleccion.cliente] = [];
    
    let reporte = "Stock actualizado:\n";
    
    receta.forEach(insumo => {
        const consumo = insumo.d * haReales;
        const item = STOCK_POR_CLIENTE[seleccion.cliente].find(s => s.n.toLowerCase() === insumo.n.toLowerCase());
        
        if (item) {
            item.q = Math.max(0, item.q - consumo);
            reporte += `- ${insumo.n}: -${consumo.toFixed(1)} Lts\n`;
        } else {
            reporte += `- ${insumo.n}: No había stock para descontar.\n`;
        }
    });

    seleccion.tarea.estado = "Hecho";
    seleccion.tarea.haReales = haReales; // Guardamos el dato histórico
    guardarTodo();
    
    alert("¡Trabajo Finalizado!\n" + reporte);
    verTareas(seleccion.cliente);
}

function suspenderTarea() {
    if(confirm("¿Seguro desea anular la tarea?")) {
        seleccion.tarea.estado = "Suspendida";
        guardarTodo();
        verTareas(seleccion.cliente);
    }
}