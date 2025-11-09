// Loads Google Maps using the server-provided API key, then calls initMap (global)
(async function() {
  try {
    const resp = await fetch('/api/maps-key');
    if (!resp.ok) throw new Error('Failed to fetch maps key');
    const data = await resp.json();
  const key = data.key || '';
  // expose optional Map ID to the global so initMap can use it when creating the map
  try { window.__NW_MAP_ID = data.mapId || ''; } catch (e) { /* ignore in non-browser context */ }
  const script = document.createElement('script');
  // Load geometry + marker libraries and request the async loading flag so the
  // Maps JS warns go away. We still set async/defer on the element.
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry,marker&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  } catch (e) {
    console.error('Could not load Google Maps API:', e);
  }
})();
