// This function is the entry point, called by the Google Maps script tag
function initMap() {
    // 1. Define coordinates for Tirana
    const tirana = { lat: 41.3275, lng: 19.8187 };

    // 2. Create the map object and specify the DOM element for display.
    const map = new google.maps.Map(document.getElementById("googleMap"), {
        center: tirana,
        zoom: 13,
        mapTypeId: 'satellite' // You can use 'roadmap', 'satellite', 'hybrid', 'terrain'
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
                    new google.maps.Marker({
                        position: current,
                        map,
                        title: 'You are here'
                    });
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
        const clusterDistance = 0.0015; // smaller value = more fine clusters; tweak as needed
        const customGradient = [
            'rgba(76, 175, 80, 0)',      // Transparent
            '#4caf50',                  // Green (quiet)
            '#ffc107',                  // Yellow (medium)
            '#ff9800',                  // Orange (loud)
            '#f44336'                   // Red (very loud)
        ];

        // For Google heatmap, point color depends on weight; we render multiple layers,
        // one per decibel band so we can approximate categorical coloring.
        // Use the same bands as server-side stats: <=50 quiet, 51-60 moderate,
        // 61-80 high, >80 very high.
        const bands = [
            { name: 'green', colorIdx: 1, min: -Infinity, max: 50 },
            { name: 'yellow', colorIdx: 2, min: 51, max: 60 },
            { name: 'orange', colorIdx: 3, min: 61, max: 80 },
            { name: 'red', colorIdx: 4, min: 81, max: Infinity }
        ];
        const infoWindow = new google.maps.InfoWindow();
        const markers = [];

        bands.forEach(band => {
            const data = [];
            clusters.forEach(cl => {
                const reportCount = cl.reports.length;
                const avgDb = cl.totalDecibels / reportCount;
                if (avgDb >= band.min && avgDb <= band.max) { 
                    // Weight can be reportCount or avgDb
                    for (let i = 0; i < 1; i++) {
                        data.push({
                            location: new google.maps.LatLng(cl.lat, cl.lng),
                            weight: avgDb // used avgDb so color mapping is more accurate
                        });
                    }
                    // Create an interactive marker for this cluster so users can hover/click for details
                    try {
                        const color = customGradient[band.colorIdx] || '#666';
                        const marker = new google.maps.Marker({
                            position: { lat: cl.lat, lng: cl.lng },
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 6 + Math.min(10, reportCount),
                                fillColor: color,
                                fillOpacity: 0.95,
                                strokeColor: '#333',
                                strokeWeight: 0.5
                            }
                        });

                        // Build info window content using up to 5 reports in the cluster
                        const parts = [];
                        parts.push(`<strong>Avg: ${Math.round(avgDb)} dB</strong> — ${reportCount} report(s)`);
                        const reportLines = cl.reports.slice(0,5).map(r => {
                            // Format timestamps in Albanian local time (Europe/Tirane), show date and HH:MM:SS (24h)
                            const created = r.created_at ? new Date(r.created_at) : null;
                            let dateStr = '';
                            let timeStr = '';
                            try {
                                if (created) {
                                    dateStr = created.toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Tirane' });
                                    timeStr = created.toLocaleTimeString('sq-AL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Tirane' });
                                } else if (r.submitted_time) {
                                    // fallback: server-provided time string (assumed HH:MM:SS)
                                    timeStr = r.submitted_time;
                                }
                            } catch (e) {
                                // graceful fallback
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
                        // Include a "View all" button in the info window which opens a modal
                        const markerId = `m_${Math.random().toString(36).slice(2,9)}`;
                        const content = `<div style="max-width:280px">${parts.join('')}<div style="margin-top:8px;text-align:right"><button id="view_${markerId}" style="padding:6px 8px;border-radius:4px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;">View all</button></div></div>`;

                        marker.addListener('click', () => {
                            infoWindow.setContent(content);
                            infoWindow.open(map, marker);
                            // attach handler after DOM ready for infowindow
                            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                                const btn = document.getElementById(`view_${markerId}`);
                                if (btn) {
                                    btn.addEventListener('click', () => {
                                        showClusterModal(cl);
                                    });
                                }
                            });
                        });

                        marker.addListener('mouseover', () => {
                            infoWindow.setContent(content);
                            infoWindow.open(map, marker);
                        });

                        marker.addListener('mouseout', () => {
                            setTimeout(() => {
                                infoWindow.close();
                            }, 300);
                        });

                        markers.push(marker);
                    } catch (e) {
                        console.warn('Failed to create interactive marker for cluster', e);
                    }
                }
            });
            if (data.length > 0) {
                const heatmap = new google.maps.visualization.HeatmapLayer({
                    data: data,
                    radius: 20 + 10 * Math.min(10, data.length), // scaled radius up to 10x size
                    opacity: 0.7,
                    gradient: [customGradient[0], customGradient[band.colorIdx]]
                });
                heatmap.setMap(map);
            }
        });
        // Optionally you can add circles or markers for high density

    } catch (error) {
        console.warn("Could not fetch reports (showing map without heatmap):", error);
        // Keeps the map visible even if data fails to load
    }
}
