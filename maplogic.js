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

        const heatMapData = reports.map(report => ({
            location: new google.maps.LatLng(report.latitude, report.longitude),
            weight: report.decibels
        }));

        const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatMapData
        });

        heatmap.set('radius', 20);
        heatmap.set('opacity', 0.8);
        heatmap.set('gradient', [
            'rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)',
            'rgba(0, 127, 255, 1)', 'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)',
            'rgba(0, 0, 223, 1)', 'rgba(0, 0, 191, 1)', 'rgba(0, 0, 159, 1)',
            'rgba(0, 0, 127, 1)', 'rgba(63, 0, 91, 1)', 'rgba(127, 0, 63, 1)',
            'rgba(191, 0, 31, 1)', 'rgba(255, 0, 0, 1)'
        ]);

        heatmap.setMap(map);

    } catch (error) {
        console.error("Could not fetch reports:", error);
        document.getElementById("googleMap").innerText = "Could not load map data. Is the backend server running?";
    }
}
