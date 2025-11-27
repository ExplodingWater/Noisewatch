// This function is the entry point, called by the Google Maps script tag
function initMap() {
    // 1. Define coordinates for Tirana
    const tirana = { lat: 41.3275, lng: 19.8187 };

    // 2. Create the map object
    const map = new google.maps.Map(document.getElementById("googleMap"), {
        center: tirana,
        zoom: 13,
        mapTypeId: 'satellite',
        mapId: window.__NW_MAP_ID || undefined,
        disableDefaultUI: false,
        clickableIcons: false
    });

    // 3. Fetch data and draw
    fetchReportsAndDrawHeatmap(map);

    // 4. Geolocation (Blue Dot)
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                // Only show marker if user is actually near Tirana/on the map
                if (Math.abs(current.lat - 41.3275) > 0.0005 || Math.abs(current.lng - 19.8187) > 0.0005) {
                    new google.maps.Marker({
                        position: current,
                        map,
                        title: 'You are here',
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeColor: 'white',
                            strokeWeight: 2
                        }
                    });
                    map.setCenter(current);
                    map.setZoom(16);
                }
            },
            (err) => console.warn('Geolocation denied:', err),
            { enableHighAccuracy: true }
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
                    dateStr = created.toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    timeStr = created.toLocaleTimeString('sq-AL', { hour12: false, hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {
                timeStr = r.submitted_time || '';
            }
            
            const dbStr = (typeof r.decibels !== 'undefined' && r.decibels !== null) ? `${Math.round(r.decibels)} dB` : '';
            const desc = (r.description || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            
            const item = document.createElement('div');
            item.style.padding = '12px 0';
            item.style.borderBottom = '1px solid #eee';
            item.innerHTML = `
                <div style="font-size:14px; color:#333; margin-bottom:4px;">
                    <strong>${timeStr}</strong> <span style="color:#888">(${dateStr})</span> — 
                    <span style="color:${r.decibels > 80 ? '#d32f2f' : '#388e3c'}; font-weight:bold;">${dbStr}</span>
                </div>
                <div style="color:#555; font-size:15px;">${desc}</div>
            `;
            body.appendChild(item);
        });

        modal.style.display = 'block';
        
        // Close handlers
        if(close) close.onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        
    } catch (e) {
        console.warn('Could not show cluster modal:', e);
    }
}

