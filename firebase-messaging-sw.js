importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Prevent redeclaration
if (!self.firebaseInitialized) {
    firebase.initializeApp({
        apiKey: "AIzaSyBtewI5NTZxkpmFmEbpk16Y_EVtfHedux0",
        authDomain: "bossystem-8c9e9.firebaseapp.com",
        projectId: "bossystem-8c9e9",
        messagingSenderId: "602083116207",
        appId: "1:602083116207:web:1d30f343eae5e0cc7dc05a"
    });

    self.messaging = firebase.messaging();
    self.firebaseInitialized = true;

    self.messaging.onBackgroundMessage(payload => {
        console.log("📩 Background message received:", payload);

        const notification = payload.notification || {};
        const data = payload.data || {};

        const title = notification.title || "Capital Print";
        const body = notification.body || "You have a new message.";
        const image = notification.image || data.imageUrl || "";
        const icon = "/icon-192.png";

        const options = {
            body,
            icon,
            image,
            data
        };

        self.registration.showNotification(title, options);
    });
}
