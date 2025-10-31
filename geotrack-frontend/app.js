const API_URL = 'http://10.16.19.196:5000/api';

let currentUser = null;
let currentDevice = null;
let map = null;
let markers = {};              // markers[deviceId] = L.marker
let circles = {};
let updateInterval = null;
let lastLocByDevice = {};      // cache ultima ubicacion por dispositivo
let zonePreview = { marker: null, circle: null };
let isDraggingMap = false;
let mapClickLock = false;

function invalidateMapSoon() {
  if (map && typeof map.invalidateSize === 'function') {
    setTimeout(() => map.invalidateSize(), 60);
  }
}

function convertirFechaMySQL(timestamp) {
    const fecha = new Date(timestamp);
    return new Date(fecha.getTime() + (5 * 60 * 60 * 1000));
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

window.addEventListener('resize', invalidateMapSoon);


function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('addDeviceForm').addEventListener('submit', handleAddDevice);
    document.getElementById('addZoneForm').addEventListener('submit', handleAddZone);

    const zoneRadiusInput = document.getElementById('zoneRadius');
    const zoneLatEl = document.getElementById('zoneLat');
    const zoneLngEl = document.getElementById('zoneLng');

    if (zoneRadiusInput && zoneLatEl && zoneLngEl) {
        zoneRadiusInput.addEventListener('input', () => {
            const lat = parseFloat(zoneLatEl.value);
            const lng = parseFloat(zoneLngEl.value);
            const radio = parseInt(zoneRadiusInput.value || '500', 10);
            if (!isNaN(lat) && !isNaN(lng)) {
                showZonePreview(lat, lng, isNaN(radio) ? 500 : radio);
            }
        });
    }

    const zoneModalEl = document.getElementById('addZoneModal');
    if (zoneModalEl) {
        zoneModalEl.addEventListener('hidden.bs.modal', () => {
            clearZonePreview();
            const backs = document.querySelectorAll('.modal-backdrop');
            backs.forEach(el => el.parentNode && el.parentNode.removeChild(el));
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
        });
    }

    const alertsTabBtn = document.getElementById('alertas-tab');
    if (alertsTabBtn) {
        alertsTabBtn.addEventListener('shown.bs.tab', () => {
            if (currentDevice) {
                loadAlerts();
            }
        });
    }
    
    document.body.addEventListener('shown.bs.tab', (ev) => {
        const btn = ev.target; // tab recien mostrado
        if (btn && btn.id === 'alertas-tab' && currentDevice) {
            loadAlerts();
        }
    });

    document.body.addEventListener('shown.bs.tab', (ev) => {
        const btn = ev.target; // tab recien mostrado
        if (btn && btn.id === 'alertas-tab' && currentDevice) {
            loadAlerts();
        }
    });
    document.body.addEventListener('shown.bs.tab', invalidateMapSoon);
}
// Delegacion: escucha clicks en el boton del popup sin depender del momento de creacion
document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#btn-create-zone-here');
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const lat = parseFloat(btn.getAttribute('data-lat'));
    const lng = parseFloat(btn.getAttribute('data-lng'));
    if (map) map.closePopup(); // cierra popup ANTES de abrir el modal

    // dibujar vista previa
    const zoneRadEl = document.getElementById('zoneRadius');
    let radio = parseInt(zoneRadEl && zoneRadEl.value, 10);
    if (isNaN(radio) || radio <= 0) radio = 500;
    showZonePreview(lat, lng, radio);

    // abre modal de forma segura
    confirmAddZoneAt(lat, lng);
}, { passive: false });


function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
        currentUser = JSON.parse(user);
        showMainScreen();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('registerScreen').classList.add('d-none');
    document.getElementById('mainScreen').classList.add('d-none');
}

