const messaging = firebase.messaging();

window.firebaseMessaging = {
    requestPermissionAndGetToken: async () => {
        try {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
                console.warn("Notification permission not granted.");
                return null;
            }

            const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
            const token = await messaging.getToken({ serviceWorkerRegistration: reg });

            console.log("✅ FCM token acquired:", token);
            return token || null;
        } catch (err) {
            console.error("FCM token error:", err);
            return null;
        }
    },

    onMessageCallback: null,

    initializeOnMessage: () => {
        messaging.onMessage(payload => {
            if (window.firebaseMessaging.onMessageCallback) {
                window.firebaseMessaging.onMessageCallback(payload);
            }
        });
    }
};