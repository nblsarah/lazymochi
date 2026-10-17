import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    getDoc,
    getDocs,
    doc,
    collection
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const navAuthArea = document.getElementById("navAuthArea");
const seriesListGrid = document.getElementById("seriesListGrid");

// Filter Groups
const filterStatusGroup = document.getElementById("filterStatusGroup");
const filterSortGroup = document.getElementById("filterSortGroup");
const filterOrderGroup = document.getElementById("filterOrderGroup");

let allNovels = [];

// Filter State
let currentStatus = "all";
let currentSort = "published";
let currentOrder = "desc";

// 1. Auth Setup
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

// 2. Fetch Data Novels
async function loadSeriesList() {
    try {
        const novelsSnap = await getDocs(collection(db, "novels"));

        allNovels = novelsSnap.docs.map(docSnap => {
            const data = docSnap.data();
            
            const publishedTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
            const updatedTime = data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : publishedTime;

            return {
                id: docSnap.id,
                ...data,
                publishedTime: publishedTime,
                updatedTime: updatedTime,
                views: Number(data.views || 0)
            };
        });

        setupFilterClickEvents();
        applyFilterAndRender();
    } catch (err) {
        console.error("Failed to fetch novels:", err);
        seriesListGrid.innerHTML = `<div class="empty-state"><p>Failed to load series list.</p></div>`;
    }
}

// 3. Setup Filter Options Click Listener
function setupFilterClickEvents() {
    filterStatusGroup?.querySelectorAll(".filter-opt").forEach(opt => {
        opt.addEventListener("click", () => {
            filterStatusGroup.querySelectorAll(".filter-opt").forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            currentStatus = opt.dataset.value;
            applyFilterAndRender();
        });
    });

    filterSortGroup?.querySelectorAll(".filter-opt").forEach(opt => {
        opt.addEventListener("click", () => {
            filterSortGroup.querySelectorAll(".filter-opt").forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            currentSort = opt.dataset.value;
            applyFilterAndRender();
        });
    });

    filterOrderGroup?.querySelectorAll(".filter-opt").forEach(opt => {
        opt.addEventListener("click", () => {
            filterOrderGroup.querySelectorAll(".filter-opt").forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            currentOrder = opt.dataset.value;
            applyFilterAndRender();
        });
    });
}

// 4. Filtering and Sorting Logic
function applyFilterAndRender() {
    let filtered = [...allNovels];

    if (currentStatus !== "all") {
        filtered = filtered.filter(n => (n.status || "").toLowerCase() === currentStatus.toLowerCase());
    }

    filtered.sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (currentSort === "published") {
            valA = a.publishedTime;
            valB = b.publishedTime;
        } else if (currentSort === "updated") {
            valA = a.updatedTime;
            valB = b.updatedTime;
        } else if (currentSort === "popular") {
            valA = a.views;
            valB = b.views;
        }

        return currentOrder === "desc" ? valB - valA : valA - valB;
    });

    renderSeriesGrid(filtered);
}

// 5. Render Series Items
function renderSeriesGrid(novels) {
    if (novels.length === 0) {
        seriesListGrid.innerHTML = `
            <div class="empty-state">
                <p>No novels match the selected filters.</p>
            </div>
        `;
        return;
    }

    seriesListGrid.innerHTML = novels.map(n => {
        const coverUrl = n.coverUrl || n.cover || "images/cover-placeholder.jpg";
        const title = n.title || "Untitled Novel";
        const status = n.status || "OnGoing";
        const isOngoing = status.toLowerCase() === "ongoing";
        const synopsis = n.synopsis || "No synopsis available.";

        return `
            <div class="series-item-card">
                <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(title)}" class="series-cover" onerror="this.src='images/cover-placeholder.jpg'">
                <div class="series-content">
                    <a href="novel-detail.html?id=${n.id}" class="series-title">${escapeHTML(title)}</a>
                    <span class="series-status-pill ${isOngoing ? 'ongoing' : ''}">${escapeHTML(status)}</span>
                    <p class="series-synopsis">${escapeHTML(synopsis)}</p>
                </div>
            </div>
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

loadSeriesList();

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