function showRegister() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('registerScreen').classList.remove('d-none');
    document.getElementById('mainScreen').classList.add('d-none');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.usuario));
            currentUser = data.usuario;
            showMainScreen();
        } else {
            alert(data.error || 'Error al iniciar sesion');
        }
    } catch (error) {
        alert('Error de conexion');
        console.error(error);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value;
    const email = document.getElementById('regEmail').value;
    const telefono = document.getElementById('regTelefono').value;
    const password = document.getElementById('regPassword').value;
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, telefono, password })
        });
        const data = await response.json();
        if (data.success) {
            alert('Registro exitoso. Ahora puedes iniciar sesion');
            showLogin();
        } else {
            alert(data.error || 'Error al registrarse');
        }
    } catch (error) {
        alert('Error de conexion');
        console.error(error);
    }
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('registerScreen').classList.add('d-none');
    document.getElementById('mainScreen').classList.remove('d-none');
    document.getElementById('userName').textContent = currentUser.nombre;
    initMap();
    loadDevices();
    loadZones();
    startAutoUpdate();
}

function initMap() {
    if (!map) {
        map = L.map('map', { dragging: true, tap: false })
            .setView([11.192717, -74.222397], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap contributors'
        }).addTo(map);

        map.on('movestart', () => { isDraggingMap = true; });
        map.on('moveend',   () => { setTimeout(() => { isDraggingMap = false; }, 80); });

        map.on('click', (e) => {
            if (isDraggingMap) return;
            if (mapClickLock) return;
            mapClickLock = true;
            setTimeout(() => { mapClickLock = false; }, 200);

            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            const html = `
                <div class="popup-content">
                    <h6>Nueva zona segura</h6>
                    <small>Lat: ${lat.toFixed(6)} Lon: ${lng.toFixed(6)}</small><br>
                    <button 
                        id="btn-create-zone-here" 
                        class="btn btn-sm btn-success mt-2"
                        data-lat="${lat}" 
                        data-lng="${lng}">
                        Crear zona aqui
                    </button>
                </div>
            `;

            L.popup({ autoClose: true, closeOnClick: true, keepInView: true })
                .setLatLng([lat, lng])
                .setContent(html)
                .openOn(map);
        });
        setTimeout(invalidateMapSoon, 100);
    }
}

function attachCreateZoneHereHandler() {
    const btn = document.getElementById('btn-create-zone-here');
    if (!btn) return;

    // eliminar handlers previos si los hubiera
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    clone.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const lat = parseFloat(clone.getAttribute('data-lat'));
        const lng = parseFloat(clone.getAttribute('data-lng'));

        // cerrar popup de Leaflet antes de abrir modal (evita pantalla “congelada”)
        if (map) map.closePopup();

        // dibujar vista previa
        const zoneRadEl = document.getElementById('zoneRadius');
        let radio = parseInt(zoneRadEl && zoneRadEl.value, 10);
        if (isNaN(radio) || radio <= 0) radio = 500;
        showZonePreview(lat, lng, radio);

        // abrir modal con leve diferido para evitar choque de focus
        confirmAddZoneAt(lat, lng);
    }, { once: true });
}


window.confirmAddZoneAt = function(lat, lng) {
    try {
        const zoneModalEl = document.getElementById('addZoneModal');
        const zoneLatEl   = document.getElementById('zoneLat');
        const zoneLngEl   = document.getElementById('zoneLng');
        const zoneRadEl   = document.getElementById('zoneRadius');
        if (!zoneModalEl || !zoneLatEl || !zoneLngEl || !zoneRadEl) return;

        // limpieza de posibles restos de modales previos
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');

        // set inputs
        zoneLatEl.value = lat.toFixed(6);
        zoneLngEl.value = lng.toFixed(6);

        // abre modal (z-index ya garantizado por CSS)
        const modal = bootstrap.Modal.getOrCreateInstance(zoneModalEl, { backdrop: true, keyboard: true, focus: true });
        setTimeout(() => modal.show(), 20);
    } catch (err) {
        console.error('Error al abrir modal de zona:', err);
    }
};



