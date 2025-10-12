// Report Logic for Noise Reporting
class NoiseReporter {
    constructor() {
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isRecording = false;
        this.recordedChunks = [];
        this.currentLocation = null;
        this.recordingDuration = 5000; // 5 seconds
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.form = document.getElementById('noiseReportForm');
        this.getLocationBtn = document.getElementById('getLocationBtn');
        this.locationStatus = document.getElementById('locationStatus');
        this.coordinates = document.getElementById('coordinates');
        this.latitude = document.getElementById('latitude');
        this.longitude = document.getElementById('longitude');
        this.description = document.getElementById('description');
        this.charCount = document.getElementById('charCount');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');
        this.stopRecordingBtn = document.getElementById('stopRecordingBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.audioVisualizer = document.getElementById('audioVisualizer');
        this.visualizerCanvas = document.getElementById('visualizerCanvas');
        this.dbDisplay = document.getElementById('dbDisplay');
        this.dbValue = document.getElementById('dbValue');
        this.dbLevel = document.getElementById('dbLevel');
        this.submitBtn = document.getElementById('submitBtn');
    }

    setupEventListeners() {
        this.getLocationBtn.addEventListener('click', () => this.getCurrentLocation());
        this.description.addEventListener('input', () => this.updateCharCount());
        this.startRecordingBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
        this.form.addEventListener('submit', (e) => this.submitReport(e));
    }

    // Location Functions
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
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            this.currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            this.latitude.textContent = this.currentLocation.latitude.toFixed(6);
            this.longitude.textContent = this.currentLocation.longitude.toFixed(6);
            
            this.coordinates.style.display = 'block';
            this.locationStatus.textContent = '✅ Location captured!';
            this.getLocationBtn.textContent = '📍 Update location';
            this.getLocationBtn.disabled = false;
            this.checkFormValidity();

        } catch (error) {
            console.error('Error getting location:', error);
            this.locationStatus.textContent = '❌ Could not get your location. Please try again.';
            this.getLocationBtn.disabled = false;
        }
    }

    // Audio Recording Functions
    async startRecording() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });

            // Set up audio context for real-time analysis
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
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
            this.recordingStatus.textContent = '❌ Could not access microphone. Please check permissions.';
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            // Stop all tracks
            if (this.microphone && this.microphone.mediaStream) {
                this.microphone.mediaStream.getTracks().forEach(track => track.stop());
            }

            // Update UI
            this.startRecordingBtn.disabled = false;
            this.stopRecordingBtn.disabled = true;
            this.recordingStatus.textContent = 'Processing audio...';
            this.audioVisualizer.style.display = 'none';
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
        if (rms === 0) return -Infinity;
        return 20 * Math.log10(rms);
    }

    displayDbLevel(dbLevel) {
        const roundedDb = Math.round(dbLevel);
        this.dbValue.textContent = roundedDb;
        this.dbDisplay.style.display = 'block';

        // Color code based on noise level
        let level = 'Quiet';
        let color = '#4CAF50'; // Green

        if (roundedDb > 80) {
            level = 'Very Loud';
            color = '#F44336'; // Red
        } else if (roundedDb > 70) {
            level = 'Loud';
            color = '#FF9800'; // Orange
        } else if (roundedDb > 60) {
            level = 'Moderate';
            color = '#FFC107'; // Yellow
        } else if (roundedDb > 50) {
            level = 'Normal';
            color = '#8BC34A'; // Light Green
        }

        this.dbLevel.textContent = level;
        this.dbLevel.style.color = color;
        this.dbValue.style.color = color;
    }

    // Form Functions
    updateCharCount() {
        const count = this.description.value.length;
        this.charCount.textContent = count;
        this.checkFormValidity();
    }

    checkFormValidity() {
        const hasLocation = this.currentLocation !== null;
        const hasDescription = this.description.value.trim().length > 0;
        const hasRecording = this.dbDisplay.style.display !== 'none';

        this.submitBtn.disabled = !(hasLocation && hasDescription && hasRecording);
    }

    // Submission Functions
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
            } else {
                throw new Error('Failed to submit report');
            }

        } catch (error) {
            console.error('Error submitting report:', error);
            alert('❌ Failed to submit report. Please try again.');
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

// Initialize the reporter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NoiseReporter();
});
