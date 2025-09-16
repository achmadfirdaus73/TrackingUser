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

new Vue({
  el: '#app',
  vuetify: new Vuetify(),
  data: () => ({
    userLoggedIn: false,
    userNameSaved: false,
    nama: '',
    photoURL: '',
    isTracking: false,
    watchId: null,
    location: null,
    snackbar: { show: false, message: '', color: '', timeout: 3000 }
  }),
  mounted() {
    firebase.auth().onAuthStateChanged(user => {
      this.userLoggedIn = !!user;
      if (user) {
        this.photoURL = user.photoURL || '';
        this.checkUserProfile(user);
      } else {
        this.userNameSaved = false;
        this.photoURL = '';
        this.stopTracking();
      }
    });
  },
  methods: {
    addNotification(color, message) {
      this.snackbar.color = color;
      this.snackbar.message = message;
      this.snackbar.show = true;
    },
    async loginWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (error) {
        this.addNotification('red', 'Gagal login: ' + error.message);
      }
    },
    async logout() {
      try {
        await firebase.auth().signOut();
      } catch (error) {
        this.addNotification('red', 'Gagal logout: ' + error.message);
      }
    },
    checkUserProfile(user) {
      const userRef = firebase.database().ref('users/' + user.uid);
      userRef.once('value', snapshot => {
        if (snapshot.exists() && snapshot.val().nama) {
          this.userNameSaved = true;
          this.nama = snapshot.val().nama;
          this.photoURL = snapshot.val().photoURL || user.photoURL || '';
        } else {
          this.userNameSaved = false;
        }
      });
    },
    saveUserName() {
      const user = firebase.auth().currentUser;
      if (!user) return;
      if (!this.nama) {
        this.addNotification('red', 'Nama tidak boleh kosong');
        return;
      }
      firebase.database().ref('users/' + user.uid).set({
        userId: user.uid,
        nama: this.nama,
        email: user.email,
        photoURL: user.photoURL || ''
      }).then(() => {
        this.userNameSaved = true;
        this.addNotification('green', 'Profil berhasil disimpan');
      });
    },
    startTracking() {
      if (this.isTracking) return;
      if (!("geolocation" in navigator)) {
        this.addNotification('error', 'Geolocation tidak didukung oleh browser Anda.');
        return;
      }
      this.isTracking = true;
      this.watchId = navigator.geolocation.watchPosition(
        this.onPositionUpdate,
        this.onPositionError,
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      this.addNotification('green', 'Tracking dimulai!');
    },
    stopTracking() {
      if (!this.isTracking) return;
      navigator.geolocation.clearWatch(this.watchId);
      this.isTracking = false;
      this.addNotification('info', 'Tracking dihentikan.');
      this.updateLocationStatus('offline');
    },
    onPositionUpdate(position) {
      this.location = position.coords;
      this.updateLocationStatus('active', position.coords);
    },
    onPositionError(error) {
      this.isTracking = false;
      let errorMessage = 'GPS Eror: Cek izin lokasi.';
      switch (error.code) {
        case error.PERMISSION_DENIED: errorMessage = 'GPS Eror: Izin lokasi ditolak.'; break;
        case error.POSITION_UNAVAILABLE: errorMessage = 'GPS Eror: Lokasi tidak tersedia.'; break;
        case error.TIMEOUT: errorMessage = 'GPS Eror: Waktu tunggu lokasi habis.'; break;
      }
      this.addNotification('red', errorMessage);
    },
    updateLocationStatus(status, coords = null) {
      const userId = firebase.auth().currentUser.uid;
      const locationRef = firebase.database().ref('location-data/' + userId).child('latest');
      const now = new Date();

      const data = {
        status: status,
        localTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString()
      };
      if (coords) {
        data.lat = coords.latitude;
        data.lng = coords.longitude;
        data.accuracy = coords.accuracy;
      }
      locationRef.set(data);
    }
  }
});