function showZonePreview(lat, lng, radio) {
    clearZonePreview();
    zonePreview.marker = L.marker([lat, lng], {
        interactive: false, keyboard: false, bubblingMouseEvents: false
    }).addTo(map);
    zonePreview.circle = L.circle([lat, lng], {
        color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.12, radius: radio, interactive: false
    }).addTo(map);
}

function clearZonePreview() {
    if (zonePreview.marker) { map.removeLayer(zonePreview.marker); zonePreview.marker = null; }
    if (zonePreview.circle) { map.removeLayer(zonePreview.circle); zonePreview.circle = null; }
}

async function loadDevices() {
    try {
        if (!currentUser || typeof currentUser.id === 'undefined') {
            renderDevices([]); return;
        }
        // Trae todos (activos e inactivos) para poder activar o desactivar desde UI
        const url = `${API_URL}/dispositivos/usuario/${currentUser.id}?all=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data || !data.success || !Array.isArray(data.dispositivos)) {
            renderDevices([]); return;
        }

        // Cachear ultima ubicacion por dispositivo
        lastLocByDevice = {};
        await Promise.all(
            data.dispositivos.map(async (dev) => {
                try {
                    const r = await fetch(`${API_URL}/ubicaciones/dispositivo/${dev.id}/ultima`);
                    const j = await r.json();
                    lastLocByDevice[dev.id] = j && j.success ? (j.ubicacion || null) : null;
                } catch (_) {
                    lastLocByDevice[dev.id] = null;
                }
            })
        );

        renderDevices(data.dispositivos);
        drawActiveDeviceMarkers(data.dispositivos);

        // Preferir seleccionar el dispositivo 2 si existe y esta activo; si no, el primero activo; si no, el primero
        const preferred = data.dispositivos.find(d => d.id === 2 && d.activo === 1)
                       || data.dispositivos.find(d => d.activo === 1)
                       || data.dispositivos[0];
        if (preferred) selectDevice(preferred);
    } catch (error) {
        console.error('loadDevices error', error);
        renderDevices([]);
    }
}

function drawActiveDeviceMarkers(devices) {
    // Eliminar marcadores que ya no apliquen
    Object.keys(markers).forEach(idStr => {
        const id = parseInt(idStr, 10);
        const stillActive = devices.some(d => d.id === id && d.activo === 1 && lastLocByDevice[id]);
        if (!stillActive) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });

    // Agregar o actualizar marcadores para activos con posicion
    devices.filter(d => d.activo === 1).forEach(d => {
        const loc = lastLocByDevice[d.id];
        if (!loc) return;
        const lat = parseFloat(loc.latitud);
        const lng = parseFloat(loc.longitud);
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="bi bi-geo-alt-fill" style="font-size: 1.6rem; color: #dc3545;"></i>',
            iconSize: [26, 26],
            iconAnchor: [13, 26]
        });

        if (markers[d.id]) {
            markers[d.id].setLatLng([lat, lng]);
        } else {
            markers[d.id] = L.marker([lat, lng], { icon }).addTo(map);
        }

        const fecha = loc.timestamp ? convertirFechaMySQL(loc.timestamp) : null;
        const altTxt = (loc.altitud !== undefined && loc.altitud !== null)
            ? parseFloat(loc.altitud).toFixed(2) + ' m' : 'N/D';

        const popup = `
            <div class="popup-content">
                <h6>${d.nombre}</h6>
                <small>Lat: ${lat.toFixed(6)} Lon: ${lng.toFixed(6)} Alt: ${altTxt}</small><br>
                ${fecha ? `<small>${fecha.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</small>` : ''}
            </div>
        `;
        markers[d.id].bindPopup(popup);
    });
}

function renderDevices(devices) {
    const container = document.getElementById('deviceList');
    if (!container) return;

    if (!Array.isArray(devices) || devices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-phone"></i>
                <p>No tienes dispositivos registrados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = devices.map(device => {
        const loc = lastLocByDevice[device.id] || null;
        const latTxt = loc && loc.latitud != null ? parseFloat(loc.latitud).toFixed(6) : '--';
        const lonTxt = loc && loc.longitud != null ? parseFloat(loc.longitud).toFixed(6) : '--';
        const altTxt = loc && loc.altitud != null ? (parseFloat(loc.altitud).toFixed(2) + ' m') : '--';
        const estado = device.activo === 1 ? 'Activo' : 'Inactivo';
        const badgeClass = device.activo === 1 ? 'bg-success' : 'bg-secondary';

        return `
        <div class="device-item ${currentDevice?.id === device.id ? 'active' : ''}" onclick="selectDevice(${JSON.stringify(device).replace(/"/g, '&quot;')})">
            <div class="device-info">
                <h6><i class="bi bi-phone me-1"></i>${device.nombre} <span class="badge ${badgeClass} ms-1">${estado}</span></h6>
                <small>IMEI: ${device.imei}</small><br>
                <small>Lat: ${latTxt} Lon: ${lonTxt} Alt: ${altTxt}</small>
            </div>
            <div class="device-actions">
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewDeviceLocation(${device.id})" title="Centrar">
                    <i class="bi bi-geo-alt"></i>
                </button>
                ${device.activo === 1 ? `
                    <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); deactivateDevice(${device.id})" title="Desactivar">
                        <i class="bi bi-pause-circle"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); activateDevice(${device.id})" title="Activar">
                        <i class="bi bi-play-circle"></i>
                    </button>
                `}
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteDevice(${device.id})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function selectDevice(device) {
    currentDevice = device;
    loadLastLocation();
    loadAlerts();
    // centrar si hay marker
    if (markers[device.id]) {
        map.setView(markers[device.id].getLatLng(), Math.max(map.getZoom(), 15));
    }
}

