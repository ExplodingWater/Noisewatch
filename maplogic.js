function initMap() {
    const tirana = { lat: 41.3275, lng: 19.8187 };
    const map = new google.maps.Map(document.getElementById("googleMap"), {
        center: tirana,
        zoom: 13,
        mapTypeId: 'satellite'
    });
    fetchReportsAndDrawHeatmap(map);
}

async function fetchReportsAndDrawHeatmap(map) {
    try {
        const response = await fetch('http://localhost:3000/api/reports');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reports = await response.json();

        // --- CLUSTERING ---
        const clusterDistance = 0.0015; // smaller value = more fine clusters; tweak as needed
        let clusters = [];
        reports.forEach(r => {
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
            'rgba(76, 175, 80, 0)',      // Quiet/transparent
            'rgba(76, 175, 80, 1)',      // Green
            'rgba(255, 193, 7, 1)',      // Yellow
            'rgba(255, 152, 0, 1)',      // Orange
            'rgba(244, 67, 54, 1)'       // Red
        ];
        // For Google heatmap, point color depends on weight; but to get true buckets, we'll use multiple layers, one per band.
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
                            weight: avgDb // use avgDb so color mapping is more accurate
                        });
                    }
                }
            });
            if (data.length > 0) {
                const heatmap = new google.maps.visualization.HeatmapLayer({
                    data: data,
                    radius: 20 + 10 * Math.min(10, data.length), // scale radius up to 10x size
                    opacity: 0.7,
                    gradient: [customGradient[0], customGradient[band.colorIdx]]
                });
                heatmap.setMap(map);
            }
        });
        // Optionally add circles or markers for high density

    } catch (error) {
        console.error("Could not fetch reports:", error);
        document.getElementById("googleMap").innerText = "Could not load map data. Is the backend server running?";
    }
}
