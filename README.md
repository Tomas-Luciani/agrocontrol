AgroApp — Pruebas rápidas de asignación de aplicadores

Pasos de verificación (rápido):

1) Ingresar como **Ingeniero** (nombre cualquiera).
   - Crear un cliente nuevo si es necesario.
   - Usar **+ Agregar aplicador** para crear/añadir un aplicador para ese cliente.
   - Crear una *tarea* y asignarle el aplicador.

2) Cerrar sesión y volver a ingresar como **Operario / Aplicador** con el mismo nombre.
   - Verificar que en "Clientes Activos" solo aparece el cliente al que el ingeniero asignó al aplicador.

3) Como **Ingeniero** nuevamente:
   - Abrir la tarea -> botón "Cambiar aplicador" -> seleccionar o crear nuevo aplicador.
   - Verificar que la tarea muestra el nuevo aplicador y que, al ingresar como ese aplicador, aparece el cliente correspondiente.

Notas técnicas:
- El código normaliza nombres legacy a user-ids automáticamente con `normalizeAplicadoresForClient(cliente)`.
- Los datos se guardan en localStorage: `AGRO_DATA`, `AGRO_USERS`, `AGRO_APLICADORES`, `AGRO_SESSION`, etc.
- Existe un helper para pruebas: `window.runSmokeTests(client)` (usa una prueba simulada; no muestra logs en consola).
- Backups: copias redundantes (por ejemplo `app_copy.js`, `app_part_1.js`, `app_partial_200.js`) se movieron a la carpeta `backups/` con timestamp para mantener un historial sin saturar el directorio principal.