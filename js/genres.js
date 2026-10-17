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
const genrePillsList = document.getElementById("genrePillsList");
const genreNovelsGrid = document.getElementById("genreNovelsGrid");
const selectedGenreTitle = document.getElementById("selectedGenreTitle");
const novelCountLabel = document.getElementById("novelCountLabel");

let allNovels = [];
let allGenres = [];
let selectedGenre = "all";

// 1. Auth Observer & Navbar Setup
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

// 2. Fetch Data (Genres, Novels, Chapters & Ratings)
async function initPage() {
    await fetchGenres();
    await fetchNovels();
    
    // Check if genre parameter exists in URL (e.g. genres.html?name=Fantasy)
    const params = new URLSearchParams(window.location.search);
    const urlGenre = params.get("name");
    if (urlGenre) {
        selectedGenre = urlGenre;
    }

    renderGenrePills();
    filterAndRenderNovels();
}

async function fetchGenres() {
    try {
        const snap = await getDocs(collection(db, "genres"));
        allGenres = [];
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.name) allGenres.push(data.name);
        });
        allGenres.sort((a, b) => a.localeCompare(b));
    } catch (err) {
        console.error("Failed to load genres:", err);
    }
}

async function fetchNovels() {
    try {
        const [novelsSnap, chaptersSnap, ratingsSnap] = await Promise.all([
            getDocs(collection(db, "novels")),
            getDocs(collection(db, "chapters")),
            getDocs(collection(db, "ratings"))
        ]);

        // Chapter Count
        const chapterCounts = {};
        chaptersSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.novelId) {
                chapterCounts[data.novelId] = (chapterCounts[data.novelId] || 0) + 1;
            }
        });

        // Rating Stats
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

            let computedRating = "0.0";
            if (ratingStats[nId] && ratingStats[nId].count > 0) {
                computedRating = (ratingStats[nId].totalScore / ratingStats[nId].count).toFixed(1);
            } else if (data.rating) {
                computedRating = Number(data.rating).toFixed(1);
            }

            return {
                id: nId,
                ...data,
                chapterCount: chapterCounts[nId] || 0,
                rating: computedRating
            };
        });
    } catch (err) {
        console.error("Failed to load novels:", err);
    }
}

// 3. Render Genre Pills & Attach Handlers
function renderGenrePills() {
    const pillsHTML = `
        <span class="genre-pill ${selectedGenre === 'all' ? 'active' : ''}" data-genre="all">All Genres</span>
        ${allGenres.map(g => `
            <span class="genre-pill ${selectedGenre.toLowerCase() === g.toLowerCase() ? 'active' : ''}" data-genre="${escapeHTML(g)}">
                ${escapeHTML(g)}
            </span>
        `).join("")}
    `;

    genrePillsList.innerHTML = pillsHTML;

    // Attach click events
    genrePillsList.querySelectorAll(".genre-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            genrePillsList.querySelectorAll(".genre-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            selectedGenre = pill.dataset.genre;
            filterAndRenderNovels();
        });
    });
}

// 4. Filter Novels by Selected Genre & Render
function filterAndRenderNovels() {
    let filtered = [];

    if (selectedGenre === "all") {
        filtered = [...allNovels];
        selectedGenreTitle.textContent = "All Novels";
    } else {
        filtered = allNovels.filter(n => {
            const genresArr = Array.isArray(n.genres) 
                ? n.genres.map(g => g.toLowerCase()) 
                : [(n.genre || "").toLowerCase()];
            return genresArr.includes(selectedGenre.toLowerCase());
        });
        selectedGenreTitle.textContent = `Genre: ${selectedGenre}`;
    }

    novelCountLabel.textContent = `${filtered.length} novel${filtered.length === 1 ? '' : 's'} found`;

    if (filtered.length === 0) {
        genreNovelsGrid.innerHTML = `
            <div class="empty-state">
                <p>No novels found in this genre.</p>
            </div>
        `;
        return;
    }

    genreNovelsGrid.innerHTML = filtered.map(novel => {
        const coverUrl = novel.coverUrl || novel.cover || "images/cover-placeholder.jpg";
        const title = novel.title || "Untitled Novel";
        const status = novel.status || "Ongoing";
        const rating = novel.rating || "0.0";
        const chapterCount = novel.chapterCount || 0;
        const genres = Array.isArray(novel.genres) ? novel.genres.join(", ") : (novel.genre || "Fantasy");

        return `
            <a href="novel-detail.html?id=${novel.id}" class="novel-card">
                <div class="cover-wrapper">
                    <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(title)}" onerror="this.src='images/cover-placeholder.jpg'">
                    <span class="badge-status ${escapeHTML(status)}">${escapeHTML(status)}</span>
                    <span class="badge-rating">★ ${rating}</span>
                </div>
                <h3 class="novel-title">${escapeHTML(title)}</h3>
                <div class="novel-meta">
                    <p style="margin: 0 0 4px 0;">Genre: ${escapeHTML(genres)}</p>
                    <p style="margin: 0;">Chapters: ${chapterCount}</p>
                </div>
            </a>
        `;
    }).join("");
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

initPage();

// Global Handler untuk Mobile Nav Toggle
const mobileNavToggle = document.getElementById("mobileNavToggle");
const navLinks = document.getElementById("navLinks");

mobileNavToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks?.classList.toggle("show");
});

document.addEventListener("click", (e) => {
    if (!mobileNavToggle?.contains(e.target) && !navLinks?.contains(e.target)) {
        navLinks?.classList.remove("show");
    }
});