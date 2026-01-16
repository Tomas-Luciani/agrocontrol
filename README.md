AgroApp — Sistema de Gestión de Pulverización

## Descripción General

AgroApp es una aplicación web progresiva (PWA) diseñada para gestionar y optimizar operaciones de pulverización agrícola. Permite a ingenieros asignar tareas a aplicadores, controlar stock de insumos, rastrear ubicaciones de lotes y generar reportes de eficiencia.

**Características principales:**
- ✅ Gestión integral de tareas (crear, asignar, ejecutar, finalizar)
- ✅ Control de stock en tiempo real
- ✅ Historial completo con trazabilidad
- ✅ Dashboard ejecutivo con KPIs
- ✅ Modo offline automático
- ✅ Fotografías de referencia y cierre
- ✅ Selector de ubicación interactivo con mapa
- ✅ Estadísticas de desempeño por aplicador
- ✅ Indicador de estado de conexión

---

## Flujos Principales

### 👨‍💼 INGENIERO AGRÓNOMO

**1. Crear Cliente**
- Menú ☰ → "Mis Clientes" → "+ NUEVO CLIENTE"
- Ingresa nombre del cliente
- Se crea automáticamente

**2. Crear Tarea**
- Selecciona cliente → "+ TAREA"
- Llena: nombre, hectáreas, receta (insumos + dosis)
- **Opcional:** Selecciona ubicación en mapa 📍
- **Opcional:** Carga fotos de referencia 📷
- Asigna aplicador
- Confirma

**3. Asignar Aplicador a Tarea**
- Abre detalle de tarea → "Cambiar aplicador"
- Selecciona de la lista o crea nuevo
- Confirma

**4. Gestionar Stock**
- En pantalla de tareas → "📦 STOCK"
- Carga insumos y cantidades
- Se decuentan automáticamente al finalizar tareas

**5. Monitorear Progreso**
- **Dashboard:** Menú ☰ → "📊 Dashboard"
  - KPIs globales (tareas, hectáreas, stock, aplicadores)
  - Alertas de stock bajo o tareas retrasadas
  - Resumen por cliente

**7. Revisar Historial y Exportar**
- Menú ☰ → "📋 Historial"
- Filtra por cliente y fechas
- Ve: Ha realizadas, eficiencia, observaciones, fotos
- Botones de exportación:
  - **📊 Excel:** Descarga CSV con todas las tareas
  - **📄 PDF:** Abre reporte formateado para guardar/imprimir
- Reporte incluye: totales de hectáreas, cantidad de tareas, información de aplicadores

---

### 🚜 OPERARIO / APLICADOR

**1. Ver Tareas Asignadas**
- Login con su nombre
- Solo ve clientes donde el ingeniero lo asignó
- Selecciona cliente → ve tareas disponibles

**2. Comenzar Tarea**
- Abre detalle → "COMENZAR TAREA"
- Estado cambia a "En Proceso"

**3. Calcular Mezcla**
- Detalle de tarea → "🧮 CALCULADORA"
- Ingresa caudal (L/Ha)
- Ve: Ha por tanque, cargas necesarias, insumos totales
- **Alerta:** Si stock es insuficiente

**4. Finalizar Trabajo**
- Estado "En Proceso" → "FINALIZAR TAREA"
- Confirma hectáreas reales aplicadas
- **Opcional:** Agrega observaciones
- **Opcional:** Carga fotos de cierre 📷
- Stock se descuenta automáticamente

**5. Configurar Máquina**
- Menú ☰ → "Mi Máquina"
- Ingresa: marca, modelo, capacidad de tanque

---

## Gestión del Almacenamiento

⚠️ **localStorage está limitado a 5-10MB por navegador:**

**Optimizaciones automáticas:**
- ✅ Compresión de imágenes (JPEG 65% + redimensión a 800px)
- ✅ Limpieza automática: Historial >30 días se descarta al alcanzar cuota
- ✅ Indicador de espacio: Menú ☰ → "💾 Almacenamiento (X.XXMB)"
- ✅ Alertas inteligentes cuando espacio es bajo

