// Loads Google Maps using the server-provided API key, then calls initMap (global)
(async function() {
  try {
    const resp = await fetch('/api/maps-key');
    if (!resp.ok) throw new Error('Failed to fetch maps key');
    const data = await resp.json();
    const key = data.key || '';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=visualization,geometry&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  } catch (e) {
    console.error('Could not load Google Maps API:', e);
  }
})();
