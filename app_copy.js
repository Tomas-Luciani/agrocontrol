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
    return String(str).replace(/[&<>\"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[s]));
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