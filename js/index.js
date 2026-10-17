import { auth, db } from "../firebase/firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements - Catalog Grids
const mainCatalogGrid = document.getElementById("mainCatalogGrid");
const newSeriesGrid = document.getElementById("newSeriesGrid");
const completedSeriesGrid = document.getElementById("completedSeriesGrid");
const latestUpdatesGrid = document.getElementById("latestUpdatesGrid");

// DOM Elements - Filters
const searchInput = document.getElementById("publicSearchInput");
const genreSelect = document.getElementById("genreSelect");
const statusSelect = document.getElementById("statusSelect");
const sortSelect = document.getElementById("sortSelect");

// DOM Element - Navbar Auth Area
const navAuthArea = document.getElementById("navAuthArea");

let allNovels = [];

// ==========================================
// 1. AUTH STATE & NAVBAR DROPDOWN LOGIC
// ==========================================
onAuthStateChanged(auth, async (user) => {
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
            console.error("Failed to fetch user profile:", err);
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

        const dropdownBtn = document.getElementById("userDropdownBtn");
        const dropdownMenu = document.getElementById("userDropdownMenu");

        dropdownBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu?.classList.toggle("show");
        });

        document.addEventListener("click", () => {
            dropdownMenu?.classList.remove("show");
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
});

// ==========================================
// 2. FETCH DATA NOVEL, CHAPTERS & RATINGS
// ==========================================
async function initPage() {
    await fetchNovelsWithActualChapters();
    await fetchGenresFilter();
    renderSpecialSections();
    applyFilters();
}

async function fetchNovelsWithActualChapters() {
    try {
        const [novelsSnap, chaptersSnap, ratingsSnap] = await Promise.all([
            getDocs(collection(db, "novels")),
            getDocs(collection(db, "chapters")),
            getDocs(collection(db, "ratings"))
        ]);

        // Cari chapter terbanyak & terbarunya timestamp per novelId
        const chapterCounts = {};
        const latestChapterTime = {};

        chaptersSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.novelId) {
                chapterCounts[data.novelId] = (chapterCounts[data.novelId] || 0) + 1;

                // Ambil tanggal rilis/pembuatan chapter terbaru
                const chDate = data.publishedAt || data.createdAt;
                if (chDate) {
                    const timeMs = chDate.toDate ? chDate.toDate().getTime() : new Date(chDate).getTime();
                    if (!latestChapterTime[data.novelId] || timeMs > latestChapterTime[data.novelId]) {
                        latestChapterTime[data.novelId] = timeMs;
                    }
                }
            }
        });

        // Hitung rating
        const ratingStats = {};
        ratingsSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.novelId) {
                if (!ratingStats[data.novelId]) {
                    ratingStats[data.novelId] = { totalScore: 0, count: 0 };
                }
                ratingStats[data.novelId].totalScore += Number(data.rating || 0);
                ratingStats[data.novelId].count += 1;
            }
        });

        allNovels = novelsSnap.docs.map(docSnap => {
            const data = docSnap.data();
            const nId = docSnap.id;

            let computedRating = null;
            if (ratingStats[nId] && ratingStats[nId].count > 0) {
                computedRating = (ratingStats[nId].totalScore / ratingStats[nId].count).toFixed(1);
            } else if (data.rating) {
                computedRating = Number(data.rating).toFixed(1);
            }

            // Fallback timestamp: dari chapter terbaru -> novel updatedAt -> novel createdAt
            const lastUpdatedTime = latestChapterTime[nId] 
                || (data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : null)
                || (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : null);

            return {
                id: nId,
                ...data,
                chapterCount: chapterCounts[nId] || 0,
                rating: computedRating,
                lastUpdatedTime: lastUpdatedTime
            };
        });
    } catch (error) {
        console.error("Gagal memuat catalog novel:", error);
    }
}

async function fetchGenresFilter() {
    try {
        const snapshot = await getDocs(collection(db, "genres"));
        const genreList = [];

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.name) genreList.push(data.name);
        });

        genreList.sort((a, b) => a.localeCompare(b));

        genreList.forEach(genreName => {
            const option = document.createElement("option");
            option.value = genreName;
            option.textContent = genreName;
            genreSelect?.appendChild(option);
        });
    } catch (err) {
        console.error("Gagal memuat genre filter:", err);
    }
}

