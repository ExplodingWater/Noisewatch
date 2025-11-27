document.addEventListener('DOMContentLoaded', () => {
    console.log("Report logic loaded");

    // DOM Elements
    const locationBtn = document.getElementById('locationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const recordBtn = document.getElementById('recordBtn');
    const dbValue = document.getElementById('dbValue');
    const dbLevel = document.getElementById('dbLevel');
    const descriptionInput = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    const submitReportBtn = document.getElementById('submitReport');
    const canvas = document.getElementById('visualizerCanvas');
    
    // State variables
    let latitude = null;
    let longitude = null;
    let accuracy = null;
    let measuredDb = 0;
    let isRecording = false;
    
    // Audio variables
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let javascriptNode = null;
    let mediaRecorder = null;
    let audioChunks = [];
    const RECORDING_DURATION = 5000; // 5 seconds

    // --- 1. Location Logic ---
    if (locationBtn) {
        locationBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            locationBtn.disabled = true;
            locationStatus.innerText = "Duke kërkuar... / Locating...";

            if (!navigator.geolocation) {
                locationStatus.innerText = "Geolocation not supported";
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                    accuracy = position.coords.accuracy;

                    locationStatus.innerHTML = `✅ <strong>Lat:</strong> ${latitude.toFixed(4)}, <strong>Lng:</strong> ${longitude.toFixed(4)}`;
                    locationBtn.style.backgroundColor = "#4CAF50";
                    locationBtn.style.color = "white";
                    locationBtn.innerText = "✅ OK";
                    checkFormValidity();
                },
                (error) => {
                    console.error("Error getting location:", error);
                    locationStatus.innerText = "Error (Check Permissions)";
                    locationBtn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    // --- 2. Audio Recording Logic ---
    if (recordBtn) {
        recordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    startMeter(stream);
                } catch (err) {
                    console.error(err);
                    alert("Microphone access is required to measure noise.");
                }
            } else {
                // Allow manual stop, though it auto-stops after 5s usually
                stopMeter();
            }
        });
    }

    function startMeter(stream) {
        isRecording = true;
        recordBtn.classList.add('recording'); 
        if(dbLevel) dbLevel.innerText = "Recording (5s)...";
        
        // 1. Setup Visualizer (Instant feedback)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);

        javascriptNode.onaudioprocess = function() {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            // Just draw the visualizer, don't calculate final dB here
            drawVisualizer(array);
        };

        // 2. Setup MediaRecorder (Accurate Mean Calculation)
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            await processAudioBlob();
            stopAudioContext();
        };

        mediaRecorder.start();

        // Auto-stop after 5 seconds to calculate mean
        setTimeout(() => {
            if (isRecording) {
                stopMeter();
            }
        }, RECORDING_DURATION);
    }

    function stopMeter() {
        if (!isRecording) return;
        isRecording = false;
        recordBtn.classList.remove('recording');
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    function stopAudioContext() {
        if (javascriptNode) javascriptNode.disconnect();
        if (microphone) microphone.disconnect();
        if (analyser) analyser.disconnect();
        if (audioContext) audioContext.close();
    }

    // --- The restored algorithm from your previous version ---
    async function processAudioBlob() {
        if(dbLevel) dbLevel.innerText = "Processing...";
        
        try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // We need a new temporary context to decode the whole buffer
            const tempContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0);
            const rms = calculateRMS(channelData);
            const db = rmsToDb(rms);
            
            measuredDb = Math.round(db);
            
            if(dbValue) dbValue.innerText = measuredDb;
            updateDbColor(measuredDb);
            checkFormValidity();
            
        } catch (e) {
            console.error("Error processing audio:", e);
            if(dbLevel) dbLevel.innerText = "Error";
        }
    }

    function calculateRMS(channelData) {
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
        }
        return Math.sqrt(sum / channelData.length);
    }

    function rmsToDb(rms) {
        if (rms === 0) return 0;
        
        // Standard formula: 20 * log10(RMS)
        const rawDb = 20 * Math.log10(rms);
        
        // RESTORED CALIBRATION OFFSET
        // 115dB is the offset used in your previous stable version
        const CALIBRATION_OFFSET = 115; 
        
        let calibrated = rawDb + CALIBRATION_OFFSET;
        
        // Clamp to realistic bounds (0 - 160dB)
        return Math.max(0, Math.min(160, calibrated));
    }

    function updateDbColor(db) {
        if (!dbLevel) return;
        
        let text = "";
        let color = "";

        if (db < 50) {
            text = "Quiet / Qetë";
            color = "#4CAF50";
        } else if (db < 80) {
            text = "Moderate / Mesatare";
            color = "#FFC107";
        } else {
            text = "High / E Lartë!";
            color = "#F44336";
        }
        
        dbLevel.innerText = `${text} (Done)`;
        dbLevel.style.color = color;
    }

    function drawVisualizer(dataArray) {
        if (!canvas) return;
        const canvasCtx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;

        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, width, height);

        const barWidth = (width / dataArray.length) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < dataArray.length; i++) {
            barHeight = (dataArray[i] / 255) * height;
            const r = barHeight + (25 * (i/dataArray.length));
            const g = 250 * (i/dataArray.length);
            const b = 50;
            canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
            canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    // --- 3. Form Validation ---
    if (descriptionInput) {
        descriptionInput.addEventListener('input', () => {
            if (charCount) charCount.innerText = descriptionInput.value.length;
            checkFormValidity();
        });
    }

    function checkFormValidity() {
        if (!submitReportBtn) return;

        const isLocationValid = latitude !== null && longitude !== null;
        const isAudioValid = measuredDb > 0 && !isRecording; 
        const isTextValid = descriptionInput && descriptionInput.value.trim().length > 0;

        if (isLocationValid && isAudioValid && isTextValid) {
            submitReportBtn.disabled = false;
            submitReportBtn.style.opacity = "1";
            submitReportBtn.style.cursor = "pointer";
        } else {
            submitReportBtn.disabled = true;
            submitReportBtn.style.opacity = "0.5";
            submitReportBtn.style.cursor = "not-allowed";
        }
    }

    // --- 4. Submission ---
    if (submitReportBtn) {
        submitReportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            submitReportBtn.disabled = true;
            const originalText = submitReportBtn.innerText;
            submitReportBtn.innerText = "Sending...";

            const payload = {
                latitude: latitude,
                longitude: longitude,
                accuracy_meters: accuracy,
                decibels: measuredDb,
                description: descriptionInput.value,
                device_info: navigator.userAgent
            };

            try {
                const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Success! / Sukses!");
                    window.location.href = '/map';
                } else {
                    alert("Error: " + (result.error || "Failed"));
                    submitReportBtn.disabled = false;
                    submitReportBtn.innerText = originalText;
                }
            } catch (error) {
                console.error(error);
                alert("Network Error");
                submitReportBtn.disabled = false;
                submitReportBtn.innerText = originalText;
            }
        });
    }
});