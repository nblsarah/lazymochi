import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    addDoc,
    deleteDoc,
    updateDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const navAuthArea = document.getElementById("navAuthArea");
const breadcrumbTitle = document.getElementById("breadcrumbTitle");
const novelCoverImg = document.getElementById("novelCoverImg");
const novelTitle = document.getElementById("novelTitle");
const novelAltTitle = document.getElementById("novelAltTitle");

const novelStatusPill = document.getElementById("novelStatusPill");
const novelAuthorPill = document.getElementById("novelAuthorPill");
const novelLangPill = document.getElementById("novelLangPill");
const novelYearPill = document.getElementById("novelYearPill");

const statChapterCount = document.getElementById("statChapterCount");
const statViews = document.getElementById("statViews");
const statBookmarks = document.getElementById("statBookmarks");
const statRating = document.getElementById("statRating");

// Rating Elements
const starRatingGroup = document.getElementById("starRatingGroup");
const userRatingStatus = document.getElementById("userRatingStatus");

const genresList = document.getElementById("genresList");
const novelSynopsis = document.getElementById("novelSynopsis");
const btnStartReading = document.getElementById("btnStartReading");
const btnBookmark = document.getElementById("btnBookmark");

const totalChaptersLabel = document.getElementById("totalChaptersLabel");
const chapterSearchInput = document.getElementById("chapterSearchInput");
const btnToggleSort = document.getElementById("btnToggleSort");
const chapterListGrid = document.getElementById("chapterListGrid");

// URL Params
const params = new URLSearchParams(window.location.search);
const novelId = params.get("id");

let currentUser = null;
let currentNovel = null;
let chapters = [];
let isBookmarked = false;
let bookmarkDocId = null;
let isAscending = false;

// Rating State
let userRatingValue = 0;
let ratingDocId = null;

if (!novelId) {
    alert("Novel ID not found!");
    window.location.href = "novels.html";
}