async function loadLastLocation() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`${API_URL}/ubicaciones/dispositivo/${currentDevice.id}/ultima`);
        const data = await response.json();
        if (data.success && data.ubicacion) {
            const loc = data.ubicacion;
            lastLocByDevice[currentDevice.id] = loc;
            updateInfo(loc);
            // actualizar marcador del dispositivo seleccionado si esta activo
            if (currentDevice.activo === 1) {
                drawActiveDeviceMarkers([{ ...currentDevice }]); // redibuja solo este si aplica
            }
        }
    } catch (error) {
        console.error('Error cargando ubicacion:', error);
    }
}

function updateInfo(ubicacion) {
    const fecha = convertirFechaMySQL(ubicacion.timestamp);
    document.getElementById('lastUpdate').textContent = fecha.toLocaleTimeString('es-CO', { 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });
    document.getElementById('currentSpeed').textContent = `${parseFloat(ubicacion.velocidad || 0).toFixed(1)} km/h`;
}

async function loadZones() {
    try {
        const response = await fetch(`${API_URL}/zonas/usuario/${currentUser.id}`);
        const data = await response.json();
        if (data.success) {
            renderZones(data.zonas);
            drawZonesOnMap(data.zonas);
        }
    } catch (error) {
        console.error('Error cargando zonas:', error);
    }
}

function renderZones(zones) {
    const container = document.getElementById('zoneList');
    if (zones.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-shield-check"></i>
                <p>No tienes zonas seguras creadas</p>
            </div>
        `;
        return;
    }
    container.innerHTML = zones.map(zone => `
        <div class="zone-item">
            <div class="zone-info">
                <h6><i class="bi bi-shield-check me-1"></i>${zone.nombre}</h6>
                <small>Radio: ${zone.radio}m</small>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteZone(${zone.id})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('');
}

function drawZonesOnMap(zones) {
    Object.values(circles).forEach(circle => map.removeLayer(circle));
    circles = {};
    zones.forEach(zone => {
        const circle = L.circle([parseFloat(zone.latitud), parseFloat(zone.longitud)], {
            color: '#28a745', fillColor: '#28a745', fillOpacity: 0.15, radius: zone.radio
        }).addTo(map);
        circle.bindPopup(`
            <div class="popup-content">
                <h6><i class="bi bi-shield-check me-1"></i>${zone.nombre}</h6>
                <small>Zona segura - ${zone.radio}m</small>
            </div>
        `);
        circles[zone.id] = circle;
    });
}

async function loadAlerts() {
    if (!currentDevice) return;
    try {
        const url = `${API_URL}/alertas/dispositivo/${currentDevice.id}?limit=200`;
        const response = await fetch(url);
        const text = await response.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('[loadAlerts] JSON invalido:', text);
            renderAlerts([]); updateAlertBadge([]); return;
        }
        if (data && data.success && Array.isArray(data.alertas)) {
            renderAlerts(data.alertas);
            updateAlertBadge(data.alertas);
            checkNewAlerts(data.alertas);
        } else {
            console.warn('[loadAlerts] payload inesperado:', data);
            renderAlerts([]); updateAlertBadge([]);
        }
    } catch (error) {
        console.error('Error cargando alertas:', error);
        renderAlerts([]); updateAlertBadge([]);
    }
}

