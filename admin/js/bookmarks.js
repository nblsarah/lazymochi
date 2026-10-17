import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    deleteDoc,
    updateDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const PAGE_SIZE = 10;

const elements = {
    search: document.getElementById("bookmarkSearch"),
    globalSearch: document.getElementById("globalBookmarkSearch"),
    novelFilter: document.getElementById("novelFilter"),
    resetBtn: document.getElementById("resetFilter"),
    tableBody: document.getElementById("bookmarkTableBody"),
    summary: document.getElementById("tableSummary"),
    pagination: document.getElementById("bookmarkPagination"),
    adminName: document.getElementById("adminName"),
    logoutBtn: document.getElementById("logoutBtn")
};

let currentUser = null;
let bookmarks = [];
let novelsMap = {};
let usersMap = {};
let filteredBookmarks = [];
let currentPage = 1;

// Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    currentUser = user;

    try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (!userSnapshot.exists() || userSnapshot.data().role !== "admin") {
            alert("Anda tidak memiliki izin untuk mengakses halaman ini.");
            window.location.href = "../index.html";
            return;
        }

        if (elements.adminName) {
            elements.adminName.textContent = userSnapshot.data().username || user.displayName || "Admin";
        }

        await loadNovels();
        await loadUsers();
        await loadBookmarks();
    } catch (error) {
        console.error("Gagal inisialisasi Bookmarks Management:", error);
    }
});

// Load Map Data Novel
async function loadNovels() {
    try {
        const snapshot = await getDocs(collection(db, "novels"));
        novelsMap = {};
        
        if (elements.novelFilter) {
            elements.novelFilter.innerHTML = `<option value="">All Novels</option>`;
        }

        const novelList = [];

        snapshot.docs.forEach(d => {
            const data = d.data();
            novelsMap[d.id] = data;
            novelList.push({ id: d.id, title: data.title || "Untitled Novel" });
        });

        novelList.sort((a, b) => a.title.localeCompare(b.title));

        novelList.forEach(novel => {
            const opt = document.createElement("option");
            opt.value = novel.id;
            opt.textContent = novel.title;
            elements.novelFilter?.appendChild(opt);
        });
    } catch (err) {
        console.error("Gagal memuat list novel:", err);
    }
}

// Load Map Data Users
async function loadUsers() {
    try {
        const snapshot = await getDocs(collection(db, "users"));
        usersMap = {};
        snapshot.docs.forEach(d => {
            usersMap[d.id] = d.data();
        });
    } catch (err) {
        console.error("Gagal memuat list user:", err);
    }
}

// Load Bookmarks
async function loadBookmarks() {
    try {
        const snapshot = await getDocs(collection(db, "bookmarks"));
        bookmarks = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        // Urutkan bookmark dari yang terbaru
        bookmarks.sort((a, b) => {
            const dateA = toDate(a.createdAt || a.timestamp)?.getTime() || 0;
            const dateB = toDate(b.createdAt || b.timestamp)?.getTime() || 0;
            return dateB - dateA;
        });

        filteredBookmarks = [...bookmarks];
        renderTable();
    } catch (error) {
        console.error("Gagal memuat bookmark:", error);
        renderEmptyState("Gagal memuat data bookmark dari Firestore.");
    }
}

function renderEmptyState(message) {
    elements.tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.style.textAlign = "center";
    cell.style.color = "#777a82";
    cell.style.padding = "24px";
    cell.textContent = message;
    row.appendChild(cell);
    elements.tableBody.appendChild(row);
    elements.summary.textContent = "Showing 0 bookmarks";
    elements.pagination.replaceChildren();
}

function applyFilters() {
    const search = (elements.search?.value || elements.globalSearch?.value || "").toLowerCase().trim();
    const selectedNovelId = elements.novelFilter?.value || "";

    filteredBookmarks = bookmarks.filter(bm => {
        const novel = novelsMap[bm.novelId] || {};
        const user = usersMap[bm.userId] || {};

        const novelTitle = (novel.title || bm.novelTitle || "").toLowerCase();
        const username = (user.username || user.displayName || bm.username || "").toLowerCase();
        const userEmail = (user.email || bm.userEmail || "").toLowerCase();

        const searchMatches = !search || novelTitle.includes(search) || username.includes(search) || userEmail.includes(search);
        const novelMatches = !selectedNovelId || bm.novelId === selectedNovelId;

        return searchMatches && novelMatches;
    });

    currentPage = 1;
    renderTable();
}

function renderTable() {
    elements.tableBody.replaceChildren();

    if (!filteredBookmarks.length) {
        renderEmptyState("Tidak ada data bookmark yang ditemukan.");
        return;
    }

    const totalPages = Math.ceil(filteredBookmarks.length / PAGE_SIZE);
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredBookmarks.slice(start, start + PAGE_SIZE);

    pageItems.forEach((bm, index) => {
        elements.tableBody.appendChild(createBookmarkRow(bm, start + index + 1));
    });

    const end = start + pageItems.length;
    elements.summary.textContent = `Showing ${start + 1} to ${end} of ${filteredBookmarks.length} bookmarks`;
    renderPagination(totalPages);

    if (window.lucide) window.lucide.createIcons();
    attachDeleteEvents();
}

