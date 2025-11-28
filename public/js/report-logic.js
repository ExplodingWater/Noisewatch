document.addEventListener('DOMContentLoaded', () => {
    const locationBtn = document.getElementById('locationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const locationMapDiv = document.getElementById('locationMap');
    const recordBtn = document.getElementById('recordBtn');
    const dbValue = document.getElementById('dbValue');
    const dbLevel = document.getElementById('dbLevel');
    const descriptionInput = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    const submitReportBtn = document.getElementById('submitReport');
    const canvas = document.getElementById('visualizerCanvas');
    
    // Approximate Tirana Bounds
    const TIRANA_BOUNDS = { MIN_LAT: 41.25, MAX_LAT: 41.40, MIN_LNG: 19.75, MAX_LNG: 19.90 };

    let latitude = null;
    let longitude = null;
    let accuracy = null;
    let measuredDb = 0;
    let isRecording = false;
    let isInsideTirana = false;
    
    // Audio globals
    let audioContext, analyser, microphone, javascriptNode, mediaRecorder;
    let audioChunks = [];

    // --- 1. Location ---
    if (locationBtn) {
        locationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            locationBtn.disabled = true;
            locationStatus.innerHTML = "Locating...";

            if (!navigator.geolocation) {
                locationStatus.innerText = "Geolocation not supported";
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                    accuracy = position.coords.accuracy;

                    // Geofence Check
                    isInsideTirana = (
                        latitude >= TIRANA_BOUNDS.MIN_LAT && 
                        latitude <= TIRANA_BOUNDS.MAX_LAT &&
                        longitude >= TIRANA_BOUNDS.MIN_LNG && 
                        longitude <= TIRANA_BOUNDS.MAX_LNG
                    );

                    if (isInsideTirana) {
                        locationStatus.innerHTML = `<span style="color:green; font-weight:bold;">✅ Location Verified</span>`;
                        locationBtn.innerText = "✅ Update";
                        locationBtn.style.background = "#4CAF50";
                    } else {
                        locationStatus.innerHTML = `<span style="color:#E53935; font-weight:bold;">❌ Outside Service Area</span><br><small style="color:#E53935">You must be in Tirana to report.</small>`;
                        locationBtn.innerText = "❌ Outside Area";
                        locationBtn.style.background = "#E53935";
                    }

                    renderMap(latitude, longitude);
                    checkFormValidity();
                },
                (error) => {
                    console.error(error);
                    locationStatus.innerText = "Error (Check Permissions)";
                    locationBtn.disabled = false;
                },
                { enableHighAccuracy: true }
            );
        });
    }

    async function renderMap(lat, lng) {
        if (!locationMapDiv) return;
        locationMapDiv.style.display = 'block';
        if (typeof google !== 'undefined' && google.maps) {
            const center = { lat, lng };
            const map = new google.maps.Map(locationMapDiv, {
                center: center, zoom: 15, disableDefaultUI: true, mapTypeId: 'roadmap'
            });
            new google.maps.Marker({ position: center, map: map });
        }
    }

    // --- 2. Audio ---
    if (recordBtn) {
        recordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    startMeter(stream);
                } catch(err) { alert("Microphone needed."); }
            } else {
                stopMeter();
            }
        });
    }

    function startMeter(stream) {
        isRecording = true;
        recordBtn.classList.add('recording');
        if(dbLevel) dbLevel.innerText = "Recording (5s)...";
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
        
        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);

        javascriptNode.onaudioprocess = () => {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            drawVisualizer(array);
        };

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioBlob;
        mediaRecorder.start();

        setTimeout(() => { if(isRecording) stopMeter(); }, 5000);
    }

    function stopMeter() {
        isRecording = false;
        recordBtn.classList.remove('recording');
        if(mediaRecorder) mediaRecorder.stop();
        if(audioContext) audioContext.close();
    }

    async function processAudioBlob() {
        if(dbLevel) dbLevel.innerText = "Processing...";
        const blob = new Blob(audioChunks, {type:'audio/wav'});
        const buffer = await blob.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuf = await ctx.decodeAudioData(buffer);
        const data = audioBuf.getChannelData(0);
        
        let sum = 0;
        for(let i=0; i<data.length; i++) sum += data[i]*data[i];
        const rms = Math.sqrt(sum / data.length);
        const db = rms > 0 ? 20*Math.log10(rms) + 115 : 0;
        measuredDb = Math.round(db);
        
        if(dbValue) dbValue.innerText = measuredDb;
        if(dbLevel) {
            dbLevel.innerText = measuredDb > 80 ? "Loud (High)" : "OK";
            dbLevel.style.color = measuredDb > 80 ? "red" : "green";
        }
        checkFormValidity();
    }

    function drawVisualizer(data) {
        if(!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const w = canvas.width / data.length * 2.5;
        let x = 0;
        for(let i=0; i<data.length; i++) {
            const h = (data[i]/255)*canvas.height;
            ctx.fillStyle = `rgb(${h+50},250,50)`;
            ctx.fillRect(x, canvas.height-h, w, h);
            x += w+1;
        }
    }

    // --- 3. Validation ---
    if (descriptionInput) {
        descriptionInput.addEventListener('input', () => {
            if(charCount) charCount.innerText = descriptionInput.value.length;
            checkFormValidity();
        });
    }

    function checkFormValidity() {
        if (!submitReportBtn) return;
        
        const hasLocation = latitude !== null && isInsideTirana;
        const hasAudio = measuredDb > 0 && !isRecording;
        const hasText = descriptionInput.value.trim().length > 0;

        if (hasLocation && hasAudio && hasText) {
            submitReportBtn.disabled = false;
            submitReportBtn.style.opacity = "1";
            submitReportBtn.style.cursor = "pointer";
            submitReportBtn.innerText = "Submit Report";
        } else {
            submitReportBtn.disabled = true;
            submitReportBtn.style.opacity = "0.5";
            submitReportBtn.style.cursor = "not-allowed";
            if (latitude !== null && !isInsideTirana) {
                submitReportBtn.innerText = "Cannot submit outside Tirana";
            } else {
                submitReportBtn.innerText = "Complete all steps";
            }
        }
    }

    // --- 4. Submit ---
    if (submitReportBtn) {
        submitReportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            submitReportBtn.disabled = true;
            submitReportBtn.innerText = "Sending...";

            try {
                const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        latitude, longitude, accuracy_meters: accuracy,
                        decibels: measuredDb, description: descriptionInput.value,
                        device_info: navigator.userAgent
                    })
                });
                if(res.ok) {
                    alert("Success!");
                    window.location.href = '/map';
                } else {
                    alert("Error submitting");
                    submitReportBtn.disabled = false;
                }
            } catch(e) {
                alert("Network error");
                submitReportBtn.disabled = false;
            }
        });
    }
});