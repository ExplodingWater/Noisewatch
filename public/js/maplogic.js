// Make initMap global so the Google Maps callback can find it
window.initMap = function() {
    const tirana = { lat: 41.3275, lng: 19.8187 };
    
    const mapElement = document.getElementById("googleMap");
    if (!mapElement) return;

    const map = new google.maps.Map(mapElement, {
        center: tirana,
        zoom: 13,
        mapTypeId: 'satellite',
        mapId: window.__NW_MAP_ID || undefined, // Uses ID fetched by loader
        disableDefaultUI: false,
        clickableIcons: false,
        streetViewControl: false
    });

    fetchReportsAndDrawHeatmap(map);

    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (Math.abs(current.lat - 41.3275) > 0.0005 || Math.abs(current.lng - 19.8187) > 0.0005) {
                new google.maps.Marker({
                    position: current,
                    map,
                    title: 'You',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2
                    }
                });
                map.setCenter(current);
                map.setZoom(15);
            }
        });
    }
};

window.showClusterModal = function(cluster) {
    const modal = document.getElementById('clusterModal');
    const body = document.getElementById('clusterModalBody');
    const close = document.getElementById('clusterModalClose');
    
    if (!modal || !body) return;
    
    body.innerHTML = '';
    cluster.reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    cluster.reports.forEach(r => {
        const created = r.created_at ? new Date(r.created_at) : null;
        let dateStr = created ? created.toLocaleDateString('sq-AL') : '';
        let timeStr = created ? created.toLocaleTimeString('sq-AL', {hour:'2-digit', minute:'2-digit'}) : '';
        const desc = (r.description || '').replace(/</g,'&lt;');
        const db = Math.round(r.decibels || 0);
        
        // Color logic for list items
        let valColor = '#333';
        if (db > 80) valColor = '#F44336';
        else if (db > 50) valColor = '#FF9800';
        else valColor = '#4CAF50';

        const item = document.createElement('div');
        item.className = 'cluster-item'; // CSS class in style.css
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:bold; color:${valColor};">${db} dB</span>
                <span style="color:var(--text-muted); font-size:0.85rem;">${dateStr} ${timeStr}</span>
            </div>
            <div style="color:var(--text-main); font-size:0.95rem;">${desc}</div>
        `;
        body.appendChild(item);
    });

    modal.style.display = 'flex';
    
    if(close) close.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
};

async function fetchReportsAndDrawHeatmap(map) {
    try {
        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error('Network response was not ok');
        const reports = await response.json();

        const timeWindow = Date.now() - (24 * 60 * 60 * 1000);
        const recentReports = reports.filter(r => {
            const t = new Date(r.created_at).getTime();
            return !isNaN(t) && t >= timeWindow;
        });

        const clusters = [];
        const clusterDistance = 0.0015;

        recentReports.forEach(r => {
            const lat = Number(r.latitude);
            const lng = Number(r.longitude);
            const db = Number(r.decibels);
            if(isNaN(lat) || isNaN(lng)) return;

            let found = clusters.find(c => 
                Math.abs(lat - c.lat) < clusterDistance && 
                Math.abs(lng - c.lng) < clusterDistance
            );

            if (found) {
                found.reports.push(r);
                found.totalDecibels += db;
                const n = found.reports.length;
                found.lat = ((found.lat * (n - 1)) + lat) / n;
                found.lng = ((found.lng * (n - 1)) + lng) / n;
            } else {
                clusters.push({ lat, lng, reports: [r], totalDecibels: db });
            }
        });

        const infoWindow = new google.maps.InfoWindow();
        
        clusters.forEach(cl => {
            const count = cl.reports.length;
            const avgDb = Math.round(cl.totalDecibels / count);
            
            let color = '#666';
            if(avgDb <= 50) color = '#4caf50';
            else if(avgDb <= 80) color = '#ffc107';
            else if(avgDb <= 100) color = '#ff9800';
            else color = '#f44336';

            // Visual Circle
            new google.maps.Circle({
                strokeColor: color,
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.4,
                map,
                center: { lat: cl.lat, lng: cl.lng },
                radius: 40 + (count * 5),
                clickable: false 
            });

            // Interaction Marker (Invisible but clickable)
            const marker = new google.maps.Marker({
                position: { lat: cl.lat, lng: cl.lng },
                map: map,
                icon: { 
                    path: google.maps.SymbolPath.CIRCLE, 
                    scale: 15, 
                    fillOpacity: 0, 
                    strokeOpacity: 0 
                }, 
                zIndex: 100,
                title: `${avgDb} dB`
            });

            const latest = cl.reports.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
            const timeStr = new Date(latest.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            // Note: Inline styles here for infoWindow content to ensure visibility
            const content = `
                <div style="padding:5px; color:#111; font-family:sans-serif;">
                    <h3 style="margin:0 0 5px; color:${color}; font-weight:800;">${avgDb} dB</h3>
                    <p style="margin:0; font-size:13px;">
                        <strong>Reports:</strong> ${count}<br>
                        <span style="color:#666;">${timeStr}</span>
                    </p>
                    <div style="margin-top:6px; font-style:italic; font-size:12px; border-top:1px solid #eee; padding-top:4px;">
                        "${latest.description}"
                    </div>
                    <button id="btn-${latest.id}" style="margin-top:8px; background:#003366; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; width:100%;">View Details</button>
                </div>
            `;

            marker.addListener('click', () => {
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
                
                setTimeout(() => {
                    const btn = document.getElementById(`btn-${latest.id}`);
                    if(btn) {
                        btn.onclick = () => {
                            infoWindow.close();
                            showClusterModal(cl);
                        };
                    }
                }, 100);
            });
        });

    } catch (err) {
        console.warn("Map Data Error:", err);
    }
}