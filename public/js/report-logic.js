class NoiseReporter {
    constructor() {
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.preGrantedMicStream = null;
    this.activeStream = null; // the stream in use for the current recording session
        this.isRecording = false;
        this.recordedChunks = [];
        this.currentLocation = null;
        this.recordingDuration = 5000;
        
        this.initializeElements();
        this.setupEventListeners();
        // Tirana bounding box (approximate). Adjust as needed.
        // These are inclusive bounds: lat between MIN_LAT and MAX_LAT, lng between MIN_LNG and MAX_LNG.
        // If you need exact municipal borders, replace this with a GeoJSON polygon and use point-in-polygon.
        this.TIRANA_BOUNDS = {
            MIN_LAT: 41.20,
            MAX_LAT: 41.45,
            MIN_LNG: 19.65,
            MAX_LNG: 19.98
        };
        this.withinBounds = false;
        this._mapsLoaded = false;
    }

    initializeElements() {
        this.form = document.getElementById('noiseReportForm');
        this.getLocationBtn = document.getElementById('getLocationBtn');
        this.locationStatus = document.getElementById('locationStatus');
        this.coordinates = document.getElementById('coordinates');
        this.accuracyBox = document.getElementById('accuracy');
        this.latitude = document.getElementById('latitude');
        this.longitude = document.getElementById('longitude');
        this.accuracyMeters = document.getElementById('accuracyMeters');
        this.description = document.getElementById('description');
        this.charCount = document.getElementById('charCount');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');
        this.stopRecordingBtn = document.getElementById('stopRecordingBtn');
    this.enableMicBtn = document.getElementById('enableMicBtn');
    this.micPermissionStatus = document.getElementById('micPermissionStatus');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.locationPermissionHint = document.getElementById('locationPermissionHint');
        this.microphonePermissionHint = document.getElementById('microphonePermissionHint');
        this.audioVisualizer = document.getElementById('audioVisualizer');
        this.visualizerCanvas = document.getElementById('visualizerCanvas');
        this.dbDisplay = document.getElementById('dbDisplay');
        this.dbValue = document.getElementById('dbValue');
        this.dbLevel = document.getElementById('dbLevel');
        this.submitBtn = document.getElementById('submitBtn');
        this.locationMapDiv = document.getElementById('locationMap');
        this.outOfBoundsMsg = document.getElementById('outOfBoundsMsg');
    }

    setupEventListeners() {
        this.getLocationBtn.addEventListener('click', () => this.requestIOSLocationPermissionThenGet());
        this.description.addEventListener('input', () => this.updateCharCount());
        this.startRecordingBtn.addEventListener('click', () => this.requestIOSMicrophonePermissionThenRecord());
        if (this.enableMicBtn) this.enableMicBtn.addEventListener('click', () => this.promptMicrophonePermission());
        this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
        this.form.addEventListener('submit', (e) => this.submitReport(e));
    }

    // Public helper to prompt for microphone permission explicitly and show status
    async promptMicrophonePermission() {
        try {
            // Check secure context for iOS; localhost is allowed. This was so bullcrap in the beginning because I didn't know you had to use ngrok to test in iOS and I was losing my mind for a proper week or so. 
            const host = window.location.hostname;
            if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
                this.micPermissionStatus.style.display = 'block';
                this.micPermissionStatus.textContent = 'Microphone access requires HTTPS or localhost. Use HTTPS or open on localhost.';
                return;
            }

            this.micPermissionStatus.style.display = 'block';
            this.micPermissionStatus.textContent = 'Requesting microphone permission...';

            // If Permissions API available, show current state
            let state = 'unknown';
            try {
                state = await this.checkMicrophonePermission();
                console.log('Permission state before prompt:', state);
            } catch (e) {
                console.warn('Could not query permission state', e);
            }

            // Request a short-lived stream to trigger the permission dialog
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Save for reuse to avoid multiple prompts
            this.preGrantedMicStream = stream;

            // Immediately mark status as granted and keep the stream for reuse
            this.micPermissionStatus.textContent = 'Microphone permission granted.';
            console.log('Microphone stream obtained and stored for reuse');
        } catch (err) {
            console.error('Error requesting microphone permission:', err);
            this.micPermissionStatus.style.display = 'block';
            if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) { // Usually browser errors for denied permission
                this.micPermissionStatus.textContent = 'Microphone permission denied. Please enable it in your browser settings.';
                this.microphonePermissionHint.style.display = 'block';
            } else if (err && err.name === 'NotFoundError') {
                this.micPermissionStatus.textContent = 'No microphone found on this device.';
            } else {
                this.micPermissionStatus.textContent = 'Could not get microphone: ' + (err.message || err.name || 'unknown error');
            }
        }
    }

    // iOS-specific helpers: trigger permission prompts directly from user gesture handlers
    async requestIOSLocationPermissionThenGet() {
        // iOS requires direct user gesture for geolocation prompts
        await this.getCurrentLocation();
    }

    async requestIOSMicrophonePermissionThenRecord() {
        try {
            // If we already obtained a mic stream (e.g., from a prior prompt), reuse it
            if (!this.preGrantedMicStream) {
                // If not a secure context (HTTPS) and not localhost, iOS Safari will
                // refuse to show the microphone prompt. Inform the user.
                const host = window.location.hostname;
                if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
                    this.recordingStatus.textContent = 'Microphone access requires a secure connection (HTTPS). Open the site via HTTPS or on localhost, or use a tunnel (e.g., ngrok).';
                    this.microphonePermissionHint.style.display = 'block';
                    console.warn('Attempted getUserMedia in insecure context:', window.location.href);
                    return;
                }

                // Log current permission state when available for diagnostics
                try {
                    const perm = await this.checkMicrophonePermission();
                    console.log('Microphone permission state before prompt:', perm);
                } catch (e) {
                    console.warn('Could not query microphone permission state', e);
                }

                // Request a lightweight audio stream to prompt for permission on iOS.
                // We keep it so repeated recordings don't prompt again.
                console.log('Requesting microphone access via getUserMedia()');
                this.preGrantedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('getUserMedia resolved, stream obtained');
            }
            await this.startRecording(this.preGrantedMicStream);
        } catch (e) {
            console.error('Microphone permission error:', e);
            this.recordingStatus.textContent = 'Microphone permission denied. Please enable it and try again.';
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
                this.microphonePermissionHint.style.display = 'block';
            }
        }
    }

    async getCurrentLocation() {
        this.locationStatus.textContent = 'Getting your location...';
        this.getLocationBtn.disabled = true;

        if (!navigator.geolocation) {
            this.locationStatus.textContent = 'Geolocation is not supported by this browser.';
            this.getLocationBtn.disabled = false;
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                });
            });

            this.currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            this.latitude.textContent = this.currentLocation.latitude.toFixed(6);
            this.longitude.textContent = this.currentLocation.longitude.toFixed(6);
            if (typeof position.coords.accuracy === 'number') {
                this.accuracyMeters.textContent = Math.round(position.coords.accuracy);
                this.accuracyBox.style.display = 'block';
            }
            
            this.coordinates.style.display = 'block';
            this.locationStatus.textContent = 'Location captured!';
            this.getLocationBtn.textContent = 'Update location';
            this.getLocationBtn.disabled = false;
            // Render confirmation map and check bounds
            try {
                await this.ensureGoogleMapsLoaded();
                this.renderLocationMap(this.currentLocation.latitude, this.currentLocation.longitude);
            } catch (e) {
                // If maps fail to load, still perform bounds check using bbox
                console.warn('Google Maps failed to load for location preview:', e);
            }
            this.evaluateBoundsAndUI();
            this.checkFormValidity();

        } catch (error) {
            console.error('Error getting location:', error);
            this.locationStatus.textContent = 'Could not get your location. Please try again.';
            if (error && (error.code === error.PERMISSION_DENIED)) {
                this.locationPermissionHint.style.display = 'block';
            }
            this.getLocationBtn.disabled = false;
        }
    }

    // Load Google Maps JS dynamically (uses placeholder API key). Resolves when google.maps is available.
    ensureGoogleMapsLoaded() {
        if (this._mapsLoaded) return Promise.resolve();
        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                this._mapsLoaded = true;
                return resolve();
            }

            const script = document.createElement('script');
            // NOTE: Replace YOUR_GOOGLE_MAPS_API_KEY with a real key in production or inject it from server-side env.
            script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=geometry';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this._mapsLoaded = true;
                resolve();
            };
            script.onerror = (err) => reject(err || new Error('Failed to load Google Maps'));
            document.head.appendChild(script);
        });
    }

    renderLocationMap(lat, lng) {
        if (!this.locationMapDiv) return;
        this.locationMapDiv.style.display = 'block';
        // Create a map centered on user location and show a marker
        try {
            const center = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const map = new google.maps.Map(this.locationMapDiv, {
                center,
                zoom: 15,
                disableDefaultUI: true
            });
            new google.maps.Marker({ position: center, map, title: 'Your reported location' });
        } catch (e) {
            console.warn('Unable to initialize location map:', e);
        }
    }

    evaluateBoundsAndUI() {
        if (!this.currentLocation) return;
        const lat = this.currentLocation.latitude;
        const lng = this.currentLocation.longitude;
        const b = this.TIRANA_BOUNDS;
        const inside = (lat >= b.MIN_LAT && lat <= b.MAX_LAT && lng >= b.MIN_LNG && lng <= b.MAX_LNG);
        this.withinBounds = inside;
        if (!inside) {
            // Grey out submit and show message
            this.submitBtn.disabled = true;
            this.submitBtn.style.opacity = '0.5';
            this.submitBtn.style.pointerEvents = 'none';
            if (this.outOfBoundsMsg) this.outOfBoundsMsg.style.display = 'block';
        } else {
            // Restore submit appearance; final enabled state still depends on other form validity
            this.submitBtn.style.opacity = '';
            this.submitBtn.style.pointerEvents = '';
            if (this.outOfBoundsMsg) this.outOfBoundsMsg.style.display = 'none';
        }
    }
