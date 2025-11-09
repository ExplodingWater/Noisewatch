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
        let clusters = [];
    // Use the filtered recent reports for clustering and heatmap
    recentReports.forEach(r => {
            // Try to assign to an existing cluster
            let found = false;
            for (let cl of clusters) {
                const dx = cl.lat - r.latitude;
                const dy = cl.lng - r.longitude;
                if (Math.sqrt(dx*dx + dy*dy) < clusterDistance) {
                    cl.reports.push(r);
                    // Mean update
                    cl.lat = (cl.lat * (cl.reports.length - 1) + r.latitude) / cl.reports.length;
                    cl.lng = (cl.lng * (cl.reports.length - 1) + r.longitude) / cl.reports.length;
                    cl.totalDecibels += r.decibels;
                    found = true;
                    break;
                }
            }
            if (!found) {
                clusters.push({
                    lat: r.latitude,
                    lng: r.longitude,
                    reports: [r],
                    totalDecibels: r.decibels
                });
            }
        });

        // --- HEATMAP DATA & COLOR LOGIC ---
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
