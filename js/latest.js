import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const navAuthArea = document.getElementById("navAuthArea");
const latestChaptersGrid = document.getElementById("latestChaptersGrid");

// 1. Auth Check & Header Setup
onAuthStateChanged(auth, async (user) => {
    renderAuthNavbar(user);
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
            console.error("Failed to load profile navbar:", err);
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

// 2. Fetch Latest Chapters & Novel Metadata
async function loadLatestReleases() {
    try {
        const [chaptersSnap, novelsSnap] = await Promise.all([
            getDocs(collection(db, "chapters")),
            getDocs(collection(db, "novels"))
        ]);

        if (chaptersSnap.empty) {
            latestChaptersGrid.innerHTML = `
                <div class="empty-state">
                    <p>No chapters available yet.</p>
                </div>
            `;
            return;
        }

        // Map Novel Data
        const novelsMap = {};
        novelsSnap.docs.forEach((docSnap) => {
            novelsMap[docSnap.id] = docSnap.data();
        });

        // Collect Chapters & Associate Novel Info
        const chaptersList = [];
        chaptersSnap.docs.forEach((d) => {
            const data = d.data();
            const novel = novelsMap[data.novelId] || {};

            const dateVal = data.publishedAt || data.createdAt;
            const timestamp = dateVal 
                ? (dateVal.toDate ? dateVal.toDate().getTime() : new Date(dateVal).getTime())
                : 0;

            chaptersList.push({
                chapterId: d.id,
                chapterNumber: data.chapterNumber || 0,
                chapterTitle: data.title || "",
                timestamp: timestamp,
                novelId: data.novelId,
                novelTitle: novel.title || "Untitled Novel",
                coverUrl: novel.coverUrl || novel.cover || "images/cover-placeholder.jpg"
            });
        });

        // Sort Chapters by Newest Timestamp
        chaptersList.sort((a, b) => b.timestamp - a.timestamp);

        renderLatestGrid(chaptersList);
    } catch (error) {
        console.error("Failed to load latest releases:", error);
        latestChaptersGrid.innerHTML = `
            <div class="empty-state">
                <p style="color: #ef4444;">Failed to load latest releases. Please try again later.</p>
            </div>
        `;
    }
}

// 3. Render Items to Grid
function renderLatestGrid(chapters) {
    latestChaptersGrid.innerHTML = chapters.map((ch) => {
        const chNum = ch.chapterNumber ? `Ch. ${ch.chapterNumber}` : "Chapter";
        const chDisplayTitle = ch.chapterTitle ? `${chNum}: ${ch.chapterTitle}` : chNum;
        const timeAgoStr = timeAgo(ch.timestamp);

        return `
            <div class="latest-card">
                <div class="cover-thumb">
                    <img src="${escapeHTML(ch.coverUrl)}" alt="${escapeHTML(ch.novelTitle)}" onerror="this.src='images/cover-placeholder.jpg'">
                </div>
                <div class="card-details">
                    <div>
                        <a href="novel-detail.html?id=${ch.novelId}" class="novel-title-link">${escapeHTML(ch.novelTitle)}</a>
                        <span class="time-badge">🕒 ${timeAgoStr}</span>
                    </div>
                    <a href="read-chapter.html?id=${ch.chapterId}" class="chapter-tag">
                        <span>${escapeHTML(chDisplayTitle)}</span>
                        <span>→</span>
                    </a>
                </div>
            </div>
        `;
    }).join("");
}

// Relative Time Formatter
function timeAgo(timestamp) {
    if (!timestamp) return "-";
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - timestamp) / 1000);

    if (elapsedSeconds < 60) return "Just now";
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

loadLatestReleases();