function renderAlerts(alerts) {
    const container = document.getElementById('alertList');
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-bell"></i>
                <p>No hay alertas</p>
            </div>
        `;
        return;
    }
    container.innerHTML = alerts.map(alert => {
        const fecha = convertirFechaMySQL(alert.timestamp);
        return `
        <div class="alert-item nivel-${alert.nivel} ${alert.leida ? 'leida' : ''}">
            <div class="alert-header">
                <span class="alert-type">
                    <i class="bi bi-${getAlertIcon(alert.tipo)}"></i>
                    ${getAlertTitle(alert.tipo)}
                </span>
                <span class="alert-time">${fecha.toLocaleString('es-CO', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })}</span>
            </div>
            <div class="alert-message">${alert.mensaje}</div>
            ${!alert.leida ? `
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="markAsRead(${alert.id})">
                    Marcar como leida
                </button>
            ` : ''}
        </div>
        `;
    }).join('');
}

function getAlertIcon(tipo) {
    const icons = { 'fuera_zona_segura': 'exclamation-triangle-fill', 'velocidad_alta': 'speedometer2', 'inactividad': 'hourglass-split' };
    return icons[tipo] || 'bell-fill';
}

function getAlertTitle(tipo) {
    const titles = { 'fuera_zona_segura': 'Fuera de zona segura', 'velocidad_alta': 'Velocidad inusual', 'inactividad': 'Inactividad prolongada' };
    return titles[tipo] || 'Alerta';
}

function updateAlertBadge(alerts) {
    const unread = alerts.filter(a => !a.leida).length;
    const badge = document.getElementById('alertBadge');
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('d-none'); }
    else { badge.classList.add('d-none'); }
}

function checkNewAlerts(alerts) {
    const soundEnabled = document.getElementById('soundAlertToggle').checked;
    const newAlerts = alerts.filter(a => !a.leida && a.nivel >= 2);
    if (soundEnabled && newAlerts.length > 0) playAlertSound();
}

function playAlertSound() {
    const audio = document.getElementById('alertSound');
    audio.play().catch(() => {});
}

function testAlert() {
    playAlertSound();
    alert('Prueba de sonido de alerta');
}

async function markAsRead(alertId) {
    try {
        const response = await fetch(`${API_URL}/alertas/${alertId}/leer`, { method: 'PUT' });
        if (response.ok) loadAlerts();
    } catch (error) {
        console.error('Error marcando alerta:', error);
    }
}

function showAddDevice() {
    const modal = new bootstrap.Modal(document.getElementById('addDeviceModal'));
    modal.show();
}

async function handleAddDevice(e) {
    e.preventDefault();
    const nombre = document.getElementById('deviceName').value;
    const imei = document.getElementById('deviceIMEI').value;
    try {
        const response = await fetch(`${API_URL}/dispositivos/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: currentUser.id, nombre, imei })
        });
        const data = await response.json();
        if (data.success) {
            alert(`Dispositivo creado\nToken: ${data.token}\nGuarda este token para configurar el dispositivo`);
            bootstrap.Modal.getInstance(document.getElementById('addDeviceModal')).hide();
            document.getElementById('addDeviceForm').reset();
            loadDevices();
        } else {
            alert(data.error || 'Error al crear dispositivo');
        }
    } catch (error) {
        alert('Error de conexion');
        console.error(error);
    }
}