function createBookmarkRow(bm, rowNumber) {
    const row = document.createElement("tr");

    const novel = novelsMap[bm.novelId] || {};
    const user = usersMap[bm.userId] || {};

    const novelTitle = novel.title || bm.novelTitle || "Novel Tidak Ditemukan";
    const coverUrl = novel.coverUrl || novel.cover || "../images/cover-placeholder.jpg";
    const author = novel.author || "Unknown Author";

    const username = user.username || user.displayName || bm.username || "User Unknown";
    const userEmail = user.email || bm.userEmail || "-";
    const avatarUrl = user.photoURL || user.avatar || "../images/avatar.png";
    const createdDate = formatDate(bm.createdAt || bm.timestamp);

    row.innerHTML = `
        <td style="text-align: center;">${rowNumber}</td>
        <td>
            <div class="bookmark-novel-cell">
                <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(novelTitle)}" class="bookmark-novel-cover" onerror="this.src='../images/cover-placeholder.jpg'">
                <div class="bookmark-novel-info">
                    <strong>${escapeHTML(novelTitle)}</strong>
                    <span>by ${escapeHTML(author)}</span>
                </div>
            </div>
        </td>
        <td>
            <div class="user-chip">
                <img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(username)}" onerror="this.src='../images/avatar.png'">
                <span>${escapeHTML(username)}</span>
            </div>
        </td>
        <td style="color: #5f626a;">${escapeHTML(userEmail)}</td>
        <td>${createdDate}</td>
        <td style="text-align: center;">
            <div class="actions" style="justify-content: center;">
                <button type="button" class="delete-bookmark-btn" data-id="${bm.id}" data-novel-id="${bm.novelId}" title="Hapus Bookmark">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </td>
    `;

    return row;
}

function renderPagination(totalPages) {
    elements.pagination.replaceChildren();
    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = `<i data-lucide="chevron-left"></i>`;
    prevBtn.addEventListener("click", () => {
        currentPage--;
        renderTable();
    });
    elements.pagination.appendChild(prevBtn);

    for (let page = 1; page <= totalPages; page++) {
        const pageBtn = document.createElement("button");
        pageBtn.type = "button";
        if (page === currentPage) pageBtn.className = "active";
        pageBtn.textContent = page;
        pageBtn.addEventListener("click", () => {
            currentPage = page;
            renderTable();
        });
        elements.pagination.appendChild(pageBtn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = `<i data-lucide="chevron-right"></i>`;
    nextBtn.addEventListener("click", () => {
        currentPage++;
        renderTable();
    });
    elements.pagination.appendChild(nextBtn);
}

// Event Hapus Bookmark (Sekaligus Dekremen bookmarkCount pada Novel)
function attachDeleteEvents() {
    document.querySelectorAll(".delete-bookmark-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const bookmarkId = btn.dataset.id;
            const novelId = btn.dataset.novelId;

            const confirmed = confirm("Apakah Anda yakin ingin menghapus data bookmark ini?");
            if (!confirmed) return;

            try {
                // 1. Hapus dokumen dari collection 'bookmarks'
                await deleteDoc(doc(db, "bookmarks", bookmarkId));

                // 2. Kurangi bookmarkCount di dokumen 'novels' terkait (jika ada)
                if (novelId) {
                    try {
                        await updateDoc(doc(db, "novels", novelId), {
                            bookmarkCount: increment(-1),
                            updatedAt: serverTimestamp()
                        });
                    } catch (e) {
                        console.warn("Gagal update bookmarkCount novel:", e);
                    }
                }

                bookmarks = bookmarks.filter(bm => bm.id !== bookmarkId);
                applyFilters();
                alert("Bookmark berhasil dihapus!");
            } catch (error) {
                console.error("Gagal menghapus bookmark:", error);
                alert("Gagal menghapus bookmark: " + error.message);
            }
        });
    });
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
    const date = toDate(value);
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event Listeners
elements.search?.addEventListener("input", () => {
    if (elements.globalSearch) elements.globalSearch.value = elements.search.value;
    applyFilters();
});

elements.globalSearch?.addEventListener("input", () => {
    if (elements.search) elements.search.value = elements.globalSearch.value;
    applyFilters();
});

elements.novelFilter?.addEventListener("change", applyFilters);

elements.resetBtn?.addEventListener("click", () => {
    if (elements.search) elements.search.value = "";
    if (elements.globalSearch) elements.globalSearch.value = "";
    if (elements.novelFilter) elements.novelFilter.value = "";
    applyFilters();
});

elements.logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});