// Function to fetch data and render the heatmap + popup logic
async function fetchReportsAndDrawHeatmap(map) {
    try {
        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const reports = await response.json();

        // Filter to last 24 hours
        const timeWindow = Date.now() - (24 * 60 * 60 * 1000);
        const recentReports = reports.filter(r => {
            const t = new Date(r.created_at).getTime();
            return !isNaN(t) && t >= timeWindow;
        });

        // --- CLUSTERING ---
        const clusterDistance = 0.0015;
        
        // Exact match with map.html legend
        const colorMap = {
            green: '#4caf50',  // < 50
            yellow: '#ffc107', // 51-80
            orange: '#ff9800', // 81-100
            red: '#f44336'     // > 100
        };

        const bands = [
            { color: colorMap.green, min: -Infinity, max: 50 },
            { color: colorMap.yellow, min: 51, max: 80 },
            { color: colorMap.orange, min: 81, max: 100 },
            { color: colorMap.red, min: 101, max: Infinity }
        ];

        const clusters = [];
        function distanceClose(aLat, aLng, bLat, bLng) {
            return Math.abs(aLat - bLat) <= clusterDistance && Math.abs(aLng - bLng) <= clusterDistance;
        }

        recentReports.forEach(r => {
            if (!r.latitude || !r.longitude) return;
            const lat = Number(r.latitude);
            const lng = Number(r.longitude);
            const db = (typeof r.decibels === 'number') ? r.decibels : (r.db || 0);

            let found = null;
            for (let i = 0; i < clusters.length; i++) {
                if (distanceClose(lat, lng, clusters[i].lat, clusters[i].lng)) { found = clusters[i]; break; }
            }
            
            if (found) {
                found.reports.push(r);
                found.totalDecibels += db;
                // Recalculate center
                const n = found.reports.length;
                found.lat = ((found.lat * (n - 1)) + lat) / n;
                found.lng = ((found.lng * (n - 1)) + lng) / n;
            } else {
                clusters.push({ lat, lng, reports: [r], totalDecibels: db });
            }
        });

        window._nw_heat_points = [];
        const infoWindow = new google.maps.InfoWindow();

        // Process clusters for display
        clusters.forEach(cl => {
            const count = cl.reports.length;
            const avgDb = Math.round(cl.totalDecibels / count);
            
            let color = '#666';
            for(let b of bands) {
                if(avgDb >= b.min && avgDb <= b.max) { color = b.color; break; }
            }

            // Get latest report info for the hover popup
            cl.reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const latestReport = cl.reports[0];
            const timeStr = new Date(latestReport.created_at).toLocaleTimeString('sq-AL', {hour: '2-digit', minute:'2-digit'});
            
            const content = `
                <div style="padding: 0 4px; min-width: 160px; font-family: 'Inter', sans-serif;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <h3 style="margin:0; font-size:18px; font-weight:800; color:${color}">${avgDb} dB</h3>
                        <span style="font-size:12px; color:#666; background:#eee; padding:2px 6px; border-radius:10px;">${timeStr}</span>
                    </div>
                    <div style="font-size:13px; color:#444; margin-bottom:4px;">
                        <strong>${count}</strong> report(s) here
                    </div>
                    <div style="font-size:13px; color:#555; font-style:italic; border-top:1px solid #eee; padding-top:6px; margin-top:6px;">
                        "${latestReport.description || 'No description'}"
                    </div>
                    <div style="text-align:right; margin-top:8px;">
                        <span style="font-size:11px; color:#003366; text-decoration:underline; cursor:pointer;">Tap for details</span>
                    </div>
                </div>
            `;

            window._nw_heat_points.push({ 
                lat: cl.lat, lng: cl.lng, 
                weight: count, avgDb, color, 
                content: content,
                cluster: cl 
            });
        });

        // --- RENDER VISUALS (CANVAS) ---
        if (!window._nw_canvas_overlay) {
            class CanvasHeatmapOverlay extends google.maps.OverlayView {
                constructor(map, points) { super(); this.map = map; this.points = points; this.setMap(map); }
                
                onAdd() {
                    this.div = document.createElement('div');
                    this.div.style.position = 'absolute';
                    this.div.style.pointerEvents = 'none';
                    this.canvas = document.createElement('canvas');
                    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
                    this.div.appendChild(this.canvas);
                    this.getPanes().overlayLayer.appendChild(this.div);
                }
                
                onRemove() { if(this.div) this.div.parentNode.removeChild(this.div); }
                
                draw() {
                    if (!this.canvas) return;
                    const projection = this.getProjection();
                    if (!projection) return;
                    
                    const bounds = this.map.getBounds();
                    const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
                    const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
                    
                    const width = Math.abs(ne.x - sw.x);
                    const height = Math.abs(ne.y - sw.y);
                    const left = Math.min(sw.x, ne.x);
                    const top = Math.min(sw.y, ne.y);

                    this.div.style.left = left + 'px';
                    this.div.style.top = top + 'px';
                    this.div.style.width = width + 'px';
                    this.div.style.height = height + 'px';
                    
                    this.canvas.width = width;
                    this.canvas.height = height;
                    
                    const ctx = this.canvas.getContext('2d');
                    ctx.clearRect(0, 0, width, height);

                    this.points.forEach(p => {
                        const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
                        const x = pixel.x - left;
                        const y = pixel.y - top;
                        
                        const radius = 35; 
                        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                        
                        grad.addColorStop(0, p.color); 
                        grad.addColorStop(0.4, p.color + 'CC'); 
                        grad.addColorStop(1, p.color + '00'); 
                        
                        ctx.fillStyle = grad;
                        ctx.beginPath(); 
                        ctx.arc(x, y, radius, 0, Math.PI*2); 
                        ctx.fill();
                    });
                }
            }
            window._nw_canvas_overlay = new CanvasHeatmapOverlay(map, window._nw_heat_points);
        } else {
            window._nw_canvas_overlay.points = window._nw_heat_points;
            window._nw_canvas_overlay.draw();
        }

        // --- RENDER INTERACTION (INVISIBLE MARKERS) ---
        if (window._nw_interact_markers) {
            window._nw_interact_markers.forEach(m => m.setMap(null));
        }
        window._nw_interact_markers = [];

        window._nw_heat_points.forEach(p => {
            const marker = new google.maps.Marker({
                position: { lat: p.lat, lng: p.lng },
                map: map,
                icon: { 
                    path: google.maps.SymbolPath.CIRCLE, 
                    scale: 20, 
                    fillOpacity: 0, 
                    strokeOpacity: 0 
                }, 
                zIndex: 100
            });

            marker.addListener('mouseover', () => {
                infoWindow.setContent(p.content);
                infoWindow.open(map, marker);
            });

            marker.addListener('click', () => {
                infoWindow.close();
                showClusterModal(p.cluster);
            });

            window._nw_interact_markers.push(marker);
        });

    } catch (err) {
        console.warn("Error in heatmap:", err);
    }
}