function showAddZone() {
    const modal = new bootstrap.Modal(document.getElementById('addZoneModal'));
    modal.show();
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            document.getElementById('zoneLat').value = position.coords.latitude;
            document.getElementById('zoneLng').value = position.coords.longitude;
        }, () => {
            alert('No se pudo obtener la ubicacion actual');
        });
    } else {
        alert('Geolocalizacion no soportada');
    }
}

async function handleAddZone(e) {
    e.preventDefault();
    const nombre = document.getElementById('zoneName').value;
    const latitud = parseFloat(document.getElementById('zoneLat').value);
    const longitud = parseFloat(document.getElementById('zoneLng').value);
    const radio = parseInt(document.getElementById('zoneRadius').value);
    try {
        const response = await fetch(`${API_URL}/zonas/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: currentUser.id, nombre, latitud, longitud, radio })
        });
        const data = await response.json();
        if (data.success) {
            alert('Zona segura creada exitosamente');
            const inst = bootstrap.Modal.getInstance(document.getElementById('addZoneModal'));
            if (inst) inst.hide();
            document.getElementById('addZoneForm').reset();
            clearZonePreview();
            if (map) map.closePopup();
            loadZones();
        } else {
            alert(data.error || 'Error al crear zona');
        }
    } catch (error) {
        alert('Error de conexion');
        console.error(error);
    }
}

async function deleteZone(zoneId) {
    if (!confirm('Seguro que deseas eliminar esta zona')) return;
    try {
        const response = await fetch(`${API_URL}/zonas/${zoneId}`, { method: 'DELETE' });
        if (response.ok) loadZones();
    } catch (error) {
        console.error('Error eliminando zona:', error);
    }
}

function centerMap() {
    if (currentDevice && markers[currentDevice.id]) {
        map.setView(markers[currentDevice.id].getLatLng(), 15);
    }
}

function viewDeviceLocation(deviceId) {
    const devCard = document.querySelector(`[onclick*="selectDevice"][onclick*="${deviceId}"]`);
    if (devCard) devCard.click();
}

function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        if (currentDevice) {
            loadLastLocation();
            loadAlerts();
        }
    }, 30000);
}

// Acciones de dispositivo
async function activateDevice(deviceId) {
    try {
        const r = await fetch(`${API_URL}/dispositivos/${deviceId}/activar`, { method: 'PUT' });
        const j = await r.json();
        if (j.success) {
            await loadDevices();
        } else {
            alert(j.error || 'No se pudo activar');
        }
    } catch (e) {
        alert('Error de conexion');
        console.error(e);
    }
}

async function deactivateDevice(deviceId) {
    try {
        const r = await fetch(`${API_URL}/dispositivos/${deviceId}/desactivar`, { method: 'PUT' });
        const j = await r.json();
        if (j.success) {
            await loadDevices();
        } else {
            alert(j.error || 'No se pudo desactivar');
        }
    } catch (e) {
        alert('Error de conexion');
        console.error(e);
    }
}

async function deleteDevice(deviceId) {
    if (!confirm('Seguro que deseas eliminar este dispositivo')) return;
    try {
        const r = await fetch(`${API_URL}/dispositivos/${deviceId}`, { method: 'DELETE' });
        const j = await r.json();
        if (j.success) {
            await loadDevices();
        } else {
            alert(j.error || 'No se pudo eliminar');
        }
    } catch (e) {
        alert('Error de conexion');
        console.error(e);
    }
}

function logout() {
    if (confirm('Cerrar sesion')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
        currentDevice = null;
        if (updateInterval) clearInterval(updateInterval);
        showLogin();
    }
}
