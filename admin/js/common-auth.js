import { auth, db } from "../../firebase/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Mengupdate avatar dan nama admin di topbar secara global
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();

            // 1. Update elemen nama admin di topbar
            const adminNameElem = document.getElementById("adminName");
            if (adminNameElem) {
                adminNameElem.textContent = data.username || user.displayName || "Admin";
            }

            // 2. Update elemen avatar admin di topbar
            const profileDiv = document.querySelector(".topbar .profile img");
            if (profileDiv) {
                const photo = data.photoURL || user.photoURL || "../images/avatar.png";
                profileDiv.src = photo;
            }
        }
    } catch (error) {
        console.error("Gagal memuat profil header:", error);
    }
});

// Event Handler Logout Global
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "../login.html";
    } catch (error) {
        console.error("Gagal logout:", error);
    }
});