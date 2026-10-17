import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const navAuthArea = document.getElementById("navAuthArea");

onAuthStateChanged(auth, async (user) => {
    renderAuthNavbar(user);
    if (user) {
        const contactEmail = document.getElementById("contactEmail");
        if (contactEmail && !contactEmail.value) {
            contactEmail.value = user.email || "";
        }
    }
});

async function renderAuthNavbar(user) {
    if (!navAuthArea) return;

    if (user) {
        let username = user.displayName || "User";
        let avatarUrl = user.photoURL || "images/avatar.png";
        let isAdmin = false;

        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                username = data.username || username;
                avatarUrl = data.photoURL || avatarUrl;
                isAdmin = data.role === "admin";
            }
        } catch (err) {
            console.error("Gagal memuat profil navbar:", err);
        }

        navAuthArea.innerHTML = `
            <div class="user-dropdown-wrapper">
                <button type="button" class="user-dropdown-btn" id="userDropdownBtn">
                    <img src="${avatarUrl}" alt="${username}" onerror="this.src='images/avatar.png'">
                    <span>${escapeHTML(username)}</span>
                    <small style="font-size: 10px; opacity: 0.7;">▼</small>
                </button>
                <div class="user-dropdown-menu" id="userDropdownMenu">
                    <a href="bookmarks.html">❤️ My Bookmarks</a>
                    ${isAdmin ? `<a href="admin/index.html" style="color: #f59e0b;">⚙️ Admin Panel</a>` : ""}
                    <button type="button" id="publicLogoutBtn">🚪 Logout</button>
                </div>
            </div>
        `;

        document.getElementById("userDropdownBtn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            document.getElementById("userDropdownMenu")?.classList.toggle("show");
        });

        document.addEventListener("click", () => {
            document.getElementById("userDropdownMenu")?.classList.remove("show");
        });

        document.getElementById("publicLogoutBtn")?.addEventListener("click", async () => {
            await signOut(auth);
            window.location.reload();
        });
    } else {
        navAuthArea.innerHTML = `
            <div class="auth-btn-group">
                <a href="login.html" class="btn-login">Login</a>
                <a href="register.html" class="btn-register">Register</a>
            </div>
        `;
    }
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}