// Oh man the hell I had to go through just so that stupid Apple devices would allow me to access the microphone
    async startRecording(preExistingStream) {
        try {
            // Request microphone access
            const stream = preExistingStream || await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Keep track of the active stream for correct cleanup later.
            this.activeStream = stream;

            // Set up audio context for real-time analysis
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            // createMediaStreamSource does not expose the original MediaStream in all browsers,
            // so we keep `this.activeStream` and stop tracks from it when needed.
            this.microphone = this.audioContext.createMediaStreamSource(this.activeStream);
            
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);

            // Set up media recorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.startRecordingBtn.disabled = true;
            this.stopRecordingBtn.disabled = false;
            this.recordingStatus.textContent = '🔴 Recording... point your device to the source of the noise';
            this.audioVisualizer.style.display = 'block';
            this.microphonePermissionHint.style.display = 'none';

            // Start visualizer
            this.startVisualizer();

            // Auto-stop after 5 seconds
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, this.recordingDuration);

        } catch (error) {
            console.error('Error starting recording:', error);
            this.recordingStatus.textContent = 'Could not access microphone. Please check permissions.';
            if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
                this.microphonePermissionHint.style.display = 'block';
            }
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            // Stop tracks for the active stream if it's not the preserved pre-granted stream.
            // If we used a pre-granted stream for prompting we may want to keep it alive
            // for reuse across recordings; only stop transient streams.
            try {
                if (this.activeStream && this.activeStream.getTracks) {
                    const tracks = this.activeStream.getTracks();
                    // If the active stream is the same object as preGrantedMicStream, don't stop it
                    const shouldStop = !(this.preGrantedMicStream && this.preGrantedMicStream === this.activeStream);
                    if (shouldStop) {
                        tracks.forEach(track => track.stop());
                    }
                }
            } catch (e) {
                // Non-fatal: some browsers expose different stream objects; ignore stop errors
                console.warn('Error stopping active stream tracks:', e);
            }

            // Clear active stream reference (we may keep preGrantedMicStream intact)
            if (!(this.preGrantedMicStream && this.preGrantedMicStream === this.activeStream)) {
                this.activeStream = null;
            }

            // Update UI
            this.startRecordingBtn.disabled = false;
            this.stopRecordingBtn.disabled = true;
            this.recordingStatus.textContent = 'Processing audio...';
            this.audioVisualizer.style.display = 'none';
        }
    }

    // Permission helpers: gracefully handle browsers (Safari/iOS) that don't
    // fully implement the Permissions API.
    async checkMicrophonePermission() {
        try {
            if (!navigator.permissions) return 'unknown';
            const status = await navigator.permissions.query({ name: 'microphone' });
            return status.state; // 'granted' | 'denied' | 'prompt'
        } catch (e) {
            // Safari may throw or not support microphone in Permissions API
            return 'unknown';
        }
    }

    async checkLocationPermission() {
        try {
            if (!navigator.permissions) return 'unknown';
            const status = await navigator.permissions.query({ name: 'geolocation' });
            return status.state; // 'granted' | 'denied' | 'prompt'
        } catch (e) {
            return 'unknown';
        }
    }

    startVisualizer() {
        const canvas = this.visualizerCanvas;
        const ctx = canvas.getContext('2d');
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isRecording) return;

            requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgb(20, 20, 20)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;
                
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;

                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    async processRecording() {
        try {
            // Create audio blob
            const audioBlob = new Blob(this.recordedChunks, { type: 'audio/wav' });
            
            // Convert to array buffer for analysis
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Calculate dB level
            const channelData = audioBuffer.getChannelData(0);
            const rms = this.calculateRMS(channelData);
            const dbLevel = this.rmsToDb(rms);
            
            // Display results
            this.displayDbLevel(dbLevel);
            this.recordingStatus.textContent = 'Recording complete!';
            this.checkFormValidity();

        } catch (error) {
            console.error('Error processing recording:', error);
            this.recordingStatus.textContent = 'Error processing audio. Please try again.';
        }
    }

    calculateRMS(channelData) {
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
        }
        return Math.sqrt(sum / channelData.length);
    }

    rmsToDb(rms) {
        // Microphone signals are typically small floating values (<1) which
        // produce negative dBFS values. To map these into a consumer-friendly
        // positive dB-like scale we apply a calibration offset. The offset
        // may need tuning per device; default is chosen to map typical
        // mobile microphone RMS values into the 30-100 dB range.
        if (rms === 0) return -Infinity;

        const rawDb = 20 * Math.log10(rms);

    // Calibration settings - tweak these if recordings look too low/high.
    // A higher offset will raise measured values; devices with very low
    // sensitivity may need larger offsets. Lowered slightly from 120 -> 115
    // to avoid systematic overestimation.
    const CALIBRATION_OFFSET = 115; // default offset in dB
        const calibrated = rawDb + CALIBRATION_OFFSET;

        // Clamp to a reasonable range and return a numeric value.
        const clamped = Math.max(-100, Math.min(200, calibrated));
        return clamped;
    }

    displayDbLevel(dbLevel) {
        const roundedDb = Math.round(dbLevel);
        this.dbValue.textContent = roundedDb;
        this.dbDisplay.style.display = 'block';

        // Color code based on noise level
        // New ranges: <=50 Quiet, 51-80 Normal, 81-100 Loud, >100 Very Loud
        let level = 'Quiet';
        let color = '#4CAF50'; // Green

        if (roundedDb > 100) {
            level = 'Very Loud';
            color = '#B71C1C'; // Darker red
        } else if (roundedDb > 80) {
            level = 'Loud';
            color = '#F44336'; // Red
        } else if (roundedDb > 50) {
            level = 'Normal';
            color = '#8BC34A'; // Light Green
        }

        this.dbLevel.textContent = level;
        this.dbLevel.style.color = color;
        this.dbValue.style.color = color;
    }

    updateCharCount() {
        const count = this.description.value.length;
        this.charCount.textContent = count;
        this.checkFormValidity();
    }

    checkFormValidity() {
        const hasLocation = this.currentLocation !== null;
        const hasDescription = this.description.value.trim().length > 0;
        const hasRecording = this.dbDisplay.style.display !== 'none';

        // Also ensure location is within Tirana bounds
        const within = this.withinBounds === undefined ? false : this.withinBounds;
        this.submitBtn.disabled = !(hasLocation && hasDescription && hasRecording && within);
    }

    async submitReport(event) {
        event.preventDefault();

        if (!this.currentLocation) {
            alert('Please get your location first.');
            return;
        }

        if (!this.description.value.trim()) {
            alert('Please provide a description.');
            return;
        }

        const dbLevel = parseInt(this.dbValue.textContent);
        if (isNaN(dbLevel)) {
            alert('Please record audio first.');
            return;
        }

        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Submitting...';

        try {
            const reportData = {
                latitude: this.currentLocation.latitude,
                longitude: this.currentLocation.longitude,
                decibels: dbLevel,
                description: this.description.value.trim()
            };

            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                alert('✅ Report submitted successfully! Thank you for helping map noise pollution in Tirana.');
                this.form.reset();
                this.resetForm();
                // Attempt to tell the map page to refresh
                try {
                    if (window.opener && !window.opener.closed) {
                        window.opener.location.reload();
                    } else if (window.parent && window.parent !== window) {
                        window.parent.location.reload();
                    }
                } catch (e) {
                    // fallback: nothing
                }
            } else {
                throw new Error('Failed to submit report');
            }

        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Submit';
        }
    }

    resetForm() {
        this.currentLocation = null;
        this.coordinates.style.display = 'none';
        this.locationStatus.textContent = 'Click to get your current location';
        this.getLocationBtn.textContent = '📍 Use current location';
        this.recordingStatus.textContent = 'Click "Start Recording" to begin audio capture (takes 5 seconds)';
        this.audioVisualizer.style.display = 'none';
        this.dbDisplay.style.display = 'none';
        this.charCount.textContent = '0';
        this.checkFormValidity();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NoiseReporter();
});
