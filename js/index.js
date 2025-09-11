const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

/**
 * Helper: slice tokens into chunks of 500 and send FCM multicast.
 * Returns an object with successCount & failureCount totals.
 */
async function sendFcmMulticast(tokens, title, body, imageUrl) {
    const CHUNK = 500;
    let success = 0, failure = 0;

    for (let i = 0; i < tokens.length; i += CHUNK) {
        const chunk = tokens.slice(i, i + CHUNK);
        const message = {
            tokens: chunk,
            notification: { title, body: body.substring(0, 180), image: imageUrl || undefined },
            data: { imageUrl: imageUrl || "" }
        };
        const result = await admin.messaging().sendMulticast(message);
        success += result.successCount || 0;
        failure += result.failureCount || 0;
    }

    return { success, failure };
}

/**
 * 1️⃣ Scheduled broadcast at 08:00 Mon/Wed/Fri
 */
exports.weeklyBroadcast = functions.pubsub
    .schedule("0 8 * * 1,3,5")      // 08:00 on Mon/Wed/Fri
    .timeZone("Africa/Accra")       // GMT+0
    .onRun(async () => {
        const jsDay = new Date().getDay();       // 0=Sun…6=Sat
        const today = jsDay === 0 ? 7 : jsDay;    // convert to 1=Mon…7=Sun

        console.log(`📅 Running scheduled broadcast for day ${today}`);

        // 1) Load all active broadcasts for today
        const bcSnap = await admin.firestore()
            .collection("broadcasts")
            .where("active", "==", true)
            .where("days", "array-contains", today)
            .get();

        if (bcSnap.empty) {
            console.log("📭 No active broadcasts today.");
            return null;
        }

        // 2) Load all opted-in buyers' tokens
        const buyersSnap = await admin.firestore()
            .collection("buyers")
            .where("allowNotifications", "==", true)
            .get();

        const tokens = buyersSnap.docs
            .map(d => d.data().fcmToken)
            .filter(t => typeof t === "string" && t);

        if (!tokens.length) {
            console.log("📭 No buyer tokens available.");
            return null;
        }

        // 3) Send each broadcast to every token
        let totalSuccess = 0, totalFailure = 0;
        for (const doc of bcSnap.docs) {
            const data = doc.data();
            const text = (data.text || "").toString();
            const imageUrl = (data.imageUrl || "").toString();

            const { success, failure } =
                await sendFcmMulticast(tokens, "Capital Print", text, imageUrl);

            totalSuccess += success;
            totalFailure += failure;
        }

        console.log(`✅ Scheduled Broadcast done. Success: ${totalSuccess}, Failure: ${totalFailure}`);
        return null;
    });


/**
 * 2️⃣ HTTP endpoint for on-demand broadcasts
 *    POST body: { broadcastId, text?, imageUrl? }
 */
exports.sendBroadcast = functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            return res.status(204).send("");
        }
        if (req.method !== "POST") {
            return res.status(405).send("Method Not Allowed");
        }

        const { broadcastId, text: ovText = "", imageUrl: ovImage = "" } = req.body || {};
        if (!broadcastId) {
            return res.status(400).json({ error: "Missing broadcastId" });
        }

        // Fetch the broadcast document
        const bRef = admin.firestore().collection("broadcasts").doc(broadcastId);
        const bSnap = await bRef.get();
        if (!bSnap.exists) {
            return res.status(404).json({ error: `Broadcast ${broadcastId} not found` });
        }
        const b = bSnap.data() || {};
        const text = ovText || b.text || "";
        const imageUrl = ovImage || b.imageUrl || "";

        // Load all opted-in buyer tokens
        const buyersSnap = await admin.firestore()
            .collection("buyers")
            .where("allowNotifications", "==", true)
            .get();

        const tokens = buyersSnap.docs
            .map(d => d.data().fcmToken)
            .filter(t => typeof t === "string" && t);

        if (!tokens.length) {
            return res.json({
                warning: "No buyer tokens available",
                successCount: 0,
                failureCount: 0
            });
        }

        // Send and report
        const { success, failure } =
            await sendFcmMulticast(tokens, "Capital Print", text, imageUrl);

        return res.json({ successCount: success, failureCount: failure });
    });
});


/**
 * 3️⃣ Firestore-trigger for manual resend requests
 *    Write a doc to `resendRequests/{id}` with { broadcastId, text?, imageUrl? }
 */
exports.resendBroadcastOnDemand = functions.firestore
    .document("resendRequests/{requestId}")
    .onCreate(async (snap, context) => {
        const req = snap.data() || {};
        const reqRef = snap.ref;
        const bid = (req.broadcastId || "").toString();

        if (!bid) {
            await reqRef.update({
                status: "error",
                error: "Missing broadcastId",
                finishedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }

        // Fetch broadcast
        const bSnap = await admin.firestore()
            .collection("broadcasts")
            .doc(bid)
            .get();

        if (!bSnap.exists) {
            await reqRef.update({
                status: "error",
                error: `Broadcast ${bid} not found`,
                finishedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }

        const b = bSnap.data() || {};
        const text = (req.text || b.text || "").toString();
        const imageUrl = (req.imageUrl || b.imageUrl || "").toString();

        // Load tokens
        const buyersSnap = await admin.firestore()
            .collection("buyers")
            .where("allowNotifications", "==", true)
            .get();

        const tokens = buyersSnap.docs
            .map(d => d.data().fcmToken)
            .filter(t => typeof t === "string" && t);

        // If none, finish early with warning
        if (!tokens.length) {
            await reqRef.update({
                status: "done",
                warning: "No buyer tokens available",
                successCount: 0,
                failureCount: 0,
                finishedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }

        // Send in chunks
        const { success, failure } =
            await sendFcmMulticast(tokens, "Capital Print", text, imageUrl);

        // Mark request done
        await reqRef.update({
            status: "done",
            successCount: success,
            failureCount: failure,
            finishedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`📤 Manual resend done. Success: ${success}, Failure: ${failure}`);
        return null;
    });