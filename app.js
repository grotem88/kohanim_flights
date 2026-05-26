/* ===================================
   טומאת כהנים בטיסות — App Logic
   =================================== */

(function () {
  'use strict';

  // =====================
  // Configuration
  // =====================
  const CONFIG = {
    CEMETERY_CENTER: [31.998, 34.754],
    CEMETERY_OSM_WAY_ID: 55212020,

    // Flight data APIs (airplanes.live has proper CORS support!)
    FLIGHT_APIS: [
      'https://api.airplanes.live/v2/point/{lat}/{lon}/{dist}',
      'https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{dist}',
    ],

    POLL_INTERVAL_MS: 5000,
    SEARCH_RADIUS_NM: 15,       // nautical miles (~28 km)
    TRAIL_MAX_POINTS: 80,
    BUFFER_METERS: 50,          // buffer around cemetery polygon
    MAP_DEFAULT_ZOOM: 13,
    STALE_FLIGHT_MS: 60000,     // remove flights not seen for 60s
    API_TIMEOUT_MS: 8000,       // timeout for API requests


    // Accurate cemetery polygon from OSM way 55212020 (32 nodes)
    // Embedded directly so it always loads, even if Overpass is down
    CEMETERY_POLYGON: [
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
      [32.0012488, 34.7587825],
    ],
  };

  // =====================
  // State
  // =====================
  const state = {
    map: null,
    cemeteryLayer: null,
    cemeteryBufferLayer: null,
    cemeteryTurfPolygon: null,
    cemeteryTurfBuffered: null,

    flights: new Map(),          // id -> { data, marker, trailLine, trailPoints, isOver, lastSeen }
    historicalFlights: [],       // flights from FR24 playback
    isTracking: true,
    pollTimer: null,
    currentApiIndex: 0,
    dataSource: '',
    lastFetchError: null,
    fetchSuccessCount: 0,
    connectionStatus: 'connecting', // 'connecting' | 'connected' | 'error'
    importedTrailLayers: [],     // track imported trail layers

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
    DOM.statAvgAltitude = document.getElementById('statAvgAltitude');
    DOM.dataSourceLabel = document.getElementById('dataSourceLabel');
    DOM.statusMessage = document.getElementById('statusMessage');
    DOM.btnOpenFr24 = document.getElementById('btnOpenFr24');
    DOM.btnImportData = document.getElementById('btnImportData');
    DOM.importFileInput = document.getElementById('importFileInput');
    DOM.historyPanel = document.getElementById('historyPanel');
    DOM.historyList = document.getElementById('historyList');
  }

  // =====================
  // Initialization
  // =====================
  async function init() {
    cacheDom();
    initMap();
    setupEventListeners();

    updateStatusMessage('טוען מפת בית הקברות...');

    // Use embedded accurate polygon (always available)
    drawCemetery(CONFIG.CEMETERY_POLYGON);
    updateStatusMessage('מפת בית הקברות נטענה ✓');

    // Optionally try to upgrade from OSM API for the latest data
    tryUpgradeCemeteryFromOSM();

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

  // Try to upgrade the polygon from OSM API (non-blocking)
  async function tryUpgradeCemeteryFromOSM() {
    try {
      const url = `https://api.openstreetmap.org/api/0.6/way/${CONFIG.CEMETERY_OSM_WAY_ID}/full.json`;
      const response = await fetch(url);
      if (!response.ok) return;

      const data = await response.json();
      const nodesMap = {};
      for (const el of data.elements) {
        if (el.type === 'node') nodesMap[el.id] = [el.lat, el.lon];
      }
      const way = data.elements.find(el => el.type === 'way');
      if (!way) return;

      const orderedCoords = way.nodes.map(nid => nodesMap[nid]).filter(Boolean);
      if (orderedCoords.length > 10) {
        // Remove old layers and redraw with updated data
        if (state.cemeteryLayer) state.map.removeLayer(state.cemeteryLayer);
        if (state.cemeteryBufferLayer) state.map.removeLayer(state.cemeteryBufferLayer);
        drawCemetery(orderedCoords);
        console.log('Cemetery polygon upgraded from OSM API');
      }
    } catch (e) {
      // Silently fail — the embedded polygon is already drawn
      console.log('OSM API upgrade skipped:', e.message);
    }
  }

  function drawCemetery(leafletCoords) {
    // Draw main polygon
    state.cemeteryLayer = L.polygon(leafletCoords, {
      color: '#9333ea',
      fillColor: '#7c3aed',
      fillOpacity: 0.22,
      weight: 2.5,
      dashArray: '6 4',
      className: 'cemetery-polygon',
    }).addTo(state.map);

    state.cemeteryLayer.bindPopup(`
      <div class="cemetery-popup">
        <h3>🪦 בית העלמין דרום — חולון</h3>
        <p>שטח: ~800 דונם</p>
        <p>טומאה בוקעת ועולה — ללא הגבלת גובה</p>
      </div>
    `);

    // Build Turf polygon for intersection calculations
    const turfCoords = leafletCoords.map(p => [p[1], p[0]]);  // [lon, lat]
    // Ensure ring is closed
    if (turfCoords.length > 0) {
      const first = turfCoords[0];
      const last = turfCoords[turfCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        turfCoords.push([...first]);
      }
    }

    state.cemeteryTurfPolygon = turf.polygon([turfCoords]);

    // Create buffered polygon
    state.cemeteryTurfBuffered = turf.buffer(
      state.cemeteryTurfPolygon,
      CONFIG.BUFFER_METERS / 1000,
      { units: 'kilometers' }
    );

    // Draw buffer zone
    const bufferGeoJSON = state.cemeteryTurfBuffered;
    state.cemeteryBufferLayer = L.geoJSON(bufferGeoJSON, {
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
    const center = turf.center(state.cemeteryTurfPolygon);
    const [lon, lat] = center.geometry.coordinates;
    L.marker([lat, lon], {
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
        ">🪦 בית הקברות חולון</div>`,
        iconSize: [140, 20],
        iconAnchor: [70, 10],
      }),
      interactive: false,
    }).addTo(state.map);
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

    // Try each API in order, starting from the last one that worked
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
        const aircraftList = data.ac || [];

        // Extract source name from URL
        const sourceName = url.includes('airplanes.live') ? 'airplanes.live'
          : url.includes('adsb.lol') ? 'adsb.lol' : 'API';

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

        // Show first-connect toast
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
    updateStatusMessage('שגיאה בחיבור — מנסה שוב...');
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
        updateExistingFlight(id, ac, isOver, now);
      } else {
        addNewFlight(id, ac, isOver, now);
      }
    }

    // Remove stale flights
    for (const [id, flight] of state.flights) {
      if (now - flight.lastSeen > CONFIG.STALE_FLIGHT_MS) {
        removeFlight(id);
      }
    }

    updateStats();
    updateFlightListUI();
    updateAlertBanner();
  }

  function checkOverCemetery(lat, lon) {
    if (!state.cemeteryTurfBuffered) return false;
    const point = turf.point([lon, lat]);
    return turf.booleanPointInPolygon(point, state.cemeteryTurfBuffered);
  }

  // Check if a flight trail intersects with the cemetery
  function checkTrailCrossesCemetery(trailPoints) {
    if (!state.cemeteryTurfBuffered || trailPoints.length < 2) return false;
    try {
      const turfLine = turf.lineString(trailPoints.map(p => [p[1], p[0]])); // [lon, lat]
      const intersects = turf.booleanIntersects(turfLine, state.cemeteryTurfBuffered);
      return intersects;
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

    // Create trail line — bright cyan, weight 3, round joins (just like imported files!)
    const trailLine = L.polyline([[ac.lat, ac.lon]], {
      color: '#00d4ff',       // bright cyan
      weight: 3,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.5,
    }).addTo(state.map);

    const tooltipText = `✈️ ${callsign}${ac.alt_baro ? ` · ${altText}` : ''}`;
    trailLine.bindTooltip(tooltipText, { className: 'aircraft-tooltip', sticky: true });

    // Start marker (green takeoff circle marker)
    const startMarker = L.circleMarker([ac.lat, ac.lon], {
      radius: 6,
      color: '#ffffff',
      fillColor: '#10b981',
      fillOpacity: 1,
      weight: 2,
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
      startMarker,
      waypointMarkers: [],
      crossingMarkers: [],
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
        fillOpacity: 0.7,
        weight: 0,
      }).addTo(state.map);
      flight.waypointMarkers.push(dot);
    }

    // Add a crossing marker if the flight is currently crossing
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
      if (!flight.crossingMarkers) flight.crossingMarkers = [];
      flight.crossingMarkers.push(m);
    }

    // Track crossing
    if (isOver && !flight.wasEverOver) {
      flight.wasEverOver = true;
      recordCrossing(id, ac);
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
    for (const [, flight] of state.flights) {
      if (flight.isOver) currentOver++;
    }
    state.stats.currentOverCount = currentOver;

    // Update DOM
    DOM.statActiveFlights.textContent = state.flights.size;
    DOM.statOverCemetery.textContent = currentOver;
    DOM.statTotalSeen.textContent = state.stats.totalSeen.size;
    DOM.statTotalCrossed.textContent = state.stats.totalCrossed.size;

    // Average altitude
    if (state.stats.crossingAltitudes.length > 0) {
      const avg = state.stats.crossingAltitudes.reduce((a, b) => a + b, 0) / state.stats.crossingAltitudes.length;
      DOM.statAvgAltitude.textContent = Math.round(avg).toLocaleString();
    } else {
      DOM.statAvgAltitude.textContent = '—';
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
      lat: ['lat', 'latitude', 'y', 'lat_deg', 'position_lat', 'lat_dd', 'enlem', 'breitengrad'],
      lon: ['lon', 'lng', 'longitude', 'x', 'lon_deg', 'long', 'position_lon', 'position_lng', 'lon_dd', 'boylam'],
      alt: ['alt', 'altitude', 'alt_baro', 'alt_geom', 'elevation', 'height', 'alt_ft', 'altitude_ft', 'geoaltitude', 'baroaltitude'],
      callsign: ['callsign', 'call_sign', 'call', 'cs', 'flight_callsign'],
      flight: ['flight', 'flight_number', 'flightnumber', 'flight_id', 'flt', 'flight_no', 'flightno'],
      type: ['type', 'aircraft_type', 'actype', 'typecode', 'aircraft', 'plane_type', 'model'],
      hex: ['hex', 'icao', 'icao24', 'icao_address', 'mode_s', 'addr'],
      time: ['time', 'timestamp', 'datetime', 'date', 'utc', 'ts', 'snapshot_id', 'lastcontact', 'last_contact'],
      heading: ['heading', 'track', 'direction', 'hdg', 'true_heading', 'true_track'],
      speed: ['speed', 'gs', 'ground_speed', 'groundspeed', 'spd', 'velocity'],
      airline: ['airline', 'operator', 'carrier', 'company', 'air_carrier', 'op', 'חברת_תעופה', 'חברה'],
      destination: ['to', 'destination', 'dest', 'varis', 'יעד', 'שדה_יעד'],
      origin: ['from', 'origin', 'orig', 'kalkis', 'מוצא', 'שדה_מוצא'],
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
  // Process Imported Records
  // =====================
  function processImportedRecords(records) {
    // Group by callsign/flight/hex for map trails AND table
    // Include source file in the key so same-named flights from different files stay separate
    const groups = new Map();
    let unnamedCounter = 0;

    for (const rec of records) {
      const flightName = rec.callsign || rec.flight || rec.hex || '';
      let id;

      if (flightName) {
        // Use file+callsign as key so same callsign in different files = same flight
        const fileKey = rec._sourceFile || '';
        id = `${fileKey}::${flightName}`;
      } else {
        // No callsign — each record from a different file is a separate "flight"
        // Group by source file if available
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

    // --- Draw map visuals per group ---
    for (const [id, group] of groups) {
      state.stats.totalSeen.add(id);

      // Debug: log coordinates for verification
      if (group.points.length > 0) {
        const first = group.points[0];
        const last = group.points[group.points.length - 1];
        console.log(`✈️ ${group.callsign}: ${group.points.length} points | Start: [${first[0].toFixed(4)}, ${first[1].toFixed(4)}] | End: [${last[0].toFixed(4)}, ${last[1].toFixed(4)}]`);
      }

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

      // ============================
      // 1. FLIGHT PATH — always drawn clean and visible
      // ============================
      const flightLine = L.polyline(group.points, {
        color: '#00d4ff',       // bright cyan — always the same
        weight: 3,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(state.map);

      const tooltipText = `✈️ ${group.callsign}${avgAlt ? ` · ${avgAlt.toLocaleString()} ft` : ''} · ${group.points.length} נקודות`;
      flightLine.bindTooltip(tooltipText, { className: 'aircraft-tooltip', sticky: true });
      state.importedTrailLayers.push(flightLine);

      // ============================
      // 2. WAYPOINT DOTS along the path (every few points)
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
        state.importedTrailLayers.push(dot);
      }

      // ============================
      // 3. START marker (green ✈ takeoff)
      // ============================
      if (group.points.length > 0) {
        const startPt = group.points[0];
        const startMarker = L.circleMarker(startPt, {
          radius: 8, color: '#ffffff', fillColor: '#10b981', fillOpacity: 1, weight: 2,
        }).addTo(state.map);
        startMarker.bindTooltip(`🛫 ${group.callsign} — המראה\n[${startPt[0].toFixed(4)}, ${startPt[1].toFixed(4)}]`, {
          className: 'aircraft-tooltip', permanent: false,
        });
        state.importedTrailLayers.push(startMarker);
      }

      // ============================
      // 4. END marker (blue ✈ landing)
      // ============================
      if (group.points.length > 1) {
        const endPt = group.points[group.points.length - 1];
        const endMarker = L.circleMarker(endPt, {
          radius: 8, color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2,
        }).addTo(state.map);
        endMarker.bindTooltip(`🛬 ${group.callsign} — נחיתה\n[${endPt[0].toFixed(4)}, ${endPt[1].toFixed(4)}]`, {
          className: 'aircraft-tooltip', permanent: false,
        });
        state.importedTrailLayers.push(endMarker);
      }

      // ============================
      // 5. CROSSING MARKERS — red pulsing dots where flight crosses cemetery
      // ============================
      for (const [lat, lon] of crossingPoints) {
        const m = L.circleMarker([lat, lon], {
          radius: 10, color: '#ff0000', fillColor: '#ef4444', fillOpacity: 0.6, weight: 3,
          className: 'crossing-marker-pulse',
        }).addTo(state.map);
        m.bindTooltip(`⚠️ ${group.callsign} — חציית בית הקברות\n[${lat.toFixed(4)}, ${lon.toFixed(4)}]${avgAlt ? `\nגובה: ${avgAlt.toLocaleString()} ft` : ''}`, {
          className: 'aircraft-tooltip',
        });
        state.importedTrailLayers.push(m);
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

      // --- One table row per flight ---
      const lastPoint = group.points[group.points.length - 1];
      const calculatedDest = findClosestAirport(lastPoint[0], lastPoint[1]);

      flightResults.push({
        callsign: group.callsign,
        airline: getAirlineFromCallsign(group.callsign, group.airlines[0] || ''),
        pointCount: group.points.length,
        takeoffTime: group.times.length > 0 ? group.times[0] : '—',
        crossingTime: crossingTime || null,
        destination: calculatedDest,
        crossed: crossedCemetery,
        crossingCount: crossingPoints.length,
      });
    }

    // Center and focus the map slightly south of the Holon Cemetery so that the cemetery itself
    // is shifted upwards on the screen and is not covered by the bottom results table.
    state.map.setView([31.983, 34.754], 13);

    updateStats();
    updateHistoryPanel();
    updateFlightListUI();

    // Show results table — one row per flight
    buildResultsTable(flightResults);
  }

  // =====================
  // Results Table (one row per flight)
  // =====================
  function buildResultsTable(data) {
    const panel = document.getElementById('resultsPanel');
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

    // Update table header
    const thead = panel.querySelector('thead tr');
    if (thead) {
      thead.innerHTML = `
        <th class="results-th">#</th>
        <th class="results-th">מספר טיסה</th>
        <th class="results-th">חברת הטיסה</th>
        <th class="results-th">מספר נקודות</th>
        <th class="results-th">שעת המראה</th>
        <th class="results-th">יעד הטיסה</th>
      `;
    }

    // Table rows — one per flight
    tbody.innerHTML = data.map((row, i) => {
      const statusClass = row.crossed ? 'results-row--danger' : 'results-row--safe';

      return `
        <tr class="results-row ${statusClass}">
          <td class="results-cell results-cell--num">${i + 1}</td>
          <td class="results-cell results-cell--callsign">${escapeHtml(row.callsign)}</td>
          <td class="results-cell results-cell--airline">${escapeHtml(row.airline)}</td>
          <td class="results-cell results-cell--points">${row.pointCount}</td>
          <td class="results-cell results-cell--takeoff">${escapeHtml(formatUserFriendlyTime(row.takeoffTime))}</td>
          <td class="results-cell results-cell--destination">${escapeHtml(row.destination || '—')}</td>
        </tr>
      `;
    }).join('');

    // Show panel
    panel.classList.add('visible');
  }

  // =====================
  // UI Module
  // =====================
  function updateFlightListUI() {
    const container = DOM.flightList;
    DOM.flightCount.textContent = state.flights.size;

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

    // Sort: flights over cemetery first, then by callsign
    const sorted = [...state.flights.entries()].sort((a, b) => {
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
      const alt = formatAltitude(ac.alt_baro);
      const speed = ac.gs ? `${Math.round(ac.gs)} kts` : '';
      const type = ac.t || '';
      const detail = [type, speed].filter(Boolean).join(' · ');
      const overClass = flight.isOver ? ' flight-item--over' : '';

      return `
        <div class="flight-item${overClass}" data-id="${id}" onclick="window.__focusFlight('${id}')">
          <div class="flight-item__status"></div>
          <div class="flight-item__info">
            <div class="flight-item__callsign">${escapeHtml(callsign)}</div>
            ${detail ? `<div class="flight-item__detail">${escapeHtml(detail)}</div>` : ''}
          </div>
          <div class="flight-item__altitude">${alt}</div>
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

    if (DOM.importFileInput) {
      DOM.importFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        handleMultipleFiles(files);
        e.target.value = ''; // reset for next import
      });
    }

    // Close results panel
    const resultsPanelClose = document.getElementById('resultsPanelClose');
    if (resultsPanelClose) {
      resultsPanelClose.addEventListener('click', () => {
        document.getElementById('resultsPanel').classList.remove('visible');
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
    flight.marker.openTooltip();
  };

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
  // Bootstrap
  // =====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