// ==========================================
// 3. CARD TEMPLATE & SECTION RENDERING
// ==========================================
function createNovelCardHTML(novel, showTimestamp = false) {
    const coverUrl = novel.coverUrl || novel.cover || "images/cover-placeholder.jpg";
    const title = novel.title || "Untitled Novel";
    const status = novel.status || "Ongoing";
    const rating = novel.rating || "0.0";
    const chapterCount = novel.chapterCount || 0;
    const genres = Array.isArray(novel.genres) ? novel.genres.join(", ") : (novel.genre || "Fantasy");
    
    // Time ago formatted string
    const updatedStr = novel.lastUpdatedTime ? timeAgo(novel.lastUpdatedTime) : "Recently";

    return `
        <a href="novel-detail.html?id=${novel.id}" class="novel-card">
            <div class="cover-wrapper">
                <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(title)}" onerror="this.src='images/cover-placeholder.jpg'">
                <span class="badge-status ${escapeHTML(status)}">${escapeHTML(status)}</span>
                <span class="badge-rating">★ ${rating}</span>
            </div>
            <h3 class="novel-title">${escapeHTML(title)}</h3>
            <div class="novel-meta">
                <p style="margin: 0 0 4px 0; color: #9e9ea7;">Genre: ${escapeHTML(genres)}</p>
                <p style="margin: 0 0 4px 0; color: #9e9ea7;">Chapters: ${chapterCount}</p>
                ${showTimestamp ? `<p style="margin: 0; color: #f59e0b; font-size: 11px; font-weight: 500;">🕒 ${updatedStr}</p>` : ''}
            </div>
        </a>
    `;
}

function renderSpecialSections() {
    // 1. New Series (5 Novel Terbaru)
    const newSeries = [...allNovels]
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5);
    if (newSeriesGrid) newSeriesGrid.innerHTML = newSeries.map(n => createNovelCardHTML(n, false)).join("");

    // 2. Completed Series (5 Novel Status Completed)
    const completedSeries = allNovels
        .filter(n => (n.status || "").toLowerCase() === "completed")
        .slice(0, 5);
    if (completedSeriesGrid) completedSeriesGrid.innerHTML = completedSeries.map(n => createNovelCardHTML(n, false)).join("");

    // 3. Latest Updates (Diurutkan berdasarkan timestamp update paling baru + TAMPILKAN TIMESTAMP)
    const latestUpdates = [...allNovels]
        .sort((a, b) => (b.lastUpdatedTime || 0) - (a.lastUpdatedTime || 0))
        .slice(0, 5);
    if (latestUpdatesGrid) latestUpdatesGrid.innerHTML = latestUpdates.map(n => createNovelCardHTML(n, true)).join("");
}

// ==========================================
// 4. FILTERING & SEARCH HANDLER
// ==========================================
function applyFilters() {
    const searchVal = (searchInput?.value || "").toLowerCase().trim();
    const genreVal = genreSelect?.value || "";
    const statusVal = statusSelect?.value || "";
    const sortVal = sortSelect?.value || "popular";

    let filtered = allNovels.filter(n => {
        const titleMatch = (n.title || "").toLowerCase().includes(searchVal) || (n.author || "").toLowerCase().includes(searchVal);
        const gList = Array.isArray(n.genres) ? n.genres : [n.genre];
        const genreMatch = !genreVal || gList.includes(genreVal);
        const statusMatch = !statusVal || (n.status || "").toLowerCase() === statusVal.toLowerCase();

        return titleMatch && genreMatch && statusMatch;
    });

    if (sortVal === "newest") {
        filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } else if (sortVal === "rating") {
        filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else {
        filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    if (mainCatalogGrid) {
        if (filtered.length === 0) {
            mainCatalogGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #777; padding: 24px;">No novels found matching filters.</p>`;
        } else {
            mainCatalogGrid.innerHTML = filtered.slice(0, 10).map(n => createNovelCardHTML(n, false)).join("");
        }
    }
}

// Fungsi Pembantu Konversi Ke "Time Ago"
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

searchInput?.addEventListener("input", applyFilters);
genreSelect?.addEventListener("change", applyFilters);
statusSelect?.addEventListener("change", applyFilters);
sortSelect?.addEventListener("change", applyFilters);

initPage();