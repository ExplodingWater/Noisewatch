(async function() {
    try {
        // 1. Ensure initMap exists to prevent errors on pages like /report
        if (typeof window.initMap !== 'function') {
            window.initMap = function() {
                console.log("Google Maps loaded (no auto-init required for this page).");
            };
        }

        // 2. Fetch the API key from your backend
        const response = await fetch('/api/maps-key');
        if (!response.ok) throw new Error('Failed to fetch Maps API key');
        
        const data = await response.json();
        const apiKey = data.key;
        const mapId = data.mapId || '';

        if (!apiKey) {
            console.error("No Google Maps API key found in server response.");
            return;
        }

        // 3. Store mapId globally
        window.__NW_MAP_ID = mapId;

        // 4. Create the script tag
        // Added '&loading=async' for performance and to fix console warnings
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&libraries=visualization,marker&loading=async`;
        script.async = true;
        script.defer = true;
        
        // 5. Append to body
        document.body.appendChild(script);

    } catch (err) {
        console.error("Error loading Google Maps:", err);
    }
})();
