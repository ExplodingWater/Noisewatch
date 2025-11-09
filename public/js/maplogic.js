// This function is the entry point, called by the Google Maps script tag
function initMap() {
    // 1. Define coordinates for Tirana
    const tirana = { lat: 41.3275, lng: 19.8187 };

    // 2. Create the map object and specify the DOM element for display.
            const map = new google.maps.Map(document.getElementById("googleMap"), {
                center: tirana,
                zoom: 13,
                mapTypeId: 'satellite', // You can use 'roadmap', 'satellite', 'hybrid', 'terrain'
                // Use mapId when available to enable vector maps / advanced features
                mapId: window.__NW_MAP_ID || undefined
            });

    // 3. Fetch data from our backend and create the heatmap
    fetchReportsAndDrawHeatmap(map);

    // 4. Request geolocation permission and mark current position if granted
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const accuracyMeters = pos.coords.accuracy;
                // Only show marker & circle if user location is significantly different from map's Tirana center
                if (Math.abs(current.lat - 41.3275) > 0.0005 || Math.abs(current.lng - 19.8187) > 0.0005) {
                    // Use AdvancedMarkerElement if available (recommended) otherwise fall back to Marker
                    try {
                        if (google.maps && google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                            new google.maps.marker.AdvancedMarkerElement({ position: current, map, title: 'You are here' });
                        } else {
                            new google.maps.Marker({ position: current, map, title: 'You are here' });
                        }
                    } catch (e) {
                        // fallback to classic marker if any error
                        try { new google.maps.Marker({ position: current, map, title: 'You are here' }); } catch (err) {}
                    }
                    if (typeof accuracyMeters === 'number') {
                        new google.maps.Circle({
                            strokeColor: '#1E90FF',
                            strokeOpacity: 0.6,
                            strokeWeight: 1,
                            fillColor: '#1E90FF',
                            fillOpacity: 0.15,
                            map,
                            center: current,
                            radius: accuracyMeters
                        });
                    }
                    map.setCenter(current);
                    map.setZoom(16);
                }
            },
            (err) => {
                console.warn('Geolocation permission denied or unavailable:', err);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    }
}

// Modal helper to show full cluster details
function showClusterModal(cluster) {
    try {
        const modal = document.getElementById('clusterModal');
        const body = document.getElementById('clusterModalBody');
        const title = document.getElementById('clusterModalTitle');
        const close = document.getElementById('clusterModalClose');
        if (!modal || !body) return;
        title.textContent = `Cluster — ${cluster.reports.length} report(s)`;
        body.innerHTML = '';
        // Build list
        cluster.reports.forEach(r => {
            const created = r.created_at ? new Date(r.created_at) : null;
            let dateStr = '';
            let timeStr = r.submitted_time || '';
            try {
                if (created) {
                    dateStr = created.toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Tirane' });
                    timeStr = r.submitted_time || created.toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'sq-AL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Tirane' });
                }
            } catch (e) {
                if (created) {
                    dateStr = created.toLocaleDateString();
                    timeStr = created.toLocaleTimeString();
                }
            }
            const dbStr = (typeof r.decibels !== 'undefined' && r.decibels !== null) ? `${Math.round(r.decibels)} dB` : '';
            const desc = (r.description || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const item = document.createElement('div');
            item.style.padding = '8px 0';
            item.style.borderBottom = '1px solid #eee';
            item.innerHTML = `<div style="font-size:13px;color:#333;"><strong>${dateStr} ${timeStr}</strong> — <span style="color:#666">${dbStr}</span></div><div style="margin-top:4px;color:#222">${desc}</div>`;
            body.appendChild(item);
        });

        modal.style.display = 'block';
        close.onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    } catch (e) {
        console.warn('Could not show cluster modal:', e);
    }
}

