import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// DOM Elements
const statTotalViews = document.getElementById("statTotalViews");
const statTotalBookmarks = document.getElementById("statTotalBookmarks");
const statTotalNovels = document.getElementById("statTotalNovels");
const statTotalChapters = document.getElementById("statTotalChapters");
const topNovelsTableBody = document.getElementById("topNovelsTableBody");
const adminName = document.getElementById("adminName");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let novels = [];
let chapters = [];
let bookmarks = [];

let genreChartInstance = null;
let statusChartInstance = null;

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

        if (adminName) {
            adminName.textContent = userSnapshot.data().username || user.displayName || "Admin";
        }

        await fetchAnalyticsData();
    } catch (error) {
        console.error("Gagal inisialisasi Analytics:", error);
    }
});

// Fetch Semua Data dari Firestore
async function fetchAnalyticsData() {
    try {
        const [novelsSnap, chaptersSnap, bookmarksSnap] = await Promise.all([
            getDocs(collection(db, "novels")),
            getDocs(collection(db, "chapters")),
            getDocs(collection(db, "bookmarks"))
        ]);

        novels = novelsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        chapters = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        bookmarks = bookmarksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Hitung aktual chapter per novel
        const chapterCounts = {};
        chapters.forEach(c => {
            if (c.novelId) chapterCounts[c.novelId] = (chapterCounts[c.novelId] || 0) + 1;
        });

        // Hitung aktual bookmark per novel
        const bookmarkCounts = {};
        bookmarks.forEach(b => {
            if (b.novelId) bookmarkCounts[b.novelId] = (bookmarkCounts[b.novelId] || 0) + 1;
        });

        novels.forEach(novel => {
            novel.actualChapterCount = chapterCounts[novel.id] || 0;
            novel.actualBookmarkCount = bookmarkCounts[novel.id] || novel.bookmarkCount || 0;
            novel.views = Number(novel.views) || 0;
        });

        renderStatsCards();
        renderTopNovelsTable();
        renderGenreChart();
        renderStatusChart();
    } catch (error) {
        console.error("Gagal mengambil data analitik:", error);
        topNovelsTableBody.innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #dc2626;">Gagal memuat analitik. Check koneksi Firestore.</td></tr>
        `;
    }
}

// Render Ringkasan Angka Stat
function renderStatsCards() {
    const totalViews = novels.reduce((acc, n) => acc + (n.views || 0), 0);
    const totalBookmarks = bookmarks.length || novels.reduce((acc, n) => acc + (n.actualBookmarkCount || 0), 0);
    const totalNovels = novels.length;
    const totalChapters = chapters.length;

    if (statTotalViews) statTotalViews.textContent = totalViews.toLocaleString("en-US");
    if (statTotalBookmarks) statTotalBookmarks.textContent = totalBookmarks.toLocaleString("en-US");
    if (statTotalNovels) statTotalNovels.textContent = totalNovels.toLocaleString("en-US");
    if (statTotalChapters) statTotalChapters.textContent = totalChapters.toLocaleString("en-US");
}

// Render Top 10 Novel
function renderTopNovelsTable() {
    if (!topNovelsTableBody) return;

    // Urutkan novel berdasarkan Views terbanyak
    const sortedNovels = [...novels].sort((a, b) => b.views - a.views).slice(0, 10);

    if (sortedNovels.length === 0) {
        topNovelsTableBody.innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #777a82; padding: 24px;">Belum ada novel di sistem.</td></tr>
        `;
        return;
    }

    topNovelsTableBody.replaceChildren();

    sortedNovels.forEach((novel, idx) => {
        const row = document.createElement("tr");

        const coverUrl = novel.coverUrl || novel.cover || "../images/cover-placeholder.jpg";
        const title = novel.title || "Untitled Novel";
        const author = novel.author || "Unknown";

        row.innerHTML = `
            <td style="text-align: center;">
                <span class="top-novel-rank rank-${idx + 1}">#${idx + 1}</span>
            </td>
            <td>
                <div class="top-novel-left">
                    <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(title)}" class="top-novel-cover" onerror="this.src='../images/cover-placeholder.jpg'">
                    <div class="top-novel-info">
                        <strong>${escapeHTML(title)}</strong>
                        <span>${escapeHTML(novel.language || "Unknown Language")}</span>
                    </div>
                </div>
            </td>
            <td>${escapeHTML(author)}</td>
            <td style="text-align: center;">${novel.actualChapterCount}</td>
            <td style="text-align: center;">${novel.actualBookmarkCount}</td>
            <td style="text-align: center;"><strong>${novel.views.toLocaleString("en-US")}</strong></td>
        `;

        topNovelsTableBody.appendChild(row);
    });
}

// Chart 1: Grafik Distribusi Genre
function renderGenreChart() {
    const ctx = document.getElementById("genreDistributionChart")?.getContext("2d");
    if (!ctx) return;

    const genreCounts = {};
    novels.forEach(n => {
        const gList = Array.isArray(n.genres) ? n.genres : (n.genre ? [n.genre] : ["Uncategorized"]);
        gList.forEach(g => {
            const cleanG = g.trim();
            if (cleanG) genreCounts[cleanG] = (genreCounts[cleanG] || 0) + 1;
        });
    });

    const labels = Object.keys(genreCounts);
    const data = Object.values(genreCounts);

    if (genreChartInstance) genreChartInstance.destroy();

    genreChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels.length ? labels : ["No Genres"],
            datasets: [{
                label: "Jumlah Novel",
                data: data.length ? data : [0],
                backgroundColor: "#101114",
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Chart 2: Grafik Status Novel (Ongoing vs Completed)
function renderStatusChart() {
    const ctx = document.getElementById("statusDistributionChart")?.getContext("2d");
    if (!ctx) return;

    let ongoingCount = 0;
    let completedCount = 0;

    novels.forEach(n => {
        const st = (n.status || "").toLowerCase();
        if (st === "completed") completedCount++;
        else ongoingCount++;
    });

    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Ongoing", "Completed"],
            datasets: [{
                data: [ongoingCount, completedCount],
                backgroundColor: ["#16a34a", "#2563eb"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});