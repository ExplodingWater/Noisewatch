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
                new google.maps.Marker({
                    position: current,
                    map,
                    title: 'You are here'
                });
                // Draw accuracy circle if available
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

        // Transform the report data into the format Google Maps HeatmapLayer needs
        const heatMapData = reports.map(report => {
            // Map decibel ranges to tiered weights so a single report never reaches "red"
            // Tiers (editable): <=50dB:0.10, 50-60:0.25, 60-70:0.45, 70-80:0.70, >80:0.85
            const dB = Number(report.decibels) || 0;
            let weight = 0.1;
            if (dB > 80) {
                weight = 0.85;
            } else if (dB > 70) {
                weight = 0.70;
            } else if (dB > 60) {
                weight = 0.45;
            } else if (dB > 50) {
                weight = 0.25;
            }
            return {
                location: new google.maps.LatLng(report.latitude, report.longitude),
                weight
            };
        });

        // 4. Create the heatmap layer
        const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatMapData,
            dissipating: true,
            radius: 28,
            // Allow overlapping points to push intensity to top colors; single points won't reach red
            maxIntensity: 3.0
        });

        // 5. Configure the heatmap properties
        heatmap.set('radius', 28);
        heatmap.set('opacity', 0.75);
        // Gradient arranged so red appears only at highest intensities
        heatmap.set('gradient', [
            'rgba(0, 255, 255, 0)',   // transparent
            'rgba(0, 255, 255, 1)',   // cyan
            'rgba(0, 191, 255, 1)',   // deep sky blue
            'rgba(0, 127, 255, 1)',   // dodger blue
            'rgba(0, 0, 255, 1)',     // blue
            'rgba(0, 128, 0, 1)',     // green
            'rgba(173, 255, 47, 1)',  // green-yellow
            'rgba(255, 215, 0, 1)',   // gold
            'rgba(255, 165, 0, 1)',   // orange
            'rgba(255, 99, 71, 1)',   // tomato
            'rgba(255, 69, 0, 1)',    // orange-red
            'rgba(255, 0, 0, 1)'      // red (only at top intensity)
        ]);

        // 6. Set the heatmap on the map
        heatmap.setMap(map);

    } catch (error) {
        console.warn("Could not fetch reports (showing map without heatmap):", error);
        // Keep the map visible even if data fails to load
    }
}
