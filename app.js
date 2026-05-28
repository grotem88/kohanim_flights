/* ===================================
   טומאת כהנים בטיסות — App Logic
   =================================== */

(function () {
  'use strict';

  // =====================
  // Configuration
  // =====================
  const CONFIG = {
    CEMETERY_CENTER: [32.05, 34.83], // Central point in Gush Dan to cover all cemeteries

    // Flight data APIs — tried in order until one succeeds
    FLIGHT_APIS: [
      'https://api.airplanes.live/v2/point/{lat}/{lon}/{dist}',
      'https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{dist}',
      'https://opensky-network.org/api/states/all?lamin=31.8&lomin=34.5&lamax=32.2&lomax=35.1',
    ],

    POLL_INTERVAL_MS: 5000,
    SEARCH_RADIUS_NM: 22,       // Increased to cover all Gush Dan cemeteries
    TRAIL_MAX_POINTS: 80,
    BUFFER_METERS: 50,          // buffer around cemetery polygons
    MAP_DEFAULT_ZOOM: 12,
    STALE_FLIGHT_MS: 60000,     // mark flights inactive if not seen for 60s
    API_TIMEOUT_MS: 8000,       // timeout for API requests

    CEMETERIES: [
      {
        id: 'holon',
        name: 'דרום (חולון)',
        city: 'חולון',
        center: [31.998, 34.754],
        polygon: [
          [32.0012488, 34.7587825],
          [32.0018071, 34.7556271],
          [32.0018163, 34.7554823],
          [32.001778, 34.7553553],
          [32.001695, 34.7553044],
          [32.0015537, 34.7552455],
          [32.0014594, 34.7552522],
          [32.0014144, 34.7553818],
          [32.0013704, 34.7553673],
          [32.0015322, 34.7542381],
          [32.0022841, 34.7504513],
          [32.0009763, 34.749607],
          [31.9997816, 34.7489455],
          [31.9972235, 34.7484332],
          [31.9965111, 34.7497888],
          [31.9967058, 34.7498752],
          [31.9962504, 34.7509078],
          [31.996765, 34.7511842],
          [31.9948132, 34.755134],
          [31.9943555, 34.7548351],
          [31.9936085, 34.7563113],
          [31.994015, 34.7564131],
          [31.9953045, 34.7566183],
          [31.9958484, 34.7567049],
          [31.9965495, 34.7581209],
          [31.9980793, 34.758305],
          [31.9986396, 34.7584356],
          [32.0002107, 34.7586708],
          [32.0008744, 34.7588371],
          [32.0010703, 34.758872],
          [32.0011767, 34.7588674],
          [32.0012488, 34.7587825]
        ]
      },
      {
        id: 'rosh_haayin',
        name: 'ראש העין',
        city: 'ראש העין',
        center: [32.1046, 34.9579],
        polygon: [
          [32.1034886, 34.9571374],
          [32.1039898, 34.957099],
          [32.1045328, 34.9571468],
          [32.1057649, 34.9573041],
          [32.1057649, 34.9586538],
          [32.1040795, 34.9585709],
          [32.1039466, 34.9585644],
          [32.1037848, 34.9583652],
          [32.1036091, 34.9578611],
          [32.1035024, 34.9574667],
          [32.1034886, 34.9571374]
        ]
      },
      {
        id: 'yarkon',
        name: 'ירקון',
        city: 'פתח תקווה',
        center: [32.1156, 34.8700],
        polygon: [
          [32.1187725, 34.8682845],
          [32.1175698, 34.8672657],
          [32.1169535, 34.866166],
          [32.1167665, 34.8660333],
          [32.1166141, 34.8660255],
          [32.1164898, 34.8659023],
          [32.1161526, 34.8658441],
          [32.1158549, 34.8656272],
          [32.1152654, 34.8647532],
          [32.1150146, 34.8643928],
          [32.1147948, 34.8641257],
          [32.1145348, 34.8639658],
          [32.1141979, 34.8638552],
          [32.1138006, 34.8636031],
          [32.1136962, 34.8634812],
          [32.1135128, 34.8632529],
          [32.1133124, 34.8630677],
          [32.1132012, 34.862993],
          [32.1130336, 34.8629176],
          [32.1128525, 34.8628432],
          [32.1121931, 34.8627814],
          [32.1116016, 34.8627791],
          [32.1112084, 34.8627953],
          [32.1110587, 34.8628357],
          [32.1118957, 34.8643398],
          [32.1122414, 34.8649088],
          [32.1124913, 34.8647996],
          [32.1126443, 34.8651785],
          [32.1127873, 34.8653564],
          [32.1126684, 34.8654828],
          [32.1134348, 34.866575],
          [32.1132221, 34.8667477],
          [32.1125719, 34.8671266],
          [32.1113137, 34.8684686],
          [32.1132062, 34.8729089],
          [32.1140711, 34.8743396],
          [32.1145997, 34.8749753],
          [32.115083, 34.8753873],
          [32.1159576, 34.8759586],
          [32.1162893, 34.8761169],
          [32.1164847, 34.8760927],
          [32.1169937, 34.8760015],
          [32.1169913, 34.8756743],
          [32.1180033, 34.8734101],
          [32.118109, 34.8732612],
          [32.1193711, 34.8698784],
          [32.1195039, 34.869134],
          [32.1193364, 34.8687354],
          [32.1187725, 34.8682845]
        ]
      },
      {
        id: 'elad',
        name: 'אלעד',
        city: 'אלעד',
        center: [32.042, 34.951],
        polygon: [
          [32.043464, 34.952785],
          [32.0433309, 34.9530103],
          [32.04349, 34.9533312],
          [32.042645, 34.9533278],
          [32.0414644, 34.9516038],
          [32.041638, 34.9512658],
          [32.0418695, 34.9510405],
          [32.0419679, 34.9509859],
          [32.0421328, 34.9509961],
          [32.0422602, 34.9510268],
          [32.043464, 34.952785]
        ]
      },
      {
        id: 'or_yehuda',
        name: 'אור יהודה',
        city: 'אור יהודה',
        center: [32.030, 34.835],
        polygon: [
          [32.0307077, 34.8356643],
          [32.0289424, 34.8365202],
          [32.0286095, 34.8347049],
          [32.0306602, 34.8344408],
          [32.0307077, 34.8356643]
        ]
      }
    ]
  };

  // =====================
  // State
  // =====================
  const state = {
    map: null,
    cemeteries: [],              // store cemetery configuration and layers

    flights: new Map(),          // id -> { data, marker, trailLine, trailPoints, isOver, lastSeen, firstSeen, active, visible }
    importedFlights: new Map(),  // id -> { id, callsign, visible, layers, data }
    historicalFlights: [],       // flights from FR24 playback
    isTracking: true,
    pollTimer: null,
    currentApiIndex: 0,
    dataSource: '',
    lastFetchError: null,
    fetchSuccessCount: 0,
    connectionStatus: 'connecting', // 'connecting' | 'connected' | 'error'
    importedTrailLayers: [],     // track imported trail layers

    panelState: 'expanded',      // 'hidden' | 'expanded' | 'collapsed' (default open Live Flights on load)
    activeTab: 'live',           // 'live' | 'imported'

    stats: {
      totalSeen: new Set(),
      totalCrossed: new Set(),
      currentOverCount: 0,
      crossingAltitudes: [],
      crossedFlightDetails: [],  // store details of flights that crossed
    },
  };

  // =====================
  // DOM Elements
  // =====================
  const DOM = {};

  function cacheDom() {
    DOM.loadingOverlay = document.getElementById('loadingOverlay');
    DOM.liveBadge = document.getElementById('liveBadge');
    DOM.liveBadgeText = document.getElementById('liveBadgeText');
    DOM.connectionDot = document.getElementById('connectionDot');
    DOM.btnToggleTracking = document.getElementById('btnToggleTracking');
    DOM.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    DOM.btnToggleLiveTable = document.getElementById('btnToggleLiveTable');
    DOM.btnToggleTable = document.getElementById('btnToggleTable');
    DOM.sidebar = document.getElementById('sidebar');
    DOM.sidebarToggle = document.getElementById('sidebarToggle');
    DOM.alertBanner = document.getElementById('alertBanner');
    DOM.alertText = document.getElementById('alertText');
    DOM.alertCount = document.getElementById('alertCount');
    DOM.flightList = document.getElementById('flightList');
    DOM.flightCount = document.getElementById('flightCount');
    DOM.statActiveFlights = document.getElementById('statActiveFlights');
    DOM.statOverCemetery = document.getElementById('statOverCemetery');
    DOM.statTotalSeen = document.getElementById('statTotalSeen');
    DOM.statTotalCrossed = document.getElementById('statTotalCrossed');
    DOM.statAvgAltitude = document.getElementById('statAvgAltitude'); // may be null if removed from HTML
    DOM.dataSourceLabel = document.getElementById('dataSourceLabel');
    DOM.statusMessage = document.getElementById('statusMessage');
    DOM.btnOpenFr24 = document.getElementById('btnOpenFr24');
    DOM.btnImportData = document.getElementById('btnImportData');
    DOM.btnExportData = document.getElementById('btnExportData');
    DOM.btnClearHistory = document.getElementById('btnClearHistory');
    DOM.importFileInput = document.getElementById('importFileInput');
    DOM.historyPanel = document.getElementById('historyPanel');
    DOM.historyList = document.getElementById('historyList');

    DOM.unifiedPanel = document.getElementById('unifiedPanel');
    DOM.tabLiveFlights = document.getElementById('tabLiveFlights');
    DOM.tabImportedResults = document.getElementById('tabImportedResults');
    DOM.contentLiveFlights = document.getElementById('contentLiveFlights');
    DOM.contentImportedResults = document.getElementById('contentImportedResults');
    DOM.panelCollapse = document.getElementById('panelCollapse');
    DOM.panelClose = document.getElementById('panelClose');
  }

  // =====================
  // Initialization
  // =====================
  async function init() {
    cacheDom();
    initMap();
    setupEventListeners();
    updatePanelUI();

    updateStatusMessage('טוען מפות בתי העלמין...');

    // Draw all four cemeteries
    drawCemeteries();
    updateStatusMessage('מפות בתי העלמין נטענו ✓');

    // Hide loading overlay
    setTimeout(() => {
      DOM.loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        if (DOM.loadingOverlay.parentNode) DOM.loadingOverlay.remove();
      }, 600);
    }, 800);

    // Start tracking
    updateStatusMessage('מתחבר למקור נתוני טיסות...');
    startTracking();

    // Load local history
    loadStateFromLocalStorage();
  }

  // =====================
  // Status Messages & Toast Notifications
  // =====================
  function updateStatusMessage(msg) {
    if (DOM.statusMessage) {
      DOM.statusMessage.textContent = msg;
      DOM.statusMessage.style.opacity = '1';
      clearTimeout(state._statusTimeout);
      state._statusTimeout = setTimeout(() => {
        DOM.statusMessage.style.opacity = '0';
      }, 5000);
    }
  }

  function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || icons.info}</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  function updateConnectionStatus(status) {
    state.connectionStatus = status;
    if (!DOM.connectionDot) return;

    DOM.connectionDot.className = 'live-badge__dot';
    if (status === 'connected') {
      DOM.connectionDot.style.background = 'var(--safe)';
      DOM.liveBadge.classList.remove('paused');
    } else if (status === 'error') {
      DOM.connectionDot.style.background = 'var(--danger)';
      DOM.liveBadge.classList.add('paused');
    } else {
      DOM.connectionDot.style.background = 'var(--warning)';
    }
  }

  function updatePanelUI() {
    const panel = DOM.unifiedPanel;
    if (!panel) return;

    // Apply visibility class
    if (state.panelState === 'hidden') {
      panel.classList.add('results-panel--hidden');
      document.body.classList.remove('panel-open', 'panel-collapsed');
    } else if (state.panelState === 'collapsed') {
      panel.classList.remove('results-panel--hidden');
      panel.classList.add('collapsed');
      document.body.classList.remove('panel-open');
      document.body.classList.add('panel-collapsed');
    } else {
      panel.classList.remove('results-panel--hidden');
      panel.classList.remove('collapsed');
      document.body.classList.add('panel-open');
      document.body.classList.remove('panel-collapsed');
    }

    // Apply active tab class and contents visibility
    if (state.activeTab === 'live') {
      panel.className = 'results-panel' + (state.panelState === 'hidden' ? ' results-panel--hidden' : '') + (state.panelState === 'collapsed' ? ' collapsed' : '') + ' tab-live';
      if (DOM.tabLiveFlights) DOM.tabLiveFlights.classList.add('active');
      if (DOM.tabImportedResults) DOM.tabImportedResults.classList.remove('active');
      if (DOM.contentLiveFlights) DOM.contentLiveFlights.classList.remove('hidden');
      if (DOM.contentImportedResults) DOM.contentImportedResults.classList.add('hidden');
    } else {
      panel.className = 'results-panel' + (state.panelState === 'hidden' ? ' results-panel--hidden' : '') + (state.panelState === 'collapsed' ? ' collapsed' : '') + ' tab-imported';
      if (DOM.tabLiveFlights) DOM.tabLiveFlights.classList.remove('active');
      if (DOM.tabImportedResults) DOM.tabImportedResults.classList.add('active');
      if (DOM.contentLiveFlights) DOM.contentLiveFlights.classList.add('hidden');
      if (DOM.contentImportedResults) DOM.contentImportedResults.classList.remove('hidden');
    }

    // Highlight header buttons based on state
    if (DOM.btnToggleLiveTable) {
      if (state.panelState !== 'hidden' && state.activeTab === 'live') {
        DOM.btnToggleLiveTable.classList.add('btn-toggle--active');
        DOM.btnToggleLiveTable.style.background = 'rgba(16, 185, 129, 0.2)';
        DOM.btnToggleLiveTable.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        DOM.btnToggleLiveTable.style.color = '#6ee7b7';
      } else {
        DOM.btnToggleLiveTable.classList.remove('btn-toggle--active');
        DOM.btnToggleLiveTable.style.background = '';
        DOM.btnToggleLiveTable.style.borderColor = '';
        DOM.btnToggleLiveTable.style.color = '';
      }
    }

    if (DOM.btnToggleTable) {
      if (state.panelState !== 'hidden' && state.activeTab === 'imported') {
        DOM.btnToggleTable.classList.add('btn-toggle--active');
        DOM.btnToggleTable.style.background = 'rgba(139, 92, 246, 0.2)';
        DOM.btnToggleTable.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        DOM.btnToggleTable.style.color = '#c4b5fd';
      } else {
        DOM.btnToggleTable.classList.remove('btn-toggle--active');
        DOM.btnToggleTable.style.background = '';
        DOM.btnToggleTable.style.borderColor = '';
        DOM.btnToggleTable.style.color = '';
      }
    }

    // Update collapse button text
    if (DOM.panelCollapse) {
      DOM.panelCollapse.textContent = state.panelState === 'collapsed' ? '▲' : '▼';
    }

    // Invalidate Leaflet map size after rendering/animation
    if (state.map) {
      setTimeout(() => {
        state.map.invalidateSize();
      }, 350); // Match transition duration
    }
  }

  // =====================
  // Map Module
  // =====================
  function initMap() {
    state.map = L.map('map', {
      center: CONFIG.CEMETERY_CENTER,
      zoom: CONFIG.MAP_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://osm.org/">OSM</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(state.map);

    // Zoom control bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  }

  // =====================
  // Cemetery Module
  // =====================

  function drawCemeteries() {
    for (const cemetery of CONFIG.CEMETERIES) {
      // Draw main polygon
      const layer = L.polygon(cemetery.polygon, {
        color: '#9333ea',
        fillColor: '#7c3aed',
        fillOpacity: 0.22,
        weight: 2.5,
        dashArray: '6 4',
        className: 'cemetery-polygon',
      }).addTo(state.map);

      layer.bindPopup(`
        <div class="cemetery-popup">
          <h3>🪦 בית העלמין ${escapeHtml(cemetery.name)}</h3>
          <p>עיר: ${escapeHtml(cemetery.city)}</p>
          <p>טומאה בוקעת ועולה — ללא הגבלת גובה</p>
        </div>
      `);

      // Build Turf polygon for intersection calculations
      const turfCoords = cemetery.polygon.map(p => [p[1], p[0]]);  // [lon, lat]
      // Ensure ring is closed
      if (turfCoords.length > 0) {
        const first = turfCoords[0];
        const last = turfCoords[turfCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          turfCoords.push([...first]);
        }
      }

      const turfPolygon = turf.polygon([turfCoords]);

      // Create buffered polygon
      const turfBuffered = turf.buffer(
        turfPolygon,
        CONFIG.BUFFER_METERS / 1000,
        { units: 'kilometers' }
      );

      // Draw buffer zone
      const bufferLayer = L.geoJSON(turfBuffered, {
        style: {
          color: '#9333ea',
          fillColor: '#9333ea',
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '3 6',
          opacity: 0.4,
        },
      }).addTo(state.map);

      // Add label
      const center = turf.center(turfPolygon);
      const [lon, lat] = center.geometry.coordinates;
      const labelMarker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            color: #c084fc;
            font-size: 11px;
            font-weight: 700;
            font-family: Heebo, sans-serif;
            text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 16px rgba(0,0,0,0.6);
            white-space: nowrap;
            text-align: center;
            pointer-events: none;
          ">🪦 ${escapeHtml(cemetery.name)}</div>`,
          iconSize: [140, 20],
          iconAnchor: [70, 10],
        }),
        interactive: false,
      }).addTo(state.map);

      state.cemeteries.push({
        id: cemetery.id,
        name: cemetery.name,
        layer,
        bufferLayer,
        labelMarker,
        turfPolygon,
        turfBuffered
      });
    }
  }

  // =====================
  // Flight Tracker Module
  // =====================
  function startTracking() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    fetchFlights(); // immediate first fetch
    state.pollTimer = setInterval(fetchFlights, CONFIG.POLL_INTERVAL_MS);
  }

  function stopTracking() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function fetchFlights() {
    if (!state.isTracking) return;

    const apis = CONFIG.FLIGHT_APIS;
    const [lat, lon] = CONFIG.CEMETERY_CENTER;
    const dist = CONFIG.SEARCH_RADIUS_NM;

    for (let i = 0; i < apis.length; i++) {
      const apiIndex = (state.currentApiIndex + i) % apis.length;
      const urlTemplate = apis[apiIndex];
      const url = urlTemplate
        .replace('{lat}', lat)
        .replace('{lon}', lon)
        .replace('{dist}', dist);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();

        // Normalize different API formats
        let aircraftList = [];
        if (data.ac) {
          // airplanes.live / adsb.lol format
          aircraftList = data.ac;
        } else if (data.states) {
          // OpenSky Network format: states = array of arrays
          aircraftList = data.states.map(s => ({
            hex: s[0] || '',
            flight: (s[1] || '').trim(),
            lon: s[5],
            lat: s[6],
            alt_baro: s[7] ? Math.round(s[7] * 3.28084) : null, // meters -> feet
            gs: s[9] ? Math.round(s[9] * 1.944) : null, // m/s -> knots
            track: s[10],
            t: '',
          })).filter(ac => ac.lat && ac.lon);
        }

        const sourceName = url.includes('airplanes.live') ? 'airplanes.live'
          : url.includes('adsb.lol') ? 'adsb.lol'
          : url.includes('opensky') ? 'OpenSky'
          : 'API';

        state.currentApiIndex = apiIndex;
        state.lastFetchError = null;
        state.fetchSuccessCount++;
        updateConnectionStatus('connected');

        if (aircraftList.length > 0) {
          processFlights(aircraftList);
          updateStatusMessage(`מחובר ל-${sourceName} — ${aircraftList.length} טיסות`);
          if (DOM.dataSourceLabel) DOM.dataSourceLabel.textContent = sourceName;
        } else {
          updateStatusMessage('אין טיסות באזור כרגע');
        }

        if (state.fetchSuccessCount === 1) {
          showToast(`מחובר בהצלחה ל-${sourceName}`, 'success');
        }
        return;

      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn(`API timeout: ${urlTemplate}`);
        } else {
          console.warn(`API failed: ${urlTemplate}`, err.message);
        }
        continue;
      }
    }

    // All APIs failed
    state.lastFetchError = 'All APIs failed';
    updateConnectionStatus('error');
    updateStatusMessage('שגיאת חיבור — כל ה-APIs נכשלו. מנסה שוב בעוד 5 שניות...');
    showToast('שגיאת חיבור — בודק שוב...', 'warning');
  }

  function setFlightMapOpacity(flight, active) {
    if (flight.visible === false) return; // already hidden from map

    const markerOpacity = active ? 1.0 : 0.4;
    const trailOpacity = active ? 0.9 : 0.3;
    const dotOpacity = active ? 0.7 : 0.2;
    const crossOpacity = active ? 0.6 : 0.25;

    if (flight.marker) flight.marker.setOpacity(markerOpacity);
    if (flight.trailLine) flight.trailLine.setStyle({ opacity: trailOpacity });
    if (flight.waypointMarkers) {
      for (const m of flight.waypointMarkers) {
        m.setStyle({ fillOpacity: dotOpacity });
      }
    }
    if (flight.crossingMarkers) {
      for (const m of flight.crossingMarkers) {
        m.setStyle({ fillOpacity: crossOpacity, opacity: crossOpacity });
      }
    }
  }

  function processFlights(aircraftList) {
    const now = Date.now();
    const currentIds = new Set();

    for (const ac of aircraftList) {
      // Skip aircraft without position data
      if (!ac.lat || !ac.lon || ac.lat === 0 || ac.lon === 0) continue;

      const id = ac.hex || ac.flight || `unknown-${Math.random()}`;
      currentIds.add(id);
      state.stats.totalSeen.add(id);

      const isOver = checkOverCemetery(ac.lat, ac.lon);

      if (state.flights.has(id)) {
        const flight = state.flights.get(id);
        if (flight.active === false) {
          flight.active = true;
          setFlightMapOpacity(flight, true);
        }
        updateExistingFlight(id, ac, isOver, now);
      } else {
        addNewFlight(id, ac, isOver, now);
      }
    }

    // Mark stale flights as inactive instead of removing them
    for (const [id, flight] of state.flights) {
      if (now - flight.lastSeen > CONFIG.STALE_FLIGHT_MS) {
        if (flight.active !== false) {
          flight.active = false;
          setFlightMapOpacity(flight, false);
        }
      }
    }

    updateStats();
    updateFlightListUI();
    updateAlertBanner();
    updateLiveFlightsTable();

    // Save history persistently
    saveStateToLocalStorage();
  }

  // =====================
  // Live Flights Table
  // =====================
  function updateLiveFlightsTable() {
    const tbody = document.getElementById('liveFlightsBody');
    if (!tbody) return;

    if (state.flights.size === 0) {
      tbody.innerHTML = `<tr class="results-row results-row--empty">
        <td colspan="6" class="results-cell results-cell--empty">אין טיסות באזור כרגע</td>
      </tr>`;
      return;
    }

    const now = Date.now();
    const rows = [...state.flights.entries()]
      .sort((a, b) => {
        // Sort: active flights over cemetery first, then active safe, then inactive
        const actA = a[1].active !== false;
        const actB = b[1].active !== false;
        if (actA && !actB) return -1;
        if (!actA && actB) return 1;

        if (a[1].isOver && !b[1].isOver) return -1;
        if (!a[1].isOver && b[1].isOver) return 1;
        return 0;
      })
      .map(([id, flight]) => {
        const ac = flight.data;
        const callsign = (ac.flight || ac.hex || id).trim() || '—';
        const airline = getAirlineFromCallsign(callsign, ac.airline || '');
        const flightTime = formatFlightDateTime(flight.firstSeen);
        
        let status = '';
        if (flight.active === false) {
          status = `<span style="color:var(--text-muted)">לא פעיל</span>`;
        } else if (flight.isOver) {
          status = `<span style="color:#f87171;font-weight:700">⚠️ מעל בית הקברות</span>`;
        } else {
          status = `<span style="color:#6ee7b7">✅ תקין</span>`;
        }
        
        const secsAgo = Math.round((now - flight.lastSeen) / 1000);
        const timeAgo = flight.active === false ? 'לא פעיל' : (secsAgo < 60 ? `לפני ${secsAgo}ש\'` : `לפני ${Math.round(secsAgo/60)}ד\'`);
        
        const rowClass = flight.isOver && flight.active !== false ? 'results-row--danger' : 'results-row--safe';
        const eyeClass = flight.visible === false ? 'muted' : '';

        return `<tr class="results-row ${rowClass}" onclick="window.__focusFlight('${id}')" style="cursor:pointer">
          <td class="results-cell" style="text-align: center;">
            <button class="btn-visibility-toggle ${eyeClass}" onclick="event.stopPropagation(); window.__toggleLiveFlightVisibility('${id}')">👁️</button>
          </td>
          <td class="results-cell results-cell--callsign">${escapeHtml(callsign)}</td>
          <td class="results-cell">${escapeHtml(airline)}</td>
          <td class="results-cell">${escapeHtml(flightTime)}</td>
          <td class="results-cell">${status}</td>
          <td class="results-cell" style="color:var(--text-muted);font-size:12px">${timeAgo}</td>
        </tr>`;
      });

    tbody.innerHTML = rows.join('');
  }

  function checkOverCemetery(lat, lon) {
    if (!state.cemeteries || state.cemeteries.length === 0) return false;
    const point = turf.point([lon, lat]);
    for (const cem of state.cemeteries) {
      if (turf.booleanPointInPolygon(point, cem.turfBuffered)) {
        return true;
      }
    }
    return false;
  }

  function checkSegmentCrossesCemetery(lat1, lon1, lat2, lon2) {
    if (!state.cemeteries || state.cemeteries.length === 0) return { crossed: false };
    try {
      const line = turf.lineString([[lon1, lat1], [lon2, lat2]]);
      for (const cem of state.cemeteries) {
        if (turf.booleanIntersects(line, cem.turfBuffered)) {
          // Find precise intersection point if possible
          let intersectPt = [lat2, lon2];
          try {
            const intersects = turf.lineIntersect(line, cem.turfBuffered);
            if (intersects.features.length > 0) {
              const coords = intersects.features[0].geometry.coordinates;
              intersectPt = [coords[1], coords[0]]; // [lat, lon]
            }
          } catch (err) {}
          return { crossed: true, cemetery: cem, intersectPt };
        }
      }
      return { crossed: false };
    } catch (e) {
      return { crossed: false };
    }
  }

  // Check if a flight trail intersects with the cemetery
  function checkTrailCrossesCemetery(trailPoints) {
    if (!state.cemeteries || state.cemeteries.length === 0 || trailPoints.length < 2) return false;
    try {
      const turfLine = turf.lineString(trailPoints.map(p => [p[1], p[0]])); // [lon, lat]
      for (const cem of state.cemeteries) {
        if (turf.booleanIntersects(turfLine, cem.turfBuffered)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // =====================
  // Flight CRUD
  // =====================
  function createAircraftIcon(heading, isOver) {
    // The unicode airplane emoji ✈️ naturally points northeast (45 degrees).
    // To make it face straight north (0 degrees) when heading is 0, we subtract 45 degrees.
    const rotation = ((heading || 0) - 45 + 360) % 360;
    const color = isOver ? '#ef4444' : '#60a5fa';
    const shadow = isOver
      ? 'drop-shadow(0 0 6px rgba(239,68,68,0.8)) drop-shadow(0 0 12px rgba(239,68,68,0.4))'
      : 'drop-shadow(0 0 4px rgba(96,165,250,0.5))';

    return L.divIcon({
      className: 'aircraft-marker' + (isOver ? ' aircraft-marker--over' : ''),
      html: `<div style="
        font-size: 22px;
        transform: rotate(${rotation}deg);
        filter: ${shadow};
        transition: transform 0.4s linear, filter 0.3s ease;
        line-height: 1;
        text-align: center;
      ">✈️</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  function createTakeoffIcon() {
    return L.divIcon({
      className: 'takeoff-marker-badge',
      html: `<div class="takeoff-marker-inner">🛫</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  function createLandingIcon() {
    return L.divIcon({
      className: 'landing-marker-badge',
      html: `<div class="landing-marker-inner">🛬</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  function addNewFlight(id, ac, isOver, now) {
    const callsign = (ac.flight || ac.hex || id || '').trim();
    const heading = ac.track || ac.true_heading || 0;

    // Create marker
    const marker = L.marker([ac.lat, ac.lon], {
      icon: createAircraftIcon(heading, isOver),
      zIndexOffset: isOver ? 1000 : 0,
    }).addTo(state.map);

    // Tooltip
    const altText = formatAltitude(ac.alt_baro);
    marker.bindTooltip(`${callsign} · ${altText}`, {
      className: 'aircraft-tooltip',
      direction: 'top',
      offset: [0, -14],
    });

    // Create trail line — bright cyan
    const trailLine = L.polyline([[ac.lat, ac.lon]], {
      color: '#00d4ff',
      weight: 3,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.5,
    }).addTo(state.map);

    const tooltipText = `✈️ ${callsign}${ac.alt_baro ? ` · ${altText}` : ''}`;
    trailLine.bindTooltip(tooltipText, { className: 'aircraft-tooltip', sticky: true });

    // Start marker (green takeoff HTML marker)
    const startMarker = L.marker([ac.lat, ac.lon], {
      icon: createTakeoffIcon(),
    }).addTo(state.map);
    startMarker.bindTooltip(`🛫 ${callsign} — המראה/זיהוי ראשון`, {
      className: 'aircraft-tooltip',
    });

    const flightData = {
      data: ac,
      marker,
      trailLine,
      trailPoints: [[ac.lat, ac.lon]],
      isOver,
      wasEverOver: isOver,
      lastSeen: now,
      firstSeen: now,
      startMarker,
      waypointMarkers: [],
      crossingMarkers: [],
      active: true,
      visible: true
    };

    // Add a crossing marker if we start inside the cemetery
    if (isOver) {
      const m = L.circleMarker([ac.lat, ac.lon], {
        radius: 8,
        color: '#ff0000',
        fillColor: '#ef4444',
        fillOpacity: 0.6,
        weight: 3,
        className: 'crossing-marker-pulse',
      }).addTo(state.map);
      m.bindTooltip(`⚠️ ${callsign} — חציית בית הקברות\n[${ac.lat.toFixed(4)}, ${ac.lon.toFixed(4)}]${ac.alt_baro ? `\nגובה: ${ac.alt_baro.toLocaleString()} ft` : ''}`, {
        className: 'aircraft-tooltip',
      });
      flightData.crossingMarkers.push(m);
    }

    state.flights.set(id, flightData);

    if (isOver) {
      recordCrossing(id, ac);
    }
  }

  function updateExistingFlight(id, ac, isOver, now) {
    const flight = state.flights.get(id);
    const heading = ac.track || ac.true_heading || 0;

    // Update marker position and icon
    flight.marker.setLatLng([ac.lat, ac.lon]);
    flight.marker.setIcon(createAircraftIcon(heading, isOver));
    flight.marker.setZIndexOffset(isOver ? 1000 : 0);

    // Update tooltip
    const callsign = (ac.flight || ac.hex || id || '').trim();
    const altText = formatAltitude(ac.alt_baro);
    flight.marker.setTooltipContent(`${callsign} · ${altText}`);

    // Segment check
    let segmentIntersects = false;
    let segmentCemetery = null;
    let intersectPt = [ac.lat, ac.lon];
    if (flight.trailPoints.length > 0) {
      const lastPt = flight.trailPoints[flight.trailPoints.length - 1];
      const res = checkSegmentCrossesCemetery(lastPt[0], lastPt[1], ac.lat, ac.lon);
      if (res.crossed) {
        segmentIntersects = true;
        segmentCemetery = res.cemetery;
        intersectPt = res.intersectPt;
      }
    }

    // Update trail
    flight.trailPoints.push([ac.lat, ac.lon]);
    if (flight.trailPoints.length > CONFIG.TRAIL_MAX_POINTS) {
      flight.trailPoints.shift();
    }
    flight.trailLine.setLatLngs(flight.trailPoints);

    // Update trail tooltip content
    const tooltipText = `✈️ ${callsign}${ac.alt_baro ? ` · ${altText}` : ''} · ${flight.trailPoints.length} נקודות`;
    flight.trailLine.setTooltipContent(tooltipText);

    // Update waypoint markers (recreate to match points)
    if (flight.waypointMarkers) {
      for (const m of flight.waypointMarkers) {
        state.map.removeLayer(m);
      }
    }
    flight.waypointMarkers = [];

    // Draw waypoint dots every 5th point
    const waypointInterval = 5;
    for (let i = 0; i < flight.trailPoints.length; i += waypointInterval) {
      const pt = flight.trailPoints[i];
      const dot = L.circleMarker(pt, {
        radius: 2.5,
        color: '#00d4ff',
        fillColor: '#00d4ff',
        fillOpacity: flight.active === false ? 0.2 : 0.7,
        weight: 0,
      });
      if (flight.visible !== false) {
        dot.addTo(state.map);
      }
      flight.waypointMarkers.push(dot);
    }

    // Add a crossing marker if the flight is currently crossing or segment crossed
    const crossedNow = isOver || segmentIntersects;
    if (crossedNow && !flight.wasEverOver) {
      flight.wasEverOver = true;
      recordCrossing(id, ac);
    }

    if (isOver) {
      const m = L.circleMarker([ac.lat, ac.lon], {
        radius: 8,
        color: '#ff0000',
        fillColor: '#ef4444',
        fillOpacity: flight.active === false ? 0.25 : 0.6,
        weight: 3,
        className: 'crossing-marker-pulse',
      });
      if (flight.visible !== false) {
        m.addTo(state.map);
      }
      m.bindTooltip(`⚠️ ${callsign} — חציית בית הקברות\n[${ac.lat.toFixed(4)}, ${ac.lon.toFixed(4)}]${ac.alt_baro ? `\nגובה: ${ac.alt_baro.toLocaleString()} ft` : ''}`, {
        className: 'aircraft-tooltip',
      });
      if (!flight.crossingMarkers) flight.crossingMarkers = [];
      flight.crossingMarkers.push(m);
    } else if (segmentIntersects) {
      const m = L.circleMarker(intersectPt, {
        radius: 8,
        color: '#ff8800',
        fillColor: '#f59e0b',
        fillOpacity: flight.active === false ? 0.25 : 0.6,
        weight: 3,
        className: 'crossing-marker-pulse',
      });
      if (flight.visible !== false) {
        m.addTo(state.map);
      }
      const cemName = segmentCemetery ? segmentCemetery.name : 'בית העלמין';
      m.bindTooltip(`⚠️ ${callsign} — כניסה למרחב אווירי: ${cemName}\n[${intersectPt[0].toFixed(4)}, ${intersectPt[1].toFixed(4)}]${ac.alt_baro ? `\nגובה: ${ac.alt_baro.toLocaleString()} ft` : ''}`, {
        className: 'aircraft-tooltip',
      });
      if (!flight.crossingMarkers) flight.crossingMarkers = [];
      flight.crossingMarkers.push(m);
    }

    flight.data = ac;
    flight.isOver = isOver;
    flight.lastSeen = now;
  }

  function recordCrossing(id, ac) {
    state.stats.totalCrossed.add(id);
    if (ac.alt_baro && typeof ac.alt_baro === 'number') {
      state.stats.crossingAltitudes.push(ac.alt_baro);
    }
    state.stats.crossedFlightDetails.push({
      id,
      callsign: (ac.flight || id).trim(),
      altitude: ac.alt_baro,
      type: ac.t || '',
      time: new Date().toLocaleTimeString('he-IL'),
      lat: ac.lat,
      lon: ac.lon,
    });
    updateHistoryPanel();
  }

  function removeFlight(id) {
    const flight = state.flights.get(id);
    if (!flight) return;

    state.map.removeLayer(flight.marker);
    state.map.removeLayer(flight.trailLine);
    if (flight.startMarker) state.map.removeLayer(flight.startMarker);
    if (flight.waypointMarkers) {
      for (const m of flight.waypointMarkers) {
        state.map.removeLayer(m);
      }
    }
    if (flight.crossingMarkers) {
      for (const m of flight.crossingMarkers) {
        state.map.removeLayer(m);
      }
    }
    state.flights.delete(id);
  }

  // =====================
  // Statistics Module
  // =====================
  function updateStats() {
    let currentOver = 0;
    let activeFlightsCount = 0;
    for (const [, flight] of state.flights) {
      if (flight.active !== false) {
        activeFlightsCount++;
        if (flight.isOver) currentOver++;
      }
    }
    state.stats.currentOverCount = currentOver;

    // Update DOM
    DOM.statActiveFlights.textContent = activeFlightsCount;
    DOM.statOverCemetery.textContent = currentOver;
    DOM.statTotalSeen.textContent = state.stats.totalSeen.size;
    DOM.statTotalCrossed.textContent = state.stats.totalCrossed.size;

    // Average altitude (element may have been removed from HTML)
    if (DOM.statAvgAltitude) {
      if (state.stats.crossingAltitudes.length > 0) {
        const avg = state.stats.crossingAltitudes.reduce((a, b) => a + b, 0) / state.stats.crossingAltitudes.length;
        DOM.statAvgAltitude.textContent = Math.round(avg).toLocaleString();
      } else {
        DOM.statAvgAltitude.textContent = '—';
      }
    }
  }

  // =====================
  // History Panel (crossed flights log)
  // =====================
  function updateHistoryPanel() {
    if (!DOM.historyList) return;

    const details = state.stats.crossedFlightDetails;
    if (details.length === 0) {
      DOM.historyList.innerHTML = `
        <div class="flight-list__empty">
          <div class="flight-list__empty-icon">✅</div>
          <div class="flight-list__empty-text">אין טיסות שעברו מעל בית הקברות</div>
        </div>
      `;
      return;
    }

    const html = details.slice().reverse().map(d => {
      const altStr = d.altitude
        ? (typeof d.altitude === 'number' ? `${d.altitude.toLocaleString()} ft` : d.altitude)
        : '—';
      return `
        <div class="flight-item flight-item--over">
          <div class="flight-item__status"></div>
          <div class="flight-item__info">
            <div class="flight-item__callsign">${escapeHtml(d.callsign)}</div>
            <div class="flight-item__detail">${escapeHtml(d.type)} · ${d.time}</div>
          </div>
          <div class="flight-item__altitude">${altStr}</div>
        </div>
      `;
    }).join('');

    DOM.historyList.innerHTML = html;
  }

  // =====================
  // FlightRadar24 Integration
  // =====================
  function openFr24Playback() {
    const [lat, lon] = CONFIG.CEMETERY_CENTER;
    const url = `https://www.flightradar24.com/${lat},${lon}/13`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('FR24 נפתח בחלון חדש', 'info');
  }

  // =====================
  // Data Import (CSV + JSON) — supports multiple files
  // =====================
  function handleMultipleFiles(files) {
    if (!files || files.length === 0) return;

    // Clear previous imported trails
    for (const layer of state.importedTrailLayers) {
      state.map.removeLayer(layer);
    }
    state.importedTrailLayers = [];

    // Reset import stats
    state.stats.totalSeen = new Set();
    state.stats.totalCrossed = new Set();
    state.stats.crossedFlightDetails = [];
    state.stats.crossingAltitudes = [];

    const fileArray = Array.from(files);
    let loadedCount = 0;
    const allRecords = [];       // accumulate records from ALL files
    const errorMessages = [];    // {file, msg}

    showToast(`טוען ${fileArray.length} קבצים...`, 'info');

    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = (event) => {
        loadedCount++;
        try {
          const records = parseFileContent(event.target.result, file.name);
          if (records && records.length > 0) {
            // Tag each record with source file name for reference
            for (const rec of records) {
              rec._sourceFile = file.name;
            }
            allRecords.push(...records);
          } else {
            errorMessages.push({ file: file.name, msg: 'לא נמצאו רשומות תקינות' });
          }
        } catch (err) {
          console.error(`Error parsing ${file.name}:`, err);
          errorMessages.push({ file: file.name, msg: err.message });
        }

        // ALL files loaded → process everything at once
        if (loadedCount === fileArray.length) {
          if (allRecords.length > 0) {
            processImportedRecords(allRecords);
          }
          showImportSummary(fileArray.length, allRecords.length, errorMessages);
        }
      };
      reader.onerror = () => {
        loadedCount++;
        errorMessages.push({ file: file.name, msg: 'שגיאה בקריאת הקובץ' });
        if (loadedCount === fileArray.length) {
          if (allRecords.length > 0) {
            processImportedRecords(allRecords);
          }
          showImportSummary(fileArray.length, allRecords.length, errorMessages);
        }
      };
      reader.readAsText(file);
    }
  }

  function showImportSummary(fileCount, totalRecords, errorMessages) {
    const crossedCount = state.stats.totalCrossed.size;
    const seenCount = state.stats.totalSeen.size;

    if (errorMessages.length > 0 && errorMessages.length === fileCount) {
      // All files failed — show error details
      const firstErr = errorMessages[0];
      showToast(`שגיאה: ${firstErr.msg}`, 'error');
    } else if (errorMessages.length > 0) {
      // Some files failed
      const okCount = fileCount - errorMessages.length;
      showToast(`${okCount}/${fileCount} קבצים נטענו | שגיאה: ${errorMessages[0].msg}`, 'warning');
    } else {
      showToast(`${fileCount} קבצים ✓ | ${totalRecords} רשומות | ${seenCount} טיסות | ${crossedCount} עברו מעל`, 'success');
    }
    updateStatusMessage(`ייבוא: ${totalRecords} רשומות, ${seenCount} טיסות, ${crossedCount} חצו בית קברות`);
  }

  function parseFileContent(text, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();

    // Strip BOM (byte order mark) — common in Excel-exported CSV files
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const trimmed = text.trim();

    // Detect format: CSV/TSV or JSON
    const isCsvExtension = ['csv', 'tsv', 'cvs'].includes(ext);
    const looksLikeJSON = trimmed.startsWith('{') || trimmed.startsWith('[');

    let records;
    if (isCsvExtension || (!looksLikeJSON && trimmed.includes(','))) {
      records = parseCSV(text);
    } else {
      records = parseJSON(text);
    }

    // Auto-detect and fix swapped lat/lon
    if (records && records.length > 0) {
      autoFixSwappedCoords(records);
    }

    return records;
  }

  // =====================
  // Auto-fix swapped lat/lon
  // =====================
  function autoFixSwappedCoords(records) {
    if (records.length === 0) return;

    const cLat = CONFIG.CEMETERY_CENTER[0]; // 31.998
    const cLon = CONFIG.CEMETERY_CENTER[1]; // 34.754

    // Sample up to 20 records spread across the dataset
    const step = Math.max(1, Math.floor(records.length / 20));
    const sample = [];
    for (let i = 0; i < records.length && sample.length < 20; i += step) {
      if (records[i].lat !== undefined && records[i].lon !== undefined) {
        sample.push(records[i]);
      }
    }

    if (sample.length === 0) return;

    // Calculate: which orientation puts any point closer to the cemetery?
    let minDistOriginal = Infinity;
    let minDistSwapped = Infinity;

    for (const rec of sample) {
      const distOrig = (rec.lat - cLat) ** 2 + (rec.lon - cLon) ** 2;
      const distSwap = (rec.lon - cLat) ** 2 + (rec.lat - cLon) ** 2;
      minDistOriginal = Math.min(minDistOriginal, distOrig);
      minDistSwapped = Math.min(minDistSwapped, distSwap);
    }

    // If the swapped orientation has a point MUCH closer to cemetery, swap all records
    if (minDistSwapped < minDistOriginal && minDistSwapped < 25) {
      // 25 = ~5 degrees radius → only swap if the swapped version is reasonably close
      console.log(`🔄 Detected swapped lat/lon — fixing. Original min dist: ${minDistOriginal.toFixed(2)}, Swapped min dist: ${minDistSwapped.toFixed(2)}`);
      for (const rec of records) {
        const tmp = rec.lat;
        rec.lat = rec.lon;
        rec.lon = tmp;
      }
      showToast('🔄 זוהו קואורדינטות הפוכות — תוקן אוטומטית', 'info');
    }
  }

  // =====================
  // CSV Parser
  // =====================
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('הקובץ ריק או מכיל רק שורה אחת');
    }

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t'
      : firstLine.includes(';') ? ';'
      : ',';

    // Parse header — strip BOM, quotes, whitespace
    const headers = lines[0].split(delimiter).map(h =>
      h.trim().replace(/^[\uFEFF"']|["']$/g, '').toLowerCase().replace(/\s+/g, '_')
    );

    // Map common column names
    const colMap = findColumnMapping(headers);

    // Check for combined "position" column (e.g., "32.003,34.874")
    let positionColIdx = undefined;
    let positionMode = false; // true = value is combined "lat,lon" in one field
    const posNames = ['position', 'pos', 'location', 'coordinates', 'coord', 'coords', 'latlng', 'latlon', 'geo'];
    for (const name of posNames) {
      const idx = headers.findIndex(h => h === name || h.includes(name));
      if (idx !== -1) {
        positionColIdx = idx;
        break;
      }
    }

    // If position column found and separate lat/lon not found
    if (positionColIdx !== undefined && (colMap.lat === undefined || colMap.lon === undefined)) {
      // Check first data row to determine if value is combined or split
      const testValues = parseCSVLine(lines[1], delimiter);
      const testVal = (testValues[positionColIdx] || '').trim();

      if (testVal.includes(',')) {
        // Case A: Value is combined in one field (quoted): "31.999,34.876"
        // parseFloat would only get the first number, so we need special per-row splitting
        positionMode = true;
        console.log(`📋 Found COMBINED position column at index ${positionColIdx}: "${testVal}"`);
      } else {
        // Case B: CSV delimiter already split it — position col has lat, next col has lon
        colMap.lat = positionColIdx;
        colMap.lon = positionColIdx + 1;
        console.log(`📋 Found SPLIT position column: lat=col ${positionColIdx}, lon=col ${positionColIdx + 1}`);
      }
    }

    // If still missing and no positionMode, try auto-detect
    if (!positionMode && (colMap.lat === undefined || colMap.lon === undefined)) {
      console.log('📋 Name matching incomplete — running auto-detect...');
      const autoDetected = autoDetectLatLon(lines, delimiter, headers);
      if (autoDetected) {
        if (colMap.lat === undefined) {
          colMap.lat = autoDetected.lat;
          console.log(`   Auto-filled lat → col ${autoDetected.lat}`);
        }
        if (colMap.lon === undefined) {
          if (autoDetected.lon !== colMap.lat) {
            colMap.lon = autoDetected.lon;
            console.log(`   Auto-filled lon → col ${autoDetected.lon}`);
          } else if (autoDetected.lat !== colMap.lat) {
            colMap.lon = autoDetected.lat;
            console.log(`   Auto-filled lon (swap) → col ${autoDetected.lat}`);
          }
        }
      }
    }

    // Final validation
    if (!positionMode && (colMap.lat === undefined || colMap.lon === undefined)) {
      throw new Error(
        'לא נמצאו עמודות lat/lon או position בקובץ.\n' +
        'עמודות שנמצאו: ' + headers.join(', ') + '\n' +
        'צריך: עמודות lat + lon, או עמודת position עם "lat,lon"'
      );
    }

    // Debug: show first data row
    if (lines.length >= 2) {
      const firstDataValues = parseCSVLine(lines[1], delimiter);
      console.log('📋 First data row raw values:', firstDataValues.join(' | '));
      if (positionMode) {
        const posVal = firstDataValues[positionColIdx];
        const parts = posVal.split(',');
        console.log(`   position (col ${positionColIdx}) = "${posVal}" → lat=${parts[0]}, lon=${parts[1]}`);
      } else {
        console.log(`   lat (col ${colMap.lat}) = "${firstDataValues[colMap.lat]}" → ${parseFloat(firstDataValues[colMap.lat])}`);
        console.log(`   lon (col ${colMap.lon}) = "${firstDataValues[colMap.lon]}" → ${parseFloat(firstDataValues[colMap.lon])}`);
      }
    }

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line, delimiter);

      let lat, lon;

      if (positionMode) {
        // Split "lat,lon" from combined position field
        const posVal = (values[positionColIdx] || '').trim();
        const parts = posVal.split(',');
        if (parts.length >= 2) {
          lat = parseFloat(parts[0].trim());
          lon = parseFloat(parts[1].trim());
        } else {
          continue;
        }
      } else {
        lat = parseFloat(values[colMap.lat]);
        lon = parseFloat(values[colMap.lon]);
      }

      // Validate coordinates
      if (isNaN(lat) || isNaN(lon)) continue;
      if (lat === 0 || lon === 0) continue;           // skip if EITHER is zero
      if (Math.abs(lat) < 0.01 || Math.abs(lon) < 0.01) continue; // skip near-zero
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

      // Outlier filter: skip points that jump more than 10° from the previous valid point
      if (records.length > 0) {
        const prev = records[records.length - 1];
        const dLat = Math.abs(lat - prev.lat);
        const dLon = Math.abs(lon - prev.lon);
        if (dLat > 10 || dLon > 10) {
          console.warn(`⚠️ Skipped outlier at row ${i}: [${lat}, ${lon}] — jump of [${dLat.toFixed(2)}°, ${dLon.toFixed(2)}°]`);
          continue;
        }
      }

      const record = { lat, lon };

      if (colMap.alt !== undefined) {
        const alt = parseFloat(values[colMap.alt]);
        if (!isNaN(alt)) record.altitude = alt;
      }
      if (colMap.callsign !== undefined) {
        record.callsign = (values[colMap.callsign] || '').trim();
      }
      if (colMap.flight !== undefined) {
        record.flight = (values[colMap.flight] || '').trim();
      }
      if (colMap.type !== undefined) {
        record.type = (values[colMap.type] || '').trim();
      }
      if (colMap.time !== undefined) {
        record.time = (values[colMap.time] || '').trim();
      }
      if (colMap.airline !== undefined) {
        record.airline = (values[colMap.airline] || '').trim();
      }
      if (colMap.destination !== undefined) {
        record.destination = (values[colMap.destination] || '').trim();
      }
      if (colMap.origin !== undefined) {
        record.origin = (values[colMap.origin] || '').trim();
      }
      if (colMap.hex !== undefined) {
        record.hex = (values[colMap.hex] || '').trim();
      }
      if (colMap.heading !== undefined) {
        const h = parseFloat(values[colMap.heading]);
        if (!isNaN(h)) record.heading = h;
      }
      if (colMap.speed !== undefined) {
        const s = parseFloat(values[colMap.speed]);
        if (!isNaN(s)) record.speed = s;
      }

      records.push(record);
    }

    if (records.length === 0) {
      throw new Error(`הקובץ נקרא (${lines.length - 1} שורות) אבל לא נמצאו קואורדינטות תקינות`);
    }

    return records;
  }

  function parseCSVLine(line, delimiter) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
  }

  function findColumnMapping(headers) {
    const map = {};
    const usedIndices = new Set(); // prevent same column being used twice

    const patterns = {
      lat: ['lat', 'latitude', 'y', 'lat_deg', 'position_lat', 'lat_dd', 'enlem', 'breitengrad', 'קו_רוחב', 'רוחב', 'latitude_deg', 'lat_deg'],
      lon: ['lon', 'lng', 'longitude', 'x', 'lon_deg', 'long', 'position_lon', 'position_lng', 'lon_dd', 'boylam', 'קו_אורך', 'אורך', 'longitude_deg', 'lon_deg'],
      alt: ['alt', 'altitude', 'alt_baro', 'alt_geom', 'elevation', 'height', 'alt_ft', 'altitude_ft', 'geoaltitude', 'baroaltitude', 'גובה', 'גובה_ברגל'],
      callsign: ['callsign', 'call_sign', 'call', 'cs', 'flight_callsign', 'אות_קריאה', 'אותקריאה'],
      flight: ['flight', 'flight_number', 'flightnumber', 'flight_id', 'flt', 'flight_no', 'flightno', 'מספר_טיסה', 'טיסה'],
      type: ['type', 'aircraft_type', 'actype', 'typecode', 'aircraft', 'plane_type', 'model', 'סוג', 'דגם', 'סוג_מטוס'],
      hex: ['hex', 'icao', 'icao24', 'icao_address', 'mode_s', 'addr', 'מפתח', 'קוד_icao'],
      time: ['time', 'timestamp', 'datetime', 'date', 'utc', 'ts', 'snapshot_id', 'lastcontact', 'last_contact', 'זמן', 'שעה', 'תאריך'],
      heading: ['heading', 'track', 'direction', 'hdg', 'true_heading', 'true_track', 'כיוון', 'נתיב'],
      speed: ['speed', 'gs', 'ground_speed', 'groundspeed', 'spd', 'velocity', 'מהירות', 'מהירות_קרקע'],
      airline: ['airline', 'operator', 'carrier', 'company', 'air_carrier', 'op', 'חברת_תעופה', 'חברה', 'מפעיל'],
      destination: ['to', 'destination', 'dest', 'varis', 'יעד', 'שדה_יעד', 'שדה_תעופה_יעד'],
      origin: ['from', 'origin', 'orig', 'kalkis', 'מוצא', 'שדה_מוצא', 'שדה_תעופה_מוצא'],
    };

    console.log('📋 CSV Headers:', headers.join(' | '));

    // Pass 1: exact match only
    for (const [key, names] of Object.entries(patterns)) {
      const idx = headers.findIndex((h, i) => !usedIndices.has(i) && names.includes(h));
      if (idx !== -1) {
        map[key] = idx;
        usedIndices.add(idx);
      }
    }

    // Pass 2: partial match — header CONTAINS one of the pattern names (at least 3 chars)
    for (const [key, names] of Object.entries(patterns)) {
      if (map[key] !== undefined) continue; // already found
      const idx = headers.findIndex((h, i) => {
        if (usedIndices.has(i)) return false;
        return names.some(name => name.length >= 3 && h.includes(name));
      });
      if (idx !== -1) {
        map[key] = idx;
        usedIndices.add(idx);
      }
    }

    console.log('📋 Column mapping:', JSON.stringify(map));
    if (map.lat !== undefined) console.log(`   lat → column ${map.lat} ("${headers[map.lat]}")`);
    if (map.lon !== undefined) console.log(`   lon → column ${map.lon} ("${headers[map.lon]}")`);

    // Safety check: lat and lon must be DIFFERENT columns
    if (map.lat !== undefined && map.lon !== undefined && map.lat === map.lon) {
      console.error('❌ BUG: lat and lon mapped to the SAME column! Clearing lon.');
      delete map.lon;
    }

    return map;
  }

  // Auto-detect lat/lon columns by analyzing the data values
  function autoDetectLatLon(lines, delimiter, headers) {
    if (lines.length < 2) return null;

    const sampleSize = Math.min(10, lines.length - 1);
    const colCount = headers.length;

    // Gather stats for each column
    const colStats = Array.from({ length: colCount }, () => ({
      allNumeric: true,
      values: [],
    }));

    for (let i = 1; i <= sampleSize; i++) {
      if (i >= lines.length) break;
      const values = parseCSVLine(lines[i], delimiter);
      for (let col = 0; col < colCount && col < values.length; col++) {
        const num = parseFloat(values[col]);
        if (isNaN(num)) {
          colStats[col].allNumeric = false;
        } else {
          colStats[col].values.push(num);
        }
      }
    }

    // Find candidate columns: numeric, values in -90..90 range (both lat and lon for Israel)
    const candidates = [];
    for (let col = 0; col < colCount; col++) {
      const s = colStats[col];
      if (!s.allNumeric || s.values.length === 0) continue;

      const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      const min = Math.min(...s.values);
      const max = Math.max(...s.values);

      // Skip if values look like timestamps (> 1000), IDs, or out of coordinate range
      if (avg > 180 || avg < -180) continue;
      if (min < -180 || max > 180) continue;

      // Must have some variation (not all the same value like a constant column)
      const range = max - min;

      candidates.push({ col, avg, min, max, range, header: headers[col] });
    }

    console.log('📋 Auto-detect candidates:', candidates.map(c =>
      `col ${c.col} ("${c.header}"): avg=${c.avg.toFixed(2)}, range=${c.range.toFixed(4)}`
    ).join(' | '));

    if (candidates.length < 2) return null;

    // Use cemetery center to determine which column is lat vs lon
    const cLat = CONFIG.CEMETERY_CENTER[0]; // ~32
    const cLon = CONFIG.CEMETERY_CENTER[1]; // ~34.75

    // For each pair of candidate columns, check which assignment puts values closer to cemetery
    let bestPair = null;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];

        // Try a=lat, b=lon
        const score1 = (a.avg - cLat) ** 2 + (b.avg - cLon) ** 2;
        // Try a=lon, b=lat
        const score2 = (a.avg - cLon) ** 2 + (b.avg - cLat) ** 2;

        if (score1 < bestScore) {
          bestScore = score1;
          bestPair = { lat: a.col, lon: b.col };
        }
        if (score2 < bestScore) {
          bestScore = score2;
          bestPair = { lat: b.col, lon: a.col };
        }
      }
    }

    if (bestPair) {
      console.log(`📋 Auto-detect result: lat=col ${bestPair.lat} ("${headers[bestPair.lat]}"), lon=col ${bestPair.lon} ("${headers[bestPair.lon]}")`);
    }
    return bestPair;
  }

  // =====================
  // JSON Parser
  // =====================
  function parseJSON(text) {
    const data = JSON.parse(text);

    // Array of flight objects
    if (Array.isArray(data)) {
      return data;
    }

    // adsb.lol / airplanes.live format: { ac: [...] }
    if (data.ac && Array.isArray(data.ac)) {
      return data.ac;
    }

    // { flights: [...] }
    if (data.flights && Array.isArray(data.flights)) {
      return data.flights;
    }

    // { data: [...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

    // Single object with lat/lon
    if (data.lat && data.lon) {
      return [data];
    }

    throw new Error('פורמט JSON לא מוכר');
  }

  // =====================
  // Flight Visibility Toggle
  // =====================
  function toggleFlightVisibility(id) {
    const flight = state.flights.get(id);
    if (!flight) return;

    flight.visible = (flight.visible !== false) ? false : true;

    const layers = [
      flight.marker,
      flight.trailLine,
      flight.startMarker,
      ...(flight.waypointMarkers || []),
      ...(flight.crossingMarkers || [])
    ].filter(Boolean);

    for (const layer of layers) {
      if (flight.visible) {
        if (!state.map.hasLayer(layer)) {
          state.map.addLayer(layer);
        }
        if (layer === flight.trailLine) {
          layer.setStyle({ opacity: flight.active === false ? 0.3 : 0.9 });
        } else if (layer === flight.marker) {
          layer.setOpacity(flight.active === false ? 0.4 : 1.0);
        }
      } else {
        if (state.map.hasLayer(layer)) {
          state.map.removeLayer(layer);
        }
      }
    }

    updateFlightListUI();
    updateLiveFlightsTable();
  }

  function toggleImportedFlightVisibility(id) {
    const flight = state.importedFlights.get(id);
    if (!flight) return;

    flight.visible = (flight.visible !== false) ? false : true;

    for (const layer of flight.layers) {
      if (flight.visible) {
        if (!state.map.hasLayer(layer)) {
          state.map.addLayer(layer);
        }
      } else {
        if (state.map.hasLayer(layer)) {
          state.map.removeLayer(layer);
        }
      }
    }

    // Refresh results table to reflect eye icon change
    buildResultsTable([...state.importedFlights.values()].map(f => ({
      id: f.id,
      callsign: f.callsign,
      airline: getAirlineFromCallsign(f.callsign, f.data.airlines[0] || ''),
      pointCount: f.data.points.length,
      takeoffTime: f.data.times.length > 0 ? f.data.times[0] : '—',
      crossingTime: f.data.crossingTime || null,
      destination: f.data.destination,
      crossed: f.data.crossed,
      crossingCount: f.data.crossingCount || 0,
      visible: f.visible,
    })));
  }

  // =====================
  // Process Imported Records
  // =====================
  function processImportedRecords(records) {
    // Clear previous imported layers and map representations
    for (const f of state.importedFlights.values()) {
      for (const layer of f.layers) {
        state.map.removeLayer(layer);
      }
    }
    state.importedFlights.clear();

    const groups = new Map();
    let unnamedCounter = 0;

    for (const rec of records) {
      const flightName = rec.callsign || rec.flight || rec.hex || '';
      let id;

      if (flightName) {
        const fileKey = rec._sourceFile || '';
        id = `${fileKey}::${flightName}`;
      } else {
        const fileKey = rec._sourceFile || `unnamed-${++unnamedCounter}`;
        id = fileKey;
      }
      if (!groups.has(id)) {
        const displayName = flightName || rec._sourceFile || `טיסה ${groups.size + 1}`;
        groups.set(id, {
          id,
          callsign: displayName,
          type: rec.type || '',
          points: [],
          altitudes: [],
          times: [],
          airlines: [],
          destinations: [],
        });
      }
      const group = groups.get(id);
      group.points.push([rec.lat, rec.lon]);
      if (rec.altitude) group.altitudes.push(rec.altitude);
      if (rec.time) group.times.push(rec.time);
      if (rec.airline) group.airlines.push(rec.airline);
      if (rec.destination) group.destinations.push(rec.destination);
    }

    const flightResults = []; // one entry per flight for the table

    for (const [id, group] of groups) {
      state.stats.totalSeen.add(id);

      // --- Cemetery check ---
      let crossedCemetery = false;
      const crossingPoints = [];
      let crossingTime = null;

      for (let idx = 0; idx < group.points.length; idx++) {
        const [lat, lon] = group.points[idx];
        if (checkOverCemetery(lat, lon)) {
          crossedCemetery = true;
          crossingPoints.push([lat, lon]);
          if (!crossingTime && group.times.length > idx) {
            crossingTime = group.times[idx];
          }
        }
      }

      if (!crossedCemetery && group.points.length >= 2) {
        crossedCemetery = checkTrailCrossesCemetery(group.points);
      }

      const avgAlt = group.altitudes.length > 0
        ? Math.round(group.altitudes.reduce((a, b) => a + b, 0) / group.altitudes.length)
        : null;

      const layers = [];

      // ============================
      // 1. FLIGHT PATH — bright cyan
      // ============================
      const flightLine = L.polyline(group.points, {
        color: '#00d4ff',
        weight: 3,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(state.map);

      const tooltipText = `✈️ ${group.callsign}${avgAlt ? ` · ${avgAlt.toLocaleString()} ft` : ''} · ${group.points.length} נקודות`;
      flightLine.bindTooltip(tooltipText, { className: 'aircraft-tooltip', sticky: true });
      layers.push(flightLine);

      // ============================
      // 2. WAYPOINT DOTS along the path
      // ============================
      const waypointInterval = Math.max(1, Math.floor(group.points.length / 15));
      for (let i = 0; i < group.points.length; i += waypointInterval) {
        const pt = group.points[i];
        const dot = L.circleMarker(pt, {
          radius: 2.5,
          color: '#00d4ff',
          fillColor: '#00d4ff',
          fillOpacity: 0.7,
          weight: 0,
        }).addTo(state.map);
        layers.push(dot);
      }

      // ============================
      // 3. START marker (green takeoff HTML marker)
      // ============================
      if (group.points.length > 0) {
        const startPt = group.points[0];
        const startMarker = L.marker(startPt, {
          icon: createTakeoffIcon(),
        }).addTo(state.map);
        startMarker.bindTooltip(`🛫 ${group.callsign} — המראה\n[${startPt[0].toFixed(4)}, ${startPt[1].toFixed(4)}]`, {
          className: 'aircraft-tooltip', permanent: false,
        });
        layers.push(startMarker);
      }

      // ============================
      // 4. END marker (blue landing)
      // ============================
      if (group.points.length > 1) {
        const endPt = group.points[group.points.length - 1];
        const endMarker = L.marker(endPt, {
          icon: createLandingIcon(),
        }).addTo(state.map);
        endMarker.bindTooltip(`🛬 ${group.callsign} — נחיתה\n[${endPt[0].toFixed(4)}, ${endPt[1].toFixed(4)}]`, {
          className: 'aircraft-tooltip', permanent: false,
        });
        layers.push(endMarker);
      }

      // ============================
      // 5. CROSSING MARKERS — red pulsing dots
      // ============================
      for (const [lat, lon] of crossingPoints) {
        const m = L.circleMarker([lat, lon], {
          radius: 10, color: '#ff0000', fillColor: '#ef4444', fillOpacity: 0.6, weight: 3,
          className: 'crossing-marker-pulse',
        }).addTo(state.map);
        m.bindTooltip(`⚠️ ${group.callsign} — חציית בית הקברות\n[${lat.toFixed(4)}, ${lon.toFixed(4)}]${avgAlt ? `\nגובה: ${avgAlt.toLocaleString()} ft` : ''}`, {
          className: 'aircraft-tooltip',
        });
        layers.push(m);
      }

      // Stats
      if (crossedCemetery) {
        state.stats.totalCrossed.add(id);
        if (group.altitudes.length > 0) {
          state.stats.crossingAltitudes.push(...group.altitudes);
        }
        state.stats.crossedFlightDetails.push({
          id, callsign: group.callsign, altitude: avgAlt || '—',
          type: group.type,
          time: crossingTime ? formatUserFriendlyTime(crossingTime) : (group.times.length > 0 ? formatUserFriendlyTime(group.times[0]) : 'נתון מיובא'),
          lat: group.points[0][0], lon: group.points[0][1],
        });
      }

      const lastPoint = group.points[group.points.length - 1];
      const calculatedDest = findClosestAirport(lastPoint[0], lastPoint[1]);
      group.destination = calculatedDest;
      group.crossingCount = crossingPoints.length;
      group.crossed = crossedCemetery;
      group.crossingTime = crossingTime;

      // Save imported flight state
      state.importedFlights.set(id, {
        id,
        callsign: group.callsign,
        visible: true,
        layers,
        data: group
      });

      flightResults.push({
        id,
        callsign: group.callsign,
        airline: getAirlineFromCallsign(group.callsign, group.airlines[0] || ''),
        pointCount: group.points.length,
        takeoffTime: group.times.length > 0 ? group.times[0] : '—',
        crossingTime: crossingTime || null,
        destination: calculatedDest,
        crossed: crossedCemetery,
        crossingCount: crossingPoints.length,
        visible: true,
      });
    }

    state.map.setView([32.05, 34.88], 12);

    updateStats();
    updateHistoryPanel();
    updateFlightListUI();

    buildResultsTable(flightResults);
  }

  // =====================
  // Results Table (one row per flight)
  // =====================
  function buildResultsTable(data) {
    const panel = DOM.unifiedPanel;
    const tbody = document.getElementById('resultsBody');
    const summaryEl = document.getElementById('resultsSummary');
    if (!panel || !tbody) return;

    // Sort: crossed flights first, then by callsign
    data.sort((a, b) => {
      if (a.crossed && !b.crossed) return -1;
      if (!a.crossed && b.crossed) return 1;
      return a.callsign.localeCompare(b.callsign);
    });

    const totalFlights = data.length;
    const crossedFlights = data.filter(d => d.crossed).length;
    const safeFlights = totalFlights - crossedFlights;

    // Summary badges
    if (summaryEl) {
      summaryEl.innerHTML = `
        <span class="results-summary__item results-summary__item--total">
          ✈️ ${totalFlights} טיסות
        </span>
        <span class="results-summary__item results-summary__item--danger">
          🔴 ${crossedFlights} עברו מעל
        </span>
        <span class="results-summary__item results-summary__item--safe">
          ✅ ${safeFlights} תקין
        </span>
      `;
    }

    // Table rows — one per flight
    tbody.innerHTML = data.map((row, i) => {
      const statusClass = row.crossed ? 'results-row--danger' : 'results-row--safe';
      const eyeClass = row.visible === false ? 'muted' : '';
      const formattedTime = (row.takeoffTime && row.takeoffTime !== '—') ? formatUserFriendlyTime(row.takeoffTime) : '—';
      const statusText = row.crossed
        ? `<span style="color:#f87171;font-weight:700">⚠️ מעבר מעל בית עלמין</span>`
        : `<span style="color:#6ee7b7">✅ תקין</span>`;

      return `
        <tr class="results-row ${statusClass}" onclick="window.__focusImportedFlight('${row.id}')" style="cursor:pointer">
          <td class="results-cell results-cell--num">${i + 1}</td>
          <td class="results-cell" style="text-align: center;">
            <button class="btn-visibility-toggle ${eyeClass}" onclick="event.stopPropagation(); window.__toggleImportedFlightVisibility('${row.id}')">👁️</button>
          </td>
          <td class="results-cell results-cell--callsign">${escapeHtml(row.callsign)}</td>
          <td class="results-cell">${escapeHtml(row.airline)}</td>
          <td class="results-cell results-cell--points">${row.pointCount}</td>
          <td class="results-cell results-cell--takeoff">${escapeHtml(formattedTime)}</td>
          <td class="results-cell results-cell--destination">${escapeHtml(row.destination || '—')}</td>
          <td class="results-cell results-cell--status">${statusText}</td>
        </tr>
      `;
    }).join('');

    // Show panel and select imported results tab
    state.activeTab = 'imported';
    state.panelState = 'expanded';
    updatePanelUI();
  }

  // =====================
  // UI Module
  // =====================
  function updateFlightListUI() {
    const container = DOM.flightList;
    
    // Count active flights only
    let activeFlightsCount = 0;
    for (const [, flight] of state.flights) {
      if (flight.active !== false) activeFlightsCount++;
    }
    DOM.flightCount.textContent = activeFlightsCount;

    if (state.flights.size === 0) {
      container.innerHTML = `
        <div class="flight-list__empty">
          <div class="flight-list__empty-icon">🔍</div>
          <div class="flight-list__empty-text">
            ${state.connectionStatus === 'error'
              ? 'בעיית חיבור — מנסה שוב...'
              : 'מחפש טיסות באזור...'}
          </div>
        </div>
      `;
      return;
    }

    // Sort: active flights over cemetery first, then active safe, then inactive
    const sorted = [...state.flights.entries()].sort((a, b) => {
      const actA = a[1].active !== false;
      const actB = b[1].active !== false;
      if (actA && !actB) return -1;
      if (!actA && actB) return 1;

      if (a[1].isOver && !b[1].isOver) return -1;
      if (!a[1].isOver && b[1].isOver) return 1;

      const callA = (a[1].data.flight || a[0]).trim();
      const callB = (b[1].data.flight || b[0]).trim();
      return callA.localeCompare(callB);
    });

    // Build HTML
    const html = sorted.map(([id, flight]) => {
      const ac = flight.data;
      const callsign = (ac.flight || id).trim();
      const airline = getAirlineFromCallsign(callsign, ac.airline || '');
      const flightTime = formatFlightDateTime(flight.firstSeen);

      let detail = airline;
      if (flight.active === false) {
        detail += ' · לא פעיל';
      }

      const overClass = flight.isOver && flight.active !== false ? ' flight-item--over' : '';
      const eyeClass = flight.visible === false ? 'muted' : '';
      
      let statusStyle = '';
      if (flight.active === false) {
        statusStyle = 'background: var(--text-muted); box-shadow: none;';
      }

      return `
        <div class="flight-item${overClass}" data-id="${id}" onclick="window.__focusFlight('${id}')" style="${flight.active === false ? 'opacity: 0.65;' : ''}">
          <div class="flight-item__status" style="${statusStyle}"></div>
          <div class="flight-item__info">
            <div class="flight-item__callsign">${escapeHtml(callsign)}</div>
            <div class="flight-item__detail">${escapeHtml(detail)}</div>
          </div>
          <div class="flight-item__altitude" style="font-size: 11px; align-self: center; margin-left: 8px;">
            ${flightTime}
          </div>
          <button class="btn-visibility-toggle ${eyeClass}" onclick="event.stopPropagation(); window.__toggleLiveFlightVisibility('${id}')" style="margin-right: auto; margin-left: 4px;">👁️</button>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function updateAlertBanner() {
    const overCount = state.stats.currentOverCount;
    if (overCount > 0) {
      DOM.alertBanner.classList.add('visible');
      DOM.alertCount.textContent = overCount;
      DOM.alertText.textContent = overCount === 1
        ? '⚠️ טיסה עוברת מעל בית הקברות!'
        : `⚠️ ${overCount} טיסות עוברות מעל בית הקברות!`;
    } else {
      DOM.alertBanner.classList.remove('visible');
    }
  }

  // =====================
  // Event Listeners
  // =====================
  function setupEventListeners() {
    // Toggle tracking
    DOM.btnToggleTracking.addEventListener('click', () => {
      state.isTracking = !state.isTracking;

      if (state.isTracking) {
        DOM.liveBadge.classList.remove('paused');
        DOM.liveBadgeText.textContent = 'LIVE';
        DOM.btnToggleTracking.textContent = '⏸';
        startTracking();
      } else {
        DOM.liveBadge.classList.add('paused');
        DOM.liveBadgeText.textContent = 'PAUSED';
        DOM.btnToggleTracking.textContent = '▶️';
        stopTracking();
      }
    });

    // Toggle sidebar (desktop)
    DOM.btnToggleSidebar.addEventListener('click', () => {
      if (window.innerWidth > 640) {
        const isHidden = DOM.sidebar.style.display === 'none';
        DOM.sidebar.style.display = isHidden ? '' : 'none';
      } else {
        DOM.sidebar.classList.toggle('open');
      }
    });

    // Sidebar toggle (mobile)
    DOM.sidebarToggle.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('open');
    });

    // Close sidebar on map click (mobile)
    state.map.on('click', () => {
      if (window.innerWidth <= 640) {
        DOM.sidebar.classList.remove('open');
      }
    });

    // Open FR24
    if (DOM.btnOpenFr24) {
      DOM.btnOpenFr24.addEventListener('click', openFr24Playback);
    }

    // Import data
    if (DOM.btnImportData) {
      DOM.btnImportData.addEventListener('click', () => {
        DOM.importFileInput.click();
      });
    }

    // Export data
    if (DOM.btnExportData) {
      DOM.btnExportData.addEventListener('click', exportCollectedData);
    }

    // Clear history
    if (DOM.btnClearHistory) {
      DOM.btnClearHistory.addEventListener('click', clearCollectedData);
    }

    if (DOM.importFileInput) {
      DOM.importFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        handleMultipleFiles(files);
        e.target.value = ''; // reset for next import
      });
    }

    // Toggle live table from header (✈️ button)
    if (DOM.btnToggleLiveTable) {
      DOM.btnToggleLiveTable.addEventListener('click', () => {
        if (state.panelState === 'hidden') {
          state.panelState = 'expanded';
          state.activeTab = 'live';
        } else if (state.activeTab === 'live') {
          state.panelState = state.panelState === 'expanded' ? 'hidden' : 'expanded';
        } else {
          state.activeTab = 'live';
          state.panelState = 'expanded';
        }
        updatePanelUI();
      });
    }

    // Toggle imported table from header (📋 button)
    if (DOM.btnToggleTable) {
      DOM.btnToggleTable.addEventListener('click', () => {
        if (state.panelState === 'hidden') {
          state.panelState = 'expanded';
          state.activeTab = 'imported';
        } else if (state.activeTab === 'imported') {
          state.panelState = state.panelState === 'expanded' ? 'hidden' : 'expanded';
        } else {
          state.activeTab = 'imported';
          state.panelState = 'expanded';
        }
        updatePanelUI();
      });
    }

    // Direct tab clicking inside the panel
    if (DOM.tabLiveFlights) {
      DOM.tabLiveFlights.addEventListener('click', () => {
        state.activeTab = 'live';
        state.panelState = 'expanded';
        updatePanelUI();
      });
    }

    if (DOM.tabImportedResults) {
      DOM.tabImportedResults.addEventListener('click', () => {
        state.activeTab = 'imported';
        state.panelState = 'expanded';
        updatePanelUI();
      });
    }

    // Panel collapse/expand (▼/▲ button)
    if (DOM.panelCollapse) {
      DOM.panelCollapse.addEventListener('click', () => {
        state.panelState = state.panelState === 'collapsed' ? 'expanded' : 'collapsed';
        updatePanelUI();
      });
    }

    // Panel close (✕ button)
    if (DOM.panelClose) {
      DOM.panelClose.addEventListener('click', () => {
        state.panelState = 'hidden';
        updatePanelUI();
      });
    }
  }

  // =====================
  // Focus flight on map
  // =====================
  window.__focusFlight = function (id) {
    const flight = state.flights.get(id);
    if (!flight) return;
    state.map.flyTo([flight.data.lat, flight.data.lon], 14, {
      duration: 0.8,
    });
    if (flight.visible !== false) {
      flight.marker.openTooltip();
    }
  };

  window.__focusImportedFlight = function (id) {
    const flight = state.importedFlights.get(id);
    if (!flight || !flight.data || flight.data.points.length === 0) return;
    const pt = flight.data.points[0];
    state.map.flyTo([pt[0], pt[1]], 13, { duration: 0.8 });
  };

  window.__toggleLiveFlightVisibility = toggleFlightVisibility;
  window.__toggleImportedFlightVisibility = toggleImportedFlightVisibility;

  // =====================
  // Utilities
  // =====================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatAltitude(alt) {
    if (!alt) return '—';
    if (typeof alt === 'number') return `${alt.toLocaleString()} ft`;
    if (alt === 'ground') return 'קרקע';
    return String(alt);
  }

  function formatFlightDateTime(ts) {
    if (!ts) return '—';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return String(ts);
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${hrs}:${mins} (${day}/${month})`;
  }

  function formatUserFriendlyTime(timeStr) {
    if (!timeStr) return '—';
    const trimmed = String(timeStr).trim();
    if (!trimmed) return '—';

    // 1. Check if it's a Unix timestamp (all digits, length 10 or 13)
    if (/^\d+$/.test(trimmed)) {
      const val = parseInt(trimmed, 10);
      // If in seconds (e.g. 10 digits), multiply by 1000
      const ms = val < 10000000000 ? val * 1000 : val;
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ')';
      }
    }

    // 2. Try parsing as a Date string
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      // Return beautiful Hebrew formatted date and time
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ')';
    }

    // 3. Fallback: if it's already a time string, return it
    return trimmed;
  }

  function getAirlineFromCallsign(callsign, csvAirline = '') {
    if (csvAirline) return csvAirline;
    if (!callsign) return '—';
    const clean = callsign.trim().toUpperCase();
    
    // Check known prefixes (ICAO / IATA)
    if (clean.startsWith('ELY') || clean.startsWith('LY')) return 'אל על (El Al)';
    if (clean.startsWith('AIZ') || clean.startsWith('IZ')) return 'ארקיע (Arkia)';
    if (clean.startsWith('ISR') || clean.startsWith('6H')) return 'ישראייר (Israir)';
    if (clean.startsWith('RJA') || clean.startsWith('RJ')) return 'רויאל ג\'ורדניאן';
    if (clean.startsWith('THY') || clean.startsWith('TK')) return 'טורקיש איירליינס';
    if (clean.startsWith('WZZ') || clean.startsWith('W6')) return 'וויז אייר';
    if (clean.startsWith('WMT') || clean.startsWith('W4')) return 'וויז אייר מלטה';
    if (clean.startsWith('RYR') || clean.startsWith('FR')) return 'ראינאייר';
    if (clean.startsWith('UAE') || clean.startsWith('EK')) return 'אמירטס';
    if (clean.startsWith('FDB') || clean.startsWith('FZ')) return 'פליי דובאי';
    if (clean.startsWith('DLH') || clean.startsWith('LH')) return 'לופטהנזה';
    if (clean.startsWith('AFR') || clean.startsWith('AF')) return 'אייר פראנס';
    if (clean.startsWith('BAW') || clean.startsWith('BA')) return 'בריטיש איירווייז';
    if (clean.startsWith('PGT') || clean.startsWith('PC')) return 'פגסוס';
    if (clean.startsWith('ETH') || clean.startsWith('ET')) return 'אתיופיאן איירליינס';
    if (clean.startsWith('MSR') || clean.startsWith('MS')) return 'איג\'יפטאייר';
    if (clean.startsWith('BRU') || clean.startsWith('SN')) return 'בריסל איירליינס';
    if (clean.startsWith('SWR') || clean.startsWith('LX')) return 'סוויס';
    if (clean.startsWith('AUA') || clean.startsWith('OS')) return 'אוסטריאן';
    if (clean.startsWith('AEE') || clean.startsWith('A3')) return 'אג\'יאן';
    
    // Generic fallback or try to strip numbers to see if there's a 3-letter ICAO code
    const icao = clean.replace(/[0-9]/g, '');
    if (icao.length >= 2) return `${icao}`;
    return '—';
  }

  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function findClosestAirport(lat, lon) {
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return '—';
    
    // Major airports database (common origins/destinations from Ben Gurion)
    const AIRPORTS = [
      { name: 'נתב"ג', city: 'תל אביב', code: 'TLV', coords: [32.0116, 34.8867] },
      { name: 'רמון', city: 'אילת', code: 'ETM', coords: [29.726, 34.966] },
      { name: 'פרנץ ליסט', city: 'בודפשט', code: 'BUD', coords: [47.43, 19.26] },
      { name: 'לרנקה', city: 'קפריסין', code: 'LCA', coords: [34.87, 33.62] },
      { name: 'פאפוס', city: 'קפריסין', code: 'PFO', coords: [34.71, 32.48] },
      { name: 'אלפתריוס וניזלוס', city: 'אתונה', code: 'ATH', coords: [37.93, 23.94] },
      { name: 'דיאגורס', city: 'רודוס', code: 'RHO', coords: [36.40, 28.08] },
      { name: 'ניקוס קאזאנצאקיס', city: 'כרתים', code: 'HER', coords: [35.33, 25.18] },
      { name: 'שארל דה גול', city: 'פריז', code: 'CDG', coords: [49.0097, 2.5479] },
      { name: 'אורלי', city: 'פריז', code: 'ORY', coords: [48.7262, 2.3652] },
      { name: 'הית\'רו', city: 'לונדון', code: 'LHR', coords: [51.4700, -0.4543] },
      { name: 'לוטון', city: 'לונדון', code: 'LTN', coords: [51.8747, -0.3683] },
      { name: 'גטוויק', city: 'לונדון', code: 'LGW', coords: [51.1481, -0.1903] },
      { name: 'סטנסטד', city: 'לונדון', code: 'STN', coords: [51.885, 0.235] },
      { name: 'פרנקפורט', city: 'גרמניה', code: 'FRA', coords: [50.0379, 8.5622] },
      { name: 'מינכן', city: 'גרמניה', code: 'MUC', coords: [48.3538, 11.7861] },
      { name: 'ברנדנבורג', city: 'ברלין', code: 'BER', coords: [52.3667, 13.5033] },
      { name: 'שווכאט', city: 'וינה', code: 'VIE', coords: [48.1103, 16.5697] },
      { name: 'קלוטן', city: 'ציריך', code: 'ZRH', coords: [47.4582, 8.5671] },
      { name: 'קוונטרן', city: 'ז\'נבה', code: 'GVA', coords: [46.2381, 6.0989] },
      { name: 'סכיפהול', city: 'אמסטרדם', code: 'AMS', coords: [52.3081, 4.7642] },
      { name: 'בריסל', city: 'בלגיה', code: 'BRU', coords: [50.9014, 4.4844] },
      { name: 'פיומיצ\'ינו', city: 'רומא', code: 'FCO', coords: [41.8003, 12.2389] },
      { name: 'מלפנסה', city: 'מילאנו', code: 'MXP', coords: [45.6300, 8.7231] },
      { name: 'מרקו פולו', city: 'ונציה', code: 'VCE', coords: [45.5053, 12.3519] },
      { name: 'בראחס', city: 'מדריד', code: 'MAD', coords: [40.4719, -3.5626] },
      { name: 'אל פראט', city: 'ברצלונה', code: 'BCN', coords: [41.2971, 2.0784] },
      { name: 'ואצלב האבל', city: 'פראג', code: 'PRG', coords: [50.1008, 14.26] },
      { name: 'שופן', city: 'ורשה', code: 'WAW', coords: [52.1672, 20.9678] },
      { name: 'אוטופני', city: 'בוקרשט', code: 'OTP', coords: [44.5722, 26.1022] },
      { name: 'סופיה', city: 'בולגריה', code: 'SOF', coords: [42.6953, 23.4028] },
      { name: 'טביליסי', city: 'גאורגיה', code: 'TBS', coords: [41.6692, 44.9547] },
      { name: 'היידר אלייב', city: 'באקו', code: 'GYD', coords: [40.4675, 50.0467] },
      { name: 'דובאי', city: 'איחוד האמירויות', code: 'DXB', coords: [25.2536, 55.3644] },
      { name: 'אבו דאבי', city: 'איחוד האמירויות', code: 'AUH', coords: [24.4330, 54.6511] },
      { name: 'ג\'ון פ. קנדי', city: 'ניו יורק', code: 'JFK', coords: [40.6398, -73.7789] },
      { name: 'ניוארק', city: 'ניו ג\'רזי', code: 'EWR', coords: [40.6925, -74.1686] },
      { name: 'לוגן', city: 'בוסטון', code: 'BOS', coords: [42.3643, -71.0051] },
      { name: 'מיאמי', city: 'פלורידה', code: 'MIA', coords: [25.7933, -80.2906] },
      { name: 'סוברנבהומי', city: 'בנגקוק', code: 'BKK', coords: [13.6811, 100.7472] },
      { name: 'פוקט', city: 'תאילנד', code: 'HKT', coords: [8.1132, 98.3169] },
      { name: 'סיישל', city: 'סיישל', code: 'SEZ', coords: [-4.6794, 55.5219] },
      { name: 'קהיר', city: 'מצרים', code: 'CAI', coords: [30.1219, 31.4056] },
      { name: 'המלכה עליה', city: 'עמאן', code: 'AMM', coords: [31.7225, 35.9933] },
      { name: 'שרמטייבו', city: 'מוסקבה', code: 'SVO', coords: [55.9725, 37.4147] },
      { name: 'דומודדובו', city: 'מוסקבה', code: 'DME', coords: [55.4086, 37.9061] },
      { name: 'איסטנבול', city: 'טורקיה', code: 'IST', coords: [41.2753, 28.7519] },
      { name: 'סביהה גקצ\'ן', city: 'איסטנבול', code: 'SAW', coords: [40.8986, 29.3092] },
      { name: 'אנטליה', city: 'טורקיה', code: 'AYT', coords: [36.9003, 30.8006] },
    ];

    let closest = null;
    let minDistance = Infinity;

    for (const ap of AIRPORTS) {
      const dist = calculateDistanceKm(lat, lon, ap.coords[0], ap.coords[1]);
      if (dist < minDistance) {
        minDistance = dist;
        closest = ap;
      }
    }

    // If the closest airport is within 250 km, assume that is the destination
    if (closest && minDistance < 250) {
      return `${closest.name}, ${closest.city} (${closest.code})`;
    }

    // Fallback: format coordinates cleanly
    return `[${lat.toFixed(3)}, ${lon.toFixed(3)}]`;
  }

  // =====================
  // Persistence & Data Storage
  // =====================
  function saveStateToLocalStorage() {
    try {
      const flightsArray = [];
      for (const [id, f] of state.flights.entries()) {
        flightsArray.push({
          id,
          data: f.data,
          trailPoints: f.trailPoints,
          isOver: f.isOver,
          wasEverOver: f.wasEverOver,
          lastSeen: f.lastSeen,
          firstSeen: f.firstSeen,
          active: f.active,
          visible: f.visible
        });
      }

      const cacheData = {
        flights: flightsArray,
        totalSeen: Array.from(state.stats.totalSeen),
        totalCrossed: Array.from(state.stats.totalCrossed),
        crossingAltitudes: state.stats.crossingAltitudes,
        crossedFlightDetails: state.stats.crossedFlightDetails
      };

      localStorage.setItem('tumat_kohanim_flight_cache', JSON.stringify(cacheData));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  function loadStateFromLocalStorage() {
    try {
      const cached = localStorage.getItem('tumat_kohanim_flight_cache');
      if (!cached) return;

      const cacheData = JSON.parse(cached);

      // Restore stats
      state.stats.totalSeen = new Set(cacheData.totalSeen || []);
      state.stats.totalCrossed = new Set(cacheData.totalCrossed || []);
      state.stats.crossingAltitudes = cacheData.crossingAltitudes || [];
      state.stats.crossedFlightDetails = cacheData.crossedFlightDetails || [];

      // Update stats UI
      updateStats();
      updateHistoryPanel();

      // Restore flights Map and recreate map layers
      if (Array.isArray(cacheData.flights)) {
        for (const f of cacheData.flights) {
          const ac = f.data;
          const id = f.id;
          const callsign = (ac.flight || ac.hex || id || '').trim();
          const heading = ac.track || ac.true_heading || 0;

          // Recreate marker
          const marker = L.marker([ac.lat, ac.lon], {
            icon: createAircraftIcon(heading, f.isOver),
            zIndexOffset: f.isOver ? 1000 : 0,
          });
          if (f.visible !== false) marker.addTo(state.map);

          const altText = formatAltitude(ac.alt_baro);
          marker.bindTooltip(`${callsign} · ${altText}`, {
            className: 'aircraft-tooltip',
            direction: 'top',
            offset: [0, -14],
          });

          // Recreate trailLine
          const trailLine = L.polyline(f.trailPoints, {
            color: '#00d4ff',
            weight: 3,
            opacity: f.active === false ? 0.3 : 0.9,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.5,
          });
          if (f.visible !== false) trailLine.addTo(state.map);

          const tooltipText = `✈️ ${callsign}${ac.alt_baro ? ` · ${altText}` : ''} · ${f.trailPoints.length} נקודות`;
          trailLine.bindTooltip(tooltipText, { className: 'aircraft-tooltip', sticky: true });

          // Recreate startMarker
          const startPt = f.trailPoints[0];
          const startMarker = L.marker(startPt, {
            icon: createTakeoffIcon(),
          });
          if (f.visible !== false) startMarker.addTo(state.map);
          startMarker.bindTooltip(`🛫 ${callsign} — המראה/זיהוי ראשון`, {
            className: 'aircraft-tooltip',
          });

          // Recreate waypoint markers
          const waypointMarkers = [];
          const waypointInterval = 5;
          for (let i = 0; i < f.trailPoints.length; i += waypointInterval) {
            const pt = f.trailPoints[i];
            const dot = L.circleMarker(pt, {
              radius: 2.5,
              color: '#00d4ff',
              fillColor: '#00d4ff',
              fillOpacity: f.active === false ? 0.2 : 0.7,
              weight: 0,
            });
            if (f.visible !== false) dot.addTo(state.map);
            waypointMarkers.push(dot);
          }

          // Recreate crossing markers
          const crossingMarkers = [];
          for (let i = 0; i < f.trailPoints.length; i++) {
            const pt = f.trailPoints[i];
            const isPtOver = checkOverCemetery(pt[0], pt[1]);
            
            // Or if segment crossed
            let isSegOver = false;
            let intersectPt = pt;
            if (i > 0) {
              const lastPt = f.trailPoints[i-1];
              const segRes = checkSegmentCrossesCemetery(lastPt[0], lastPt[1], pt[0], pt[1]);
              if (segRes.crossed) {
                isSegOver = true;
                intersectPt = segRes.intersectPt;
              }
            }

            if (isPtOver) {
              const m = L.circleMarker(pt, {
                radius: 8,
                color: '#ff0000',
                fillColor: '#ef4444',
                fillOpacity: f.active === false ? 0.25 : 0.6,
                weight: 3,
                className: 'crossing-marker-pulse',
              });
              if (f.visible !== false) m.addTo(state.map);
              m.bindTooltip(`⚠️ ${callsign} — חציית בית הקברות\n[${pt[0].toFixed(4)}, ${pt[1].toFixed(4)}]`, {
                className: 'aircraft-tooltip',
              });
              crossingMarkers.push(m);
            } else if (isSegOver) {
              const m = L.circleMarker(intersectPt, {
                radius: 8,
                color: '#ff8800',
                fillColor: '#f59e0b',
                fillOpacity: f.active === false ? 0.25 : 0.6,
                weight: 3,
                className: 'crossing-marker-pulse',
              });
              if (f.visible !== false) m.addTo(state.map);
              m.bindTooltip(`⚠️ ${callsign} — כניסה למרחב אווירי\n[${intersectPt[0].toFixed(4)}, ${intersectPt[1].toFixed(4)}]`, {
                className: 'aircraft-tooltip',
              });
              crossingMarkers.push(m);
            }
          }

          state.flights.set(id, {
            data: ac,
            marker,
            trailLine,
            trailPoints: f.trailPoints,
            isOver: f.isOver,
            wasEverOver: f.wasEverOver,
            lastSeen: f.lastSeen,
            firstSeen: f.firstSeen,
            startMarker,
            waypointMarkers,
            crossingMarkers,
            active: f.active,
            visible: f.visible
          });
        }

        // Refresh UI
        updateFlightListUI();
        updateLiveFlightsTable();
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
  }

  function exportCollectedData() {
    try {
      const csvRows = [];
      // CSV Headers in Hebrew
      csvRows.push([
        'מזהה טיסה',
        'מספר טיסה (אות קריאה)',
        'חברת תעופה',
        'זמן זיהוי ראשון',
        'זמן זיהוי אחרון',
        'מספר נקודות מסלול',
        'עבר מעל בית עלמין',
        'מספר חציות שזוהו',
        'גובה אחרון (רגל)',
        'סוג מטוס'
      ].join(','));

      for (const [id, f] of state.flights.entries()) {
        const callsign = (f.data.flight || f.data.hex || id || '').trim();
        const airline = getAirlineFromCallsign(f.data.flight, f.data.airline || '');
        const firstSeen = formatFlightDateTime(f.firstSeen);
        const lastSeen = formatFlightDateTime(f.lastSeen);
        const pointCount = f.trailPoints.length;
        const crossed = f.wasEverOver ? 'כן' : 'לא';
        const crossingCount = f.crossingMarkers ? f.crossingMarkers.length : 0;
        const altitude = f.data.alt_baro || '—';
        const type = f.data.t || '—';

        const row = [
          `"${id.replace(/"/g, '""')}"`,
          `"${callsign.replace(/"/g, '""')}"`,
          `"${airline.replace(/"/g, '""')}"`,
          `"${firstSeen.replace(/"/g, '""')}"`,
          `"${lastSeen.replace(/"/g, '""')}"`,
          pointCount,
          `"${crossed}"`,
          crossingCount,
          `"${altitude}"`,
          `"${type.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      }

      const csvString = '\uFEFF' + csvRows.join('\n'); // Add UTF-8 BOM for Excel Hebrew support
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tumat_kohanim_tracking_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('נתוני המעקב יוצאו בהצלחה כקובץ CSV ✓', 'success');
    } catch (err) {
      console.error(err);
      showToast('ייצוא הנתונים כקובץ CSV נכשל', 'error');
    }
  }

  function clearCollectedData() {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל היסטוריית הטיסות והנתונים שנאספו? פעולה זו לא ניתנת לביטול.')) {
      for (const f of state.flights.values()) {
        state.map.removeLayer(f.marker);
        state.map.removeLayer(f.trailLine);
        if (f.startMarker) state.map.removeLayer(f.startMarker);
        if (f.waypointMarkers) {
          for (const m of f.waypointMarkers) state.map.removeLayer(m);
        }
        if (f.crossingMarkers) {
          for (const m of f.crossingMarkers) state.map.removeLayer(m);
        }
      }

      state.flights.clear();
      state.stats.totalSeen.clear();
      state.stats.totalCrossed.clear();
      state.stats.crossingAltitudes = [];
      state.stats.crossedFlightDetails = [];

      localStorage.removeItem('tumat_kohanim_flight_cache');

      updateStats();
      updateHistoryPanel();
      updateFlightListUI();
      updateLiveFlightsTable();

      showToast('כל הנתונים וההיסטוריה אופסו בהצלחה ✓', 'success');
    }
  }

  window.__toggleAllLiveFlightsVisibility = function () {
    const liveFlights = [...state.flights.values()];
    if (liveFlights.length === 0) return;

    const anyVisible = liveFlights.some(f => f.visible !== false);
    const newTarget = !anyVisible;

    for (const flight of liveFlights) {
      if (flight.visible !== newTarget) {
        flight.visible = newTarget;
        const layers = [
          flight.marker,
          flight.trailLine,
          flight.startMarker,
          ...(flight.waypointMarkers || []),
          ...(flight.crossingMarkers || [])
        ].filter(Boolean);

        for (const layer of layers) {
          if (newTarget) {
            if (!state.map.hasLayer(layer)) state.map.addLayer(layer);
            if (layer === flight.trailLine) {
              layer.setStyle({ opacity: flight.active === false ? 0.3 : 0.9 });
            } else if (layer === flight.marker) {
              layer.setOpacity(flight.active === false ? 0.4 : 1.0);
            }
          } else {
            if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
          }
        }
      }
    }

    updateFlightListUI();
    updateLiveFlightsTable();
  };

  window.__toggleAllImportedFlightsVisibility = function () {
    const importedFlights = [...state.importedFlights.values()];
    if (importedFlights.length === 0) return;

    const anyVisible = importedFlights.some(f => f.visible !== false);
    const newTarget = !anyVisible;

    for (const flight of importedFlights) {
      if (flight.visible !== newTarget) {
        flight.visible = newTarget;
        for (const layer of flight.layers) {
          if (newTarget) {
            if (!state.map.hasLayer(layer)) state.map.addLayer(layer);
          } else {
            if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
          }
        }
      }
    }

    buildResultsTable(importedFlights.map(f => ({
      id: f.id,
      callsign: f.callsign,
      airline: getAirlineFromCallsign(f.callsign, f.data.airlines[0] || ''),
      pointCount: f.data.points.length,
      takeoffTime: f.data.times.length > 0 ? f.data.times[0] : '—',
      crossingTime: f.data.crossingTime || null,
      destination: f.data.destination,
      crossed: f.data.crossed,
      crossingCount: f.data.crossingCount || 0,
      visible: f.visible,
    })));
  };

  // =====================
  // Bootstrap
  // =====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
