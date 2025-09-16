function addDebugLog(message) {
            const debugPanel = document.getElementById('debug-panel');
            const time = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.textContent = `${time}: ${message}`;
            debugPanel.appendChild(logEntry);
            debugPanel.scrollTop = debugPanel.scrollHeight;
            console.log('Debug:', message);
        }
        
        const firebaseConfig = {
    apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
    authDomain: "tracking-654e3.firebaseapp.com",
    databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tracking-654e3",
    storageBucket: "tracking-654e3.firebasestorage.app",
    messagingSenderId: "61074342637",
    appId: "1:61074342637:web:ee566c965c595668b5c2e4",
    measurementId: "G-Q5ZXKE7PTL"
};
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.database();
        
        const googleLoginButton = document.getElementById('google-login-button');
        const logoutButton = document.getElementById('logout-button');
        const loginSection = document.getElementById('login-section');
        const trackingSection = document.getElementById('tracking-section');
        const namaInput = document.getElementById('nama-karyawan');

        // Fungsi Login dengan Google
        googleLoginButton.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
            } catch (error) {
                addDebugLog('Gagal login: ' + error.message);
            }
        });
        
        // Fungsi Logout
        logoutButton.addEventListener('click', async () => {
            await auth.signOut();
            addDebugLog('Berhasil logout.');
        });
        
        // Monitor status autentikasi
        auth.onAuthStateChanged(user => {
            if (user) {
                // User login, tampilkan section tracking
                loginSection.classList.add('hidden');
                trackingSection.classList.remove('hidden');
                namaInput.value = user.displayName || user.email; // Gunakan nama dari akun Google
                initializeTracker();
            } else {
                // User logout, tampilkan section login
                loginSection.classList.remove('hidden');
                trackingSection.classList.add('hidden');
            }
        });

        function initializeTracker() {
            const startButton = document.getElementById('startButton');
            const stopButton = document.getElementById('stopButton');
            const statusMessage = document.getElementById('status-message');
            const updateCountEl = document.getElementById('update-count');
            const accuracyEl = document.getElementById('accuracy');
            const gpsIndicator = document.getElementById('gps-indicator');
            const fakeIndicator = document.getElementById('fake-indicator');
            const connectionIndicator = document.getElementById('connection-indicator');
            const permissionButton = document.getElementById('permissionButton');

            let watchId = null;
            let userId = null;
            let updateCount = 0;
            let lastPosition = null;
            let suspiciousCount = 0;
            let startTime = null;
            let heading = null;

            function setupDeviceOrientationListener() {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    if (permissionButton) {
                        permissionButton.style.display = 'block';
                        permissionButton.addEventListener('click', () => {
                            DeviceOrientationEvent.requestPermission()
                                .then(state => {
                                    if (state === 'granted') {
                                        window.addEventListener('deviceorientation', handleOrientation);
                                        permissionButton.style.display = 'none';
                                    } else {
                                        console.error("Permission not granted for device orientation");
                                    }
                                })
                                .catch(console.error);
                        });
                    }
                } else {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            }

            function handleOrientation(event) {
                if (event.webkitCompassHeading !== undefined) {
                    heading = event.webkitCompassHeading;
                } else if (event.alpha !== null) {
                    const alpha = event.alpha;
                    heading = 360 - alpha;
                }
            }

            function updateIndicator(indicator, status) {
                indicator.className = `indicator-dot ${status}`;
            }

            function updateStats() {
                updateCountEl.textContent = updateCount;
            }

            function detectFakeLocation(position) {
                const issues = [];
                let suspiciousScore = 0;
                if (position.coords.accuracy > 100) {
                    issues.push('Akurasi GPS rendah');
                    suspiciousScore += 20;
                } else if (position.coords.accuracy > 50) {
                    suspiciousScore += 10;
                }
                if (lastPosition) {
                    const distance = getDistance(
                        lastPosition.lat, lastPosition.lng,
                        position.coords.latitude, position.coords.longitude
                    );
                    const timeElapsed = (position.timestamp - lastPosition.timestamp) / 1000;
                    const speed = timeElapsed > 0 ? (distance / timeElapsed) * 3.6 : 0;
                    if (speed > 200) {
                        issues.push('Kecepatan tidak mungkin');
                        suspiciousScore += 50;
                    } else if (speed > 120) {
                        issues.push('Kecepatan tinggi');
                        suspiciousScore += 20;
                    }
                }
                if (lastPosition && updateCount > 5) {
                    const timeDiff = (position.timestamp - lastPosition.timestamp) / 1000;
                    const distance = getDistance(
                        lastPosition.lat, lastPosition.lng,
                        position.coords.latitude, lastPosition.coords.longitude
                    );
                    if (distance > 1000 && timeDiff < 10) {
                        issues.push('Teleportasi lokasi');
                        suspiciousScore += 60;
                    }
                }
                if (position.coords.accuracy === 5.0 || position.coords.accuracy === 10.0) {
                    suspiciousScore += 15;
                }
                return {
                    isSuspicious: suspiciousScore > 30,
                    suspiciousScore,
                    issues,
                    riskLevel: suspiciousScore > 50 ? 'high' : suspiciousScore > 30 ? 'medium' : 'low'
                };
            }

            function getDistance(lat1, lon1, lat2, lon2) {
                const R = 6371e3;
                const φ1 = lat1 * Math.PI / 180;
                const φ2 = lat2 * Math.PI / 180;
                const Δφ = (lat2 - lat1) * Math.PI / 180;
                const Δλ = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            }

            async function handlePosition(position) {
                updateCount++;
                const now = Date.now();
                accuracyEl.textContent = Math.round(position.coords.accuracy) + 'm';
                const fakeCheck = detectFakeLocation(position);

                if (fakeCheck.isSuspicious) {
                    suspiciousCount++;
                    updateIndicator(fakeIndicator, 'danger');
                    addDebugLog(`⚠️ Aktivitas mencurigakan: ${fakeCheck.issues.join(', ')}`);
                } else {
                    updateIndicator(fakeIndicator, 'safe');
                }

                const locationData = {
                    namaKaryawan: namaInput.value.trim(),
                    userId: userId,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude || null,
                    heading: heading || null,
                    speed: position.coords.speed || null,
                    timestamp: new Date().toISOString(),
                    localTime: new Date().toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta'
                    }),
                    unixTime: now,
                    sessionStart: startTime,
                    updateCount: updateCount,
                    suspiciousScore: fakeCheck.suspiciousScore,
                    riskLevel: fakeCheck.riskLevel,
                    issues: fakeCheck.issues,
                    status: 'active',
                    batteryOptimized: false,
                };

                try {
                    await db.ref('location-data/' + userId + '/' + now).set(locationData);
                    await db.ref('location-data/' + userId + '/latest').set(locationData);

                    updateIndicator(connectionIndicator, 'safe');
                    addDebugLog(`📡 Lokasi #${updateCount} terkirim`);

                    if (fakeCheck.riskLevel === 'high') {
                        statusMessage.textContent = ` HIGH RISK - Aktivitas mencurigakan`;
                        statusMessage.style.color = '#dc3e3e';
                    } else if (fakeCheck.riskLevel === 'medium') {
                        statusMessage.textContent = ` MEDIUM RISK - Memantau ketat`;
                        statusMessage.style.color = '#ffc107';
                    } else {
                        statusMessage.textContent = ` SECURE - Lokasi terverifikasi (${updateCount} updates)`;
                        statusMessage.style.color = '#28a745';
                    }

                } catch (error) {
                    updateIndicator(connectionIndicator, 'danger');
                    addDebugLog(`💥 Gagal kirim lokasi: ${error.message}`);
                    statusMessage.textContent = ' Koneksi gagal - Mencoba ulang...';
                    statusMessage.style.color = '#dc3e3e';
                }

                lastPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: position.timestamp
                };
                updateStats();
            }

            function handleError(error) {
                updateIndicator(gpsIndicator, 'danger');
                addDebugLog(` GPS Error: ${error.message}`);
                statusMessage.textContent = ' GPS Error - Cek izin';
                statusMessage.style.color = '#dc3e3e';
            }

            function startTracking() {
                const nama = namaInput.value.trim();
                if (!nama) {
                    statusMessage.textContent = 'Mohon masukkan nama Anda!';
                    statusMessage.style.color = '#ffc107';
                    namaInput.focus();
                    return;
                }
                if (nama.length < 3) {
                    statusMessage.textContent = 'Nama minimal 3 karakter!';
                    statusMessage.style.color = '#ffc107';
                    namaInput.focus();
                    return;
                }

                userId = auth.currentUser.uid;
                
                startTime = Date.now();
                updateCount = 0;
                suspiciousCount = 0;
                lastPosition = null;

                startButton.disabled = true;
                stopButton.disabled = false;
                namaInput.disabled = true;
                document.querySelector('.container').classList.add('tracking-active');

                addDebugLog(`🚀 Memulai tracking aman untuk: ${nama}`);
                statusMessage.textContent = 'Memulai tracking aman...';
                statusMessage.style.color = '#667eea';

                const options = {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                };

                updateIndicator(gpsIndicator, 'warning');
                watchId = navigator.geolocation.watchPosition(
                    handlePosition,
                    handleError,
                    options
                );

                setupDeviceOrientationListener();

                addDebugLog(' GPS tracking dimulai dengan presisi 1 detik');
            }

            async function stopTracking() {
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
                
                window.removeEventListener('deviceorientation', handleOrientation);

                if (userId) {
                    try {
                        await db.ref('location-data/' + userId + '/latest').update({
                            status: 'stopped',
                            stopTime: Date.now(),
                            finalUpdateCount: updateCount,
                            sessionDuration: Date.now() - startTime
                        });
                    } catch (error) {
                        addDebugLog(` Gagal perbarui status berhenti: ${error.message}`);
                    }
                }

                startButton.disabled = false;
                stopButton.disabled = true;
                namaInput.disabled = false;
                document.querySelector('.container').classList.remove('tracking-active');
                updateIndicator(gpsIndicator, 'safe');
                updateIndicator(fakeIndicator, 'safe');
                statusMessage.textContent = `Tracking berhenti. Sesi: ${updateCount} updates`;
                statusMessage.style.color = '#667eea';
                addDebugLog(` Tracking berhenti. Total updates: ${updateCount}, Kejadian mencurigakan: ${suspiciousCount}`);
            }

            startButton.addEventListener('click', startTracking);
            stopButton.addEventListener('click', stopTracking);
            namaInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !startButton.disabled) {
                    startTracking();
                }
            });

            db.ref('.info/connected').on('value', function(snapshot) {
                if (snapshot.val() === true) {
                    updateIndicator(connectionIndicator, 'safe');
                    addDebugLog(' Firebase terhubung');
                } else {
                    updateIndicator(connectionIndicator, 'danger');
                    addDebugLog(' Firebase terputus');
                }
            });

            addDebugLog(' Secure Tracker berhasil diinisialisasi');
            namaInput.focus();
        }