import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    deleteDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const navAuthArea = document.getElementById("navAuthArea");
const bookmarksGrid = document.getElementById("bookmarksGrid");

let currentUser = null;

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    renderAuthNavbar(user);

    if (user) {
        loadUserBookmarks(user.uid);
    } else {
        renderLoginPrompt();
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
            console.error("Failed to load navbar profile:", err);
        }

        navAuthArea.innerHTML = `
            <div class="user-dropdown-wrapper">
                <button type="button" class="user-dropdown-btn" id="userDropdownBtn">
                    <img src="${avatarUrl}" alt="${username}" onerror="this.src='images/avatar.png'">
                    <span>${escapeHTML(username)}</span>
                    <small>▼</small>
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

function renderLoginPrompt() {
    bookmarksGrid.innerHTML = `
        <div class="empty-state">
            <h3>Please Log In</h3>
            <p>You need to be logged in to view your bookmarked novels.</p>
            <a href="login.html" class="btn-explore">Log In Now</a>
        </div>
    `;
}

// Fetch & Render Bookmarks
async function loadUserBookmarks(userId) {
    try {
        const q = query(
            collection(db, "bookmarks"),
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            bookmarksGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No Bookmarks Yet</h3>
                    <p>Explore our library and save your favorite novels here.</p>
                    <a href="novels.html" class="btn-explore">Explore Novels</a>
                </div>
            `;
            return;
        }

        const bookmarkDocs = snapshot.docs;
        const novelFetchPromises = bookmarkDocs.map(async (bDoc) => {
            const bData = bDoc.data();
            const novelSnap = await getDoc(doc(db, "novels", bData.novelId));
            
            if (novelSnap.exists()) {
                return {
                    bookmarkDocId: bDoc.id,
                    novelId: novelSnap.id,
                    ...novelSnap.data()
                };
            }
            return null;
        });

        const novelList = (await Promise.all(novelFetchPromises)).filter(item => item !== null);

        if (novelList.length === 0) {
            bookmarksGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No Bookmarks Found</h3>
                    <p>Your saved novels are no longer available.</p>
                    <a href="novels.html" class="btn-explore">Explore Novels</a>
                </div>
            `;
            return;
        }

        renderBookmarkGrid(novelList);
    } catch (error) {
        console.error("Failed to fetch bookmarks:", error);
        bookmarksGrid.innerHTML = `
            <div class="empty-state">
                <p style="color: #ef4444;">Failed to load bookmarks. Please try again later.</p>
            </div>
        `;
    }
}

function renderBookmarkGrid(novels) {
    bookmarksGrid.innerHTML = novels.map(n => {
        const title = escapeHTML(n.title || "Untitled Novel");
        const cover = n.coverUrl || n.cover || "images/cover-placeholder.jpg";
        const author = escapeHTML(n.author || "Unknown");
        const status = escapeHTML(n.status || "Ongoing");

        return `
            <div class="bookmark-card" id="card-${n.bookmarkDocId}">
                <div class="cover-wrapper">
                    <img src="${cover}" alt="${title}" onerror="this.src='images/cover-placeholder.jpg'">
                </div>
                <div class="card-info">
                    <a href="novel-detail.html?id=${n.novelId}" class="card-title">${title}</a>
                    <div class="card-meta">By ${author} • ${status}</div>
                    <div class="card-actions">
                        <a href="novel-detail.html?id=${n.novelId}" class="btn-read">Read Details</a>
                        <button type="button" class="btn-remove" data-id="${n.bookmarkDocId}" data-novel="${n.novelId}" title="Remove Bookmark">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Event Listener for Delete Buttons
    bookmarksGrid.querySelectorAll(".btn-remove").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const bId = btn.dataset.id;
            const nId = btn.dataset.novel;
            await removeBookmark(bId, nId);
        });
    });
}

// Remove Bookmark Function
async function removeBookmark(bookmarkDocId, novelId) {
    if (!confirm("Remove this novel from your bookmarks?")) return;

    try {
        await deleteDoc(doc(db, "bookmarks", bookmarkDocId));
        
        // Decrement bookmark count in novel document
        if (novelId) {
            try {
                await updateDoc(doc(db, "novels", novelId), {
                    bookmarkCount: increment(-1)
                });
            } catch (err) {
                console.warn("Failed to decrement novel bookmark count:", err);
            }
        }

        // Remove card element from UI
        const cardElem = document.getElementById(`card-${bookmarkDocId}`);
        if (cardElem) {
            cardElem.remove();
        }

        // Check if grid is now empty
        if (bookmarksGrid.children.length === 0) {
            bookmarksGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No Bookmarks Yet</h3>
                    <p>Explore our library and save your favorite novels here.</p>
                    <a href="novels.html" class="btn-explore">Explore Novels</a>
                </div>
            `;
        }
    } catch (error) {
        console.error("Failed to remove bookmark:", error);
        alert("Failed to remove bookmark: " + error.message);
    }
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

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