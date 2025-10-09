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
}

// Function to get the report data from our server
async function fetchReportsAndDrawHeatmap(map) {
    try {
        // Our backend server is running on localhost:3000
        const response = await fetch('http://localhost:3000/api/reports');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reports = await response.json();

        // Transform the report data into the format Google Maps HeatmapLayer needs
        const heatMapData = reports.map(report => {
            return {
                location: new google.maps.LatLng(report.latitude, report.longitude),
                weight: report.decibels // We can use the decibel level as the intensity (weight)
            };
        });

        // 4. Create the heatmap layer
        const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatMapData
        });

        // 5. Configure the heatmap properties
        heatmap.set('radius', 20); // The radius of influence for each data point
        heatmap.set('opacity', 0.8); // The opacity of the heatmap
        heatmap.set('gradient', [ // The color gradient of the heatmap
            'rgba(0, 255, 255, 0)',
            'rgba(0, 255, 255, 1)',
            'rgba(0, 191, 255, 1)',
            'rgba(0, 127, 255, 1)',
            'rgba(0, 63, 255, 1)',
            'rgba(0, 0, 255, 1)',
            'rgba(0, 0, 223, 1)',
            'rgba(0, 0, 191, 1)',
            'rgba(0, 0, 159, 1)',
            'rgba(0, 0, 127, 1)',
            'rgba(63, 0, 91, 1)',
            'rgba(127, 0, 63, 1)',
            'rgba(191, 0, 31, 1)',
            'rgba(255, 0, 0, 1)'
        ]);

        // 6. Set the heatmap on the map
        heatmap.setMap(map);

    } catch (error) {
        console.error("Could not fetch reports:", error);
        // You could display an error message to the user on the map div
        document.getElementById("googleMap").innerText = "Could not load map data. Is the backend server running?";
    }
}