// 1. Auth Check & Header Setup
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    renderAuthNavbar(user);
    if (user && novelId) {
        checkBookmarkState();
        checkUserRating();
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
            console.error("Failed to load profile navbar:", err);
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

// 2. Fetch Novel Details & Accumulate Ratings
async function loadNovelDetail() {
    try {
        const novelRef = doc(db, "novels", novelId);
        const novelSnap = await getDoc(novelRef);

        if (!novelSnap.exists()) {
            alert("Novel not found!");
            window.location.href = "novels.html";
            return;
        }

        currentNovel = { id: novelSnap.id, ...novelSnap.data() };

        try {
            await updateDoc(novelRef, { views: increment(1) });
        } catch (e) {
            console.warn("Failed to increment views:", e);
        }

        renderNovelInfo();
        await loadNovelRatings();
        await loadChapters();
    } catch (error) {
        console.error("Failed to load novel details:", error);
    }
}

// Calculate Average Rating
async function loadNovelRatings() {
    try {
        const q = query(
            collection(db, "ratings"),
            where("novelId", "==", novelId)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if (statRating) {
                statRating.innerHTML = `★ 0.0 <small style="font-size: 11px; color: #888;">(0 reviews)</small>`;
            }
            return;
        }

        let totalScore = 0;
        const totalReviews = snapshot.size;

        snapshot.docs.forEach((d) => {
            totalScore += Number(d.data().rating || 0);
        });

        const avgRating = (totalScore / totalReviews).toFixed(1);

        if (statRating) {
            statRating.innerHTML = `★ ${avgRating} <small style="font-size: 11px; color: #888;">(${totalReviews} reviews)</small>`;
        }
    } catch (error) {
        console.error("Failed to calculate average rating:", error);
    }
}

// Check If User Has Already Rated
async function checkUserRating() {
    if (!currentUser) return;

    try {
        const q = query(
            collection(db, "ratings"),
            where("userId", "==", currentUser.uid),
            where("novelId", "==", novelId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docData = snapshot.docs[0];
            ratingDocId = docData.id;
            userRatingValue = Number(docData.data().rating || 0);

            highlightStars(userRatingValue, "selected");
            if (userRatingStatus) {
                userRatingStatus.textContent = `Your Rating: ${userRatingValue} / 5 stars (Click to edit)`;
            }
        }
    } catch (error) {
        console.error("Failed to check user rating:", error);
    }
}

// Star Highlighting
function highlightStars(count, className = "hovered") {
    if (!starRatingGroup) return;
    const stars = starRatingGroup.querySelectorAll("span");

    stars.forEach((star) => {
        const val = Number(star.dataset.value);
        if (val <= count) {
            star.classList.add(className);
        } else {
            star.classList.remove(className);
        }
    });
}

function clearStarHighlights() {
    if (!starRatingGroup) return;
    const stars = starRatingGroup.querySelectorAll("span");
    stars.forEach((star) => {
        star.classList.remove("hovered");
    });
    highlightStars(userRatingValue, "selected");
}

// Event Listeners Interaksi Bintang
starRatingGroup?.querySelectorAll("span").forEach((star) => {
    star.addEventListener("mouseenter", () => {
        // Jangan tampilkan efek hover jika user sudah pernah memberi rating
        if (ratingDocId) return; 

        const val = Number(star.dataset.value);
        highlightStars(val, "hovered");
    });

    star.addEventListener("mouseleave", () => {
        clearStarHighlights();
    });

    star.addEventListener("click", async () => {
        if (!currentUser) {
            alert("Please log in to leave a rating!");
            window.location.href = "login.html";
            return;
        }

        // KUNCI: Jika user sudah punya ratingDocId, batalkan dan beri peringatan
        if (ratingDocId) {
            alert("You have already submitted a rating for this novel and cannot change it.");
            return;
        }

        const selectedRating = Number(star.dataset.value);

        try {
            // Buat data rating baru di collection "ratings"
            const newDoc = await addDoc(collection(db, "ratings"), {
                novelId: novelId,
                userId: currentUser.uid,
                rating: selectedRating,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            ratingDocId = newDoc.id;
            userRatingValue = selectedRating;
            
            highlightStars(userRatingValue, "selected");

            if (userRatingStatus) {
                userRatingStatus.textContent = `Your Rating: ${userRatingValue} / 5 stars (Submitted)`;
            }

            await loadNovelRatings();
            alert("Thank you for your rating!");
        } catch (err) {
            console.error("Failed to save rating:", err);
            alert("Failed to save rating: " + err.message);
        }
    });
});

function renderNovelInfo() {
    const title = currentNovel.title || "Untitled Novel";
    breadcrumbTitle.textContent = title;
    document.title = `${title} | Lazy Mochi`;

    novelTitle.textContent = title;
    novelAltTitle.textContent = currentNovel.alternativeTitle ? `Alt: ${currentNovel.alternativeTitle}` : "";
    novelCoverImg.src = currentNovel.coverUrl || currentNovel.cover || "images/cover-placeholder.jpg";

    const status = currentNovel.status || "Ongoing";
    novelStatusPill.textContent = status;
    novelStatusPill.className = `meta-pill status-${status.toLowerCase()}`;

    novelAuthorPill.textContent = `Author: ${currentNovel.author || "Unknown"}`;
    novelLangPill.textContent = `Language: ${currentNovel.language || "-"}`;
    novelYearPill.textContent = `Year: ${currentNovel.releaseYear || "-"}`;

    statViews.textContent = (Number(currentNovel.views) + 1 || 1).toLocaleString();
    statBookmarks.textContent = (currentNovel.bookmarkCount || 0).toLocaleString();

    genresList.replaceChildren();
    const genres = Array.isArray(currentNovel.genres) ? currentNovel.genres : [currentNovel.genre || "Fantasy"];
    genres.forEach(g => {
        const tag = document.createElement("span");
        tag.className = "meta-pill";
        tag.style.background = "#23262d";
        tag.textContent = g;
        genresList.appendChild(tag);
    });

    novelSynopsis.textContent = currentNovel.synopsis || "No synopsis available.";
}

// 3. Load Chapters
async function loadChapters() {
    try {
        const chaptersSnap = await getDocs(collection(db, "chapters"));
        chapters = [];

        chaptersSnap.docs.forEach(d => {
            const data = d.data();
            if (data.novelId === novelId) {
                chapters.push({ id: d.id, ...data });
            }
        });

        sortChapters();

        statChapterCount.textContent = chapters.length;
        totalChaptersLabel.textContent = chapters.length;

        if (chapters.length > 0) {
            const firstCh = [...chapters].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))[0];
            btnStartReading.href = `read-chapter.html?id=${firstCh.id}`;
        } else {
            btnStartReading.style.opacity = "0.5";
            btnStartReading.style.pointerEvents = "none";
            btnStartReading.textContent = "No Chapters Available";
        }

        renderChapterGrid();
    } catch (error) {
        console.error("Failed to load chapters:", error);
    }
}

function sortChapters() {
    chapters.sort((a, b) => {
        const numA = Number(a.chapterNumber || 0);
        const numB = Number(b.chapterNumber || 0);
        return isAscending ? numA - numB : numB - numA;
    });
}

function renderChapterGrid() {
    const searchVal = (chapterSearchInput?.value || "").toLowerCase().trim();

    const filtered = chapters.filter(ch => {
        const title = (ch.title || "").toLowerCase();
        const num = String(ch.chapterNumber || "");
        return title.includes(searchVal) || num.includes(searchVal);
    });

    if (filtered.length === 0) {
        chapterListGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #777;">No chapters found.</p>`;
        return;
    }

    chapterListGrid.innerHTML = filtered.map(ch => {
        const chNum = ch.chapterNumber ? `Chapter ${ch.chapterNumber}` : "";
        const chTitle = ch.title || chNum;
        const dateStr = formatDate(ch.createdAt || ch.publishedAt);

        return `
            <a href="read-chapter.html?id=${ch.id}" class="chapter-item">
                <span class="chapter-item-title">${escapeHTML(chTitle)}</span>
                <span class="chapter-item-date">${dateStr}</span>
            </a>
        `;
    }).join("");
}

// 4. Bookmark Handler
async function checkBookmarkState() {
    if (!currentUser) return;
    try {
        const q = query(
            collection(db, "bookmarks"),
            where("userId", "==", currentUser.uid),
            where("novelId", "==", novelId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            isBookmarked = true;
            bookmarkDocId = snap.docs[0].id;
            btnBookmark.classList.add("bookmarked");
            btnBookmark.innerHTML = "❤️ Bookmarked";
        }
    } catch (e) {
        console.error("Check bookmark failed:", e);
    }
}

btnBookmark?.addEventListener("click", async () => {
    if (!currentUser) {
        alert("Please log in to bookmark this novel!");
        window.location.href = "login.html";
        return;
    }

    btnBookmark.disabled = true;

    try {
        const novelRef = doc(db, "novels", novelId);

        if (isBookmarked && bookmarkDocId) {
            await deleteDoc(doc(db, "bookmarks", bookmarkDocId));
            await updateDoc(novelRef, { bookmarkCount: increment(-1) });

            isBookmarked = false;
            bookmarkDocId = null;
            btnBookmark.classList.remove("bookmarked");
            btnBookmark.innerHTML = "❤️ Bookmark";
            statBookmarks.textContent = Math.max(0, Number(statBookmarks.textContent) - 1);
        } else {
            const docRef = await addDoc(collection(db, "bookmarks"), {
                userId: currentUser.uid,
                novelId: novelId,
                novelTitle: currentNovel?.title || "",
                userEmail: currentUser.email || "",
                createdAt: serverTimestamp()
            });

            await updateDoc(novelRef, { bookmarkCount: increment(1) });

            isBookmarked = true;
            bookmarkDocId = docRef.id;
            btnBookmark.classList.add("bookmarked");
            btnBookmark.innerHTML = "❤️ Bookmarked";
            statBookmarks.textContent = Number(statBookmarks.textContent) + 1;
        }
    } catch (err) {
        console.error("Failed to process bookmark:", err);
        alert("Failed to process bookmark: " + err.message);
    } finally {
        btnBookmark.disabled = false;
    }
});

chapterSearchInput?.addEventListener("input", renderChapterGrid);

btnToggleSort?.addEventListener("click", () => {
    isAscending = !isAscending;
    btnToggleSort.textContent = isAscending ? "Order: Oldest ▲" : "Order: Newest ▼";
    sortChapters();
    renderChapterGrid();
});

function formatDate(value) {
    if (!value) return "-";
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

loadNovelDetail();

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