**Si recibe error "Storage Quota Exceeded":**
1. Menú ☰ → "💾 Almacenamiento"
2. El sistema ofrecerá limpiar datos antiguos
3. Confirm para liberar espacio
4. Intente la operación nuevamente

**Recomendaciones:**
- 📱 Para muchas fotos: Use API Backend en futuras versiones
- 📊 Para históricos grandes: Exporte regularmente a PDF/Excel
- 🗑️ Limpie historial >30 días mensualmente (automático al llegar a cuota)

---

## Modo Offline

✅ **Funciona completamente sin internet:**
- Todas las operaciones se guardan en localStorage
- Se sincroniza automáticamente al reconectar
- Indicador en header: 🔴 SIN CONEXIÓN / 🟢 En línea

---

## Almacenamiento de Datos

| Clave | Contenido |
|-------|-----------|
| `AGRO_DATA` | Tareas por cliente |
| `AGRO_USERS` | Usuarios (ingeniero/operario) |
| `AGRO_APLICADORES` | Asignación de aplicadores por cliente |
| `AGRO_STOCK` | Stock de insumos por cliente |
| `AGRO_PERFIL` | Datos de máquina del operario |
| `AGRO_HISTORIAL` | Tareas completadas (trazabilidad) |
| `AGRO_SESSION` | Usuario logueado |
| `AGRO_SYNC_QUEUE` | Cola de cambios pendientes (offline) |
| `AGRO_NOTIFICACIONES` | Log de notificaciones |

---

## Características Técnicas

- **Frontend:** HTML5 + CSS3 + JavaScript vanilla
- **Mapas:** Leaflet + OpenStreetMap
- **Persistencia:** localStorage (con compresión y limpieza automática)
- **Clima:** API Open-Meteo (gratuito)
- **Responsivo:** 100% mobile-first
- **Offline:** Sincronización automática
- **Exportación:** CSV (Excel) y PDF con formato profesional
- **Compresión:** Imágenes JPEG 65% calidad + máx 800px ancho

---

## Próximas Mejoras Planeadas

1. ✅ **Exportación a PDF/Excel** - COMPLETADO ✨
2. ✅ **Notificaciones Push** - COMPLETADO ✨
3. ✅ **Compresión de Imágenes** - COMPLETADO ✨
4. 🔗 **API Backend** - Integración con servidor
5. 📍 **GPS en Vivo** - Rastreo de aplicadores en tiempo real
6. 📱 **App Nativa** - PWA instalable en home screen

---

## Pruebas Rápidas

**Flujo completo:**
1. Login como Ingeniero → Crear cliente → +Agregar aplicador → Crear tarea
2. Logout → Login como Aplicador → Ver cliente → Seleccionar tarea → Comenzar → Finalizar
3. Login como Ingeniero → Revisar Dashboard, Estadísticas e Historial → Exportar reportes

**Exportar datos:**
1. Menú ☰ → "📋 Historial"
2. Opcional: Filtra por cliente y fechas
3. Haz click en **📊 Excel** o **📄 PDF**
4. El archivo se descarga o abre en nueva ventana para guardar

**Limpiar almacenamiento:**
1. Menú ☰ → "💾 Almacenamiento (X.XXMB)"
2. Sistema ofrecerá limpiar tareas >30 días
3. Confirm para liberar espacio

---

## Soporte

Para problemas de sincronización, abre la consola (F12) y ejecuta:
```javascript
console.log(SYNC_QUEUE); // Ver cola pendiente
console.log(HISTORIAL); // Ver historial
console.log(NOTIFICACIONES); // Ver notificaciones
console.log('Almacenamiento: ' + obtenerTamanoStorage() + 'MB'); // Ver tamaño
```

**Contacto:** Tomas Luciani - AgroControl Pro
