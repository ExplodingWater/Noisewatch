(async function() {
    try {
        // 1. Fetch the API key from your backend
        const response = await fetch('/api/maps-key');
        if (!response.ok) throw new Error('Failed to fetch Maps API key');
        
        const data = await response.json();
        const apiKey = data.key;
        const mapId = data.mapId || '';

        if (!apiKey) {
            console.error("No Google Maps API key found in server response.");
            return;
        }

        // 2. Store mapId globally for maplogic.js to use
        window.__NW_MAP_ID = mapId;

        // 3. Create the script tag
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&libraries=visualization,marker&loading=async`;
        script.async = true;
        script.defer = true;
        
        // 4. Append to body
        document.body.appendChild(script);

    } catch (err) {
        console.error("Error loading Google Maps:", err);
    }
})();