// Function to get the report data from our server
async function fetchReportsAndDrawHeatmap(map) {
    try {
        // Use relative path so it works on mobile devices accessing over LAN
        const response = await fetch('/api/reports');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reports = await response.json();

        // Filter reports to only include those submitted within the last 3 hours
        const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
        const recentReports = reports.filter(r => {
            // created_at is expected to be an ISO timestamp string from the server
            const t = new Date(r.created_at).getTime();
            return !isNaN(t) && t >= threeHoursAgo;
        });

        // --- CLUSTERING ---
        // Create simple proximity clusters from `recentReports` to avoid creating
        // thousands of heatmap points. This is a lightweight greedy clustering
        // based on lat/lng difference (good enough for small areas like Tirana).
        const clusterDistance = 0.0015; // ~100-200m, tweak as needed
        const customGradient = [
            'rgba(76, 175, 80, 0)',      // Transparent
            '#4caf50',                  // Green (quiet)
            '#ffc107',                  // Yellow (normal)
            '#ff9800',                  // Orange (loud)
            '#f44336'                   // Red (very loud)
        ];

        // Use the same bands as server-side stats now: <=50 quiet, 51-80 normal,
        // 81-100 loud, >100 very_high.
        const bands = [
            { name: 'green', colorIdx: 1, min: -Infinity, max: 50 },
            { name: 'yellow', colorIdx: 2, min: 51, max: 80 },
            { name: 'orange', colorIdx: 3, min: 81, max: 100 },
            { name: 'red', colorIdx: 4, min: 101, max: Infinity }
        ];

    // Build clusters from recentReports
        const clusters = [];
        function distanceClose(aLat, aLng, bLat, bLng) {
            return Math.abs(aLat - bLat) <= clusterDistance && Math.abs(aLng - bLng) <= clusterDistance;
        }

        recentReports.forEach(r => {
            if (!r.latitude || !r.longitude) return;
            const lat = Number(r.latitude);
            const lng = Number(r.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            const db = (typeof r.decibels === 'number') ? r.decibels : (r.db || null);

            // Try to find an existing cluster close enough
            let found = null;
            for (let i = 0; i < clusters.length; i++) {
                const c = clusters[i];
                if (distanceClose(lat, lng, c.lat, c.lng)) { found = c; break; }
            }
            if (found) {
                found.reports.push(r);
                found.totalDecibels = (found.totalDecibels || 0) + (typeof db === 'number' ? db : 0);
                // update cluster centroid (simple average)
                const n = found.reports.length;
                found.lat = ((found.lat * (n - 1)) + lat) / n;
                found.lng = ((found.lng * (n - 1)) + lng) / n;
            } else {
                clusters.push({ lat, lng, reports: [r], totalDecibels: (typeof db === 'number' ? db : 0) });
            }
        });
        const infoWindow = new google.maps.InfoWindow();
        const markers = [];

        // reset global heat points for this draw
        window._nw_heat_points = [];

        // helper: normalize color strings (hex or rgb[a]) into rgba(...) with given alpha
        function normalizeColor(col, alpha) {
            if (!col) return `rgba(0,0,0,${alpha})`;
            col = String(col).trim();
            if (col.startsWith('#')) {
                // hex to rgba
                const hex = col.slice(1);
                const bigint = parseInt(hex.length === 3 ? hex.split('').map(c=>c+c).join('') : hex, 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;
                return `rgba(${r},${g},${b},${alpha})`;
            }
            // rgb/rgba
            const m = col.match(/rgba?\(([^)]+)\)/);
            if (m) {
                const parts = m[1].split(',').map(p => p.trim());
                const r = parts[0] || 0;
                const g = parts[1] || 0;
                const b = parts[2] || 0;
                return `rgba(${r},${g},${b},${alpha})`;
            }
            // fallback: return as-is with alpha appended (not ideal)
            return col;
        }

        bands.forEach(band => {
            clusters.forEach(cl => {
                const reportCount = cl.reports.length;
                const avgDb = cl.totalDecibels / reportCount;
                if (avgDb >= band.min && avgDb <= band.max) { 
                    // Create circle overlay to approximate heatmap without the deprecated HeatmapLayer.
                    try {
                        const rawColor = customGradient[band.colorIdx] || '#666';
                        const color = rawColor;

                        // Prepare info window content using up to 5 reports in the cluster
                        const parts = [];
                        parts.push(`<strong>Avg: ${Math.round(avgDb)} dB</strong> — ${reportCount} report(s)`);
                        const reportLines = cl.reports.slice(0,5).map(r => {
                            const created = r.created_at ? new Date(r.created_at) : null;
                            let dateStr = '';
                            let timeStr = '';
                            try {
                                if (created) {
                                    dateStr = created.toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Tirane' });
                                    timeStr = created.toLocaleTimeString('sq-AL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Tirane' });
                                } else if (r.submitted_time) {
                                    timeStr = r.submitted_time;
                                }
                            } catch (e) {
                                if (created) {
                                    dateStr = created.toLocaleDateString();
                                    timeStr = created.toLocaleTimeString();
                                } else {
                                    timeStr = r.submitted_time || '';
                                }
                            }
                            const dbStr = (typeof r.decibels !== 'undefined' && r.decibels !== null) ? `${Math.round(r.decibels)} dB` : '';
                            const desc = (r.description || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                            return `<div style="margin-top:6px;"><small>${dateStr} ${timeStr} — <strong>${dbStr}</strong></small><div>${desc}</div></div>`;
                        });
                        parts.push(reportLines.join(''));
                        const markerId = `m_${Math.random().toString(36).slice(2,9)}`;
                        const content = `<div style="max-width:280px">${parts.join('')}<div style="margin-top:8px;text-align:right"><button id="view_${markerId}" style="padding:6px 8px;border-radius:4px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;">View all</button></div></div>`;

                        // Collect cluster display items for canvas rendering instead of
                        // creating many Circle overlays. We'll render a single canvas
                        // overlay that draws blended radial gradients so heat points
                        // naturally merge when zoomed out.
                        window._nw_heat_points.push({ lat: cl.lat, lng: cl.lng, weight: reportCount, avgDb, color, content, cluster: cl });
                    } catch (e) {
                        console.warn('Failed to create circle overlay for cluster', e);
                    }
                }
            });
            // HeatmapLayer is deprecated; we'll render a blended canvas overlay.
        });

        // If we have heat points, create or update the canvas overlay
        try {
                // Clean up any previous hover markers (used to capture mouse events reliably)
                try {
                    if (window._nw_hover_markers && Array.isArray(window._nw_hover_markers)) {
                        window._nw_hover_markers.forEach(m => { try { m.setMap(null); } catch (e) {} });
                    }
                    window._nw_hover_markers = [];
                } catch (e) {}

                const heatPoints = window._nw_heat_points || [];
            if (heatPoints.length > 0) {
                // Create a reusable OverlayView for the canvas if not present
                // expose infoWindow so overlay can use it for hover previews
                window._nw_infoWindow = infoWindow;
                // Create invisible but interactive markers at cluster centers so hover/click
                // interactions work consistently across browsers. Markers are almost
                // transparent but still receive mouse events.
                try {
                    heatPoints.forEach(p => {
                        try {
                            // cleanup will have run earlier; create marker using AdvancedMarkerElement when available
                            let marker = null;
                            const makeContent = () => {
                                const el = document.createElement('div');
                                el.style.width = '18px';
                                el.style.height = '18px';
                                el.style.borderRadius = '50%';
                                el.style.background = 'rgba(0,0,0,0.02)';
                                el.style.pointerEvents = 'auto';
                                return el;
                            };
                            const contentEl = makeContent();
                            if (google.maps && google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                                marker = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat: p.lat, lng: p.lng }, content: contentEl });
                            } else {
                                marker = new google.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map, clickable: true, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#000', fillOpacity: 0.02, strokeOpacity: 0 } });
                            }
                            if (marker) {
                                // attach events
                                try { marker.addListener('mouseover', () => { window._nw_infoWindow && window._nw_infoWindow.setContent(p.content || `<strong>Avg: ${Math.round(p.avgDb||0)} dB</strong> — ${p.weight} report(s)`), window._nw_infoWindow && window._nw_infoWindow.setPosition({ lat: p.lat, lng: p.lng }), window._nw_infoWindow && window._nw_infoWindow.open(map); }); } catch (e) {}
                                try { marker.addListener('mouseout', () => { window._nw_infoWindow && window._nw_infoWindow.close(); }); } catch (e) {}
                                try { marker.addListener('click', () => { showClusterModal(p.cluster); }); } catch (e) {}
                                window._nw_hover_markers.push(marker);
                            }
                        } catch (e) { /* per-marker non-fatal */ }
                    });
                } catch (e) { console.warn('Failed to create hover markers', e); }

                if (!window._nw_canvas_overlay) {
                    class CanvasHeatmapOverlay extends google.maps.OverlayView {
                        constructor(map, points) {
                            super();
                            this.map = map;
                            this.points = points;
                            this.div = null;
                            this.canvas = null;
                            this.ctx = null;
                            this.setMap(map);
                        }
                        onAdd() {
                            this.div = document.createElement('div');
                            this.div.style.position = 'absolute';
                            this.div.style.pointerEvents = 'auto';
                            this.canvas = document.createElement('canvas');
                            this.canvas.style.width = '100%';
                            this.canvas.style.height = '100%';
                            this.canvas.style.display = 'block';
                            this.div.appendChild(this.canvas);
                            // capture clicks for interactions
                            this.canvas.addEventListener('click', (ev) => this._onClick(ev));
                            // capture hover events for previewing cluster info
                            this.canvas.addEventListener('mousemove', (ev) => this._onMouseMove(ev));
                            this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
                            const panes = this.getPanes();
                            panes.overlayLayer.appendChild(this.div);
                        }
                        onRemove() {
                            if (this.div && this.div.parentNode) this.div.parentNode.removeChild(this.div);
                            this.div = null; this.canvas = null; this.ctx = null;
                        }
                        draw() {
                            if (!this.canvas) return;
                            const projection = this.getProjection();
                            const bounds = this.map.getBounds();
                            if (!bounds) return;
                            // size canvas to map container
                            const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
                            const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
                            const left = Math.min(sw.x, ne.x);
                            const top = Math.min(sw.y, ne.y);
                            const width = Math.abs(ne.x - sw.x);
                            const height = Math.abs(ne.y - sw.y);
                            // Position div and canvas
                            this.div.style.left = `${left}px`;
                            this.div.style.top = `${top}px`;
                            this.div.style.width = `${width}px`;
                            this.div.style.height = `${height}px`;
                            const ratio = window.devicePixelRatio || 1;
                            this.canvas.width = Math.max(1, Math.floor(width * ratio));
                            this.canvas.height = Math.max(1, Math.floor(height * ratio));
                            this.canvas.style.width = `${width}px`;
                            this.canvas.style.height = `${height}px`;
                            this.ctx = this.canvas.getContext('2d');
                            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                            // Draw each point as a radial gradient centered at its pixel position
                            const pts = this.points || [];
                            pts.forEach(p => {
                                const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
                                const x = (pixel.x - left) * ratio;
                                const y = (pixel.y - top) * ratio;
                                const intensity = Math.min(1, Math.log(1 + p.weight) / Math.log(1 + 10));
                                const radius = Math.max(20, Math.min(200, 20 + p.weight * 6)) * ratio;

                                const centerCol = normalizeColor(p.color, 0.95);
                                const midCol = normalizeColor(p.color, 0.45);
                                const edgeCol = normalizeColor(p.color, 0.0);

                                const grad = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
                                // center stronger color, edge transparent
                                grad.addColorStop(0, centerCol);
                                grad.addColorStop(0.6, midCol);
                                grad.addColorStop(1, edgeCol);
                                this.ctx.globalCompositeOperation = 'lighter';
                                this.ctx.fillStyle = grad;
                                this.ctx.beginPath();
                                this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                                this.ctx.fill();
                            });
                        }
                        _onClick(ev) {
                            if (!this.getProjection()) return;
                            const rect = this.canvas.getBoundingClientRect();
                            const x = ev.clientX - rect.left;
                            const y = ev.clientY - rect.top;
                            const ratio = window.devicePixelRatio || 1;
                            const px = x * ratio;
                            const py = y * ratio;
                            // find nearest point in pixel space
                            let best = null;
                            let bestDist = Infinity;
                            const projection = this.getProjection();
                            const bounds = this.map.getBounds();
                            const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
                            const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
                            const left = Math.min(sw.x, ne.x);
                            const top = Math.min(sw.y, ne.y);
                            const pts = this.points || [];
                            pts.forEach(p => {
                                const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
                                const cx = (pixel.x - left) * ratio;
                                const cy = (pixel.y - top) * ratio;
                                const d = Math.hypot(cx - px, cy - py);
                                if (d < bestDist) { bestDist = d; best = p; }
                            });
                            // threshold in pixels
                            if (best && bestDist < Math.max(30, 10 * (Math.log(1 + best.weight)))) {
                                // open cluster modal for best.cluster
                                showClusterModal(best.cluster);
                            }
                        }
                        _onMouseMove(ev) {
                            try {
                                if (!this.getProjection()) return;
                                const rect = this.canvas.getBoundingClientRect();
                                const x = ev.clientX - rect.left;
                                const y = ev.clientY - rect.top;
                                const ratio = window.devicePixelRatio || 1;
                                const px = x * ratio;
                                const py = y * ratio;
                                // find nearest point in pixel space
                                let best = null;
                                let bestDist = Infinity;
                                const projection = this.getProjection();
                                const bounds = this.map.getBounds();
                                if (!bounds) return;
                                const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
                                const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
                                const left = Math.min(sw.x, ne.x);
                                const top = Math.min(sw.y, ne.y);
                                const pts = this.points || [];
                                pts.forEach(p => {
                                    const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
                                    const cx = (pixel.x - left) * ratio;
                                    const cy = (pixel.y - top) * ratio;
                                    const d = Math.hypot(cx - px, cy - py);
                                    if (d < bestDist) { bestDist = d; best = p; }
                                });
                                const hoverThreshold = Math.max(20, 8 * (Math.log(1 + (best ? best.weight : 1))));
                                const win = window._nw_infoWindow;
                                if (best && bestDist < hoverThreshold) {
                                    // only update when hovered point changes
                                    if (!this._lastHovered || this._lastHovered.cluster !== best.cluster) {
                                        this._lastHovered = best;
                                        try {
                                            if (win) {
                                                win.setContent(best.content || `<strong>Avg: ${Math.round(best.avgDb || 0)} dB</strong> — ${best.weight} report(s)`);
                                                win.setPosition(new google.maps.LatLng(best.lat, best.lng));
                                                win.open(this.map);
                                            }
                                        } catch (e) { /* ignore */ }
                                    }
                                } else {
                                    this._lastHovered = null;
                                    if (win) win.close();
                                }
                            } catch (e) {
                                // non-fatal
                            }
                        }
                        _onMouseLeave() {
                            try {
                                this._lastHovered = null;
                                const win = window._nw_infoWindow;
                                if (win) win.close();
                            } catch (e) {}
                        }
                    }
                    window._nw_canvas_overlay = new CanvasHeatmapOverlay(map, heatPoints);
                } else {
                    // update points and redraw
                    window._nw_canvas_overlay.points = heatPoints;
                    window._nw_canvas_overlay.draw();
                }
            }
        } catch (e) {
            console.warn('Failed to render canvas heatmap overlay', e);
        }
        // Optionally you can add circles or markers for high density

    } catch (error) {
        console.warn("Could not fetch reports (showing map without heatmap):", error);
        // Keeps the map visible even if data fails to load
    }
}
