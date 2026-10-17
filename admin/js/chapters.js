// =========================
// FIREBASE
// =========================

import { auth, db } from "../../firebase/firebase-config.js";

import {
    collection,
    getDocs,
    getDoc,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


// =========================
// ELEMENTS
// =========================

const novelFilter =
    document.getElementById("novelFilter");

const statusFilter =
    document.getElementById("statusFilter");

const chapterSearch =
    document.getElementById("chapterSearch");

const chapterTableBody =
    document.getElementById("chapterTableBody");

const chapterCount =
    document.getElementById("chapterCount");

const logoutBtn =
    document.getElementById("logoutBtn");

const adminName =
    document.getElementById("adminName");


// =========================
// DATA
// =========================

let currentUser = null;

let novels = [];
let chapters = [];


// =========================
// AUTH
// =========================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

    try {

        // Get current admin profile
        const userRef =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userRef);

        if (!userSnapshot.exists()) {
            alert("User profile not found.");
            await signOut(auth);
            return;
        }

        const userData =
            userSnapshot.data();

        // Check admin role
        if (userData.role !== "admin") {
            alert("You do not have permission to access this page.");
            window.location.href = "../index.html";
            return;
        }

        // Show admin name
        if (adminName) {
            adminName.textContent =
                userData.username ||
                user.displayName ||
                "Admin";
        }

        // Load data
        await loadNovels();
        await loadChapters();

    } catch (error) {

        console.error(
            "Chapter Management initialization error:",
            error
        );

        showError(
            "Failed to load Chapter Management."
        );
    }

});


// =========================
// LOAD NOVELS
// =========================

async function loadNovels() {

    try {

        const novelsSnapshot =
            await getDocs(
                collection(db, "novels")
            );

        novels = [];

        novelsSnapshot.forEach((document) => {

            novels.push({
                id: document.id,
                ...document.data()
            });

        });

        console.log(
            "Novels loaded:",
            novels
        );

        populateNovelFilter();

    } catch (error) {

        console.error(
            "Failed to load novels:",
            error
        );

        throw error;
    }
}


// =========================
// POPULATE NOVEL FILTER
// =========================

function populateNovelFilter() {

    if (!novelFilter) {
        return;
    }

    // Keep All Novels
    novelFilter.innerHTML = `
        <option value="">
            All Novels
        </option>
    `;

    novels
        .sort((a, b) =>
            (a.title || "").localeCompare(
                b.title || ""
            )
        )
        .forEach((novel) => {

            const option =
                document.createElement("option");

            option.value = novel.id;

            option.textContent =
                novel.title ||
                "Untitled Novel";

            novelFilter.appendChild(option);

        });

}


// =========================
// LOAD CHAPTERS
// =========================

async function loadChapters() {

    try {

        const chaptersSnapshot =
            await getDocs(
                collection(db, "chapters")
            );

        chapters = [];

        chaptersSnapshot.forEach((document) => {

            chapters.push({
                id: document.id,
                ...document.data()
            });

        });

        console.log(
            "Chapters loaded:",
            chapters
        );

        updateStats();
        renderChapters();

    } catch (error) {

        console.error(
            "Failed to load chapters:",
            error
        );

        throw error;
    }
}


// =========================
// FIND NOVEL
// =========================

function getNovelById(novelId) {

    return novels.find(
        (novel) => novel.id === novelId
    );

}


// =========================
// FILTER CHAPTERS
// =========================

function getFilteredChapters() {

    const selectedNovel =
        novelFilter?.value || "";

    const selectedStatus =
        statusFilter?.value || "";

    const searchTerm =
        chapterSearch?.value
            .trim()
            .toLowerCase() || "";

    return chapters.filter((chapter) => {

        // Novel filter
        if (
            selectedNovel &&
            chapter.novelId !== selectedNovel
        ) {
            return false;
        }

        // Status filter
        if (
            selectedStatus &&
            chapter.status !== selectedStatus
        ) {
            return false;
        }

        // Search
        if (searchTerm) {

            const novel =
                getNovelById(
                    chapter.novelId
                );

            const novelTitle =
                novel?.title
                    ?.toLowerCase() || "";

            const chapterTitle =
                chapter.title
                    ?.toLowerCase() || "";

            const chapterNumber =
                String(
                    chapter.chapterNumber || ""
                ).toLowerCase();

            const matches =
                chapterTitle.includes(searchTerm) ||
                novelTitle.includes(searchTerm) ||
                chapterNumber.includes(searchTerm);

            if (!matches) {
                return false;
            }
        }

        return true;

    });

}


// =========================
// RENDER CHAPTERS
// =========================

function renderChapters() {

    if (!chapterTableBody) {
        return;
    }

    const filteredChapters =
        getFilteredChapters();

    // Empty
    if (filteredChapters.length === 0) {

        chapterTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state">

                        <div class="empty-icon">
                            <i data-lucide="file-text"></i>
                        </div>

                        <h3>
                            No chapters found
                        </h3>

                        <p>
                            Add a chapter or adjust your filters.
                        </p>

                        <div class="empty-actions">

                            <a
                                href="add-chapter.html"
                                class="empty-add-button">

                                <i data-lucide="plus"></i>

                                Add Chapter

                            </a>

                            <a
                                href="bulk-upload.html"
                                class="empty-bulk-button">

                                <i data-lucide="upload"></i>

                                Bulk Upload

                            </a>

                        </div>

                    </div>
                </td>
            </tr>
        `;

        refreshIcons();

        updateChapterCount(0);

        return;
    }


    // Render rows
    chapterTableBody.innerHTML =
        filteredChapters
            .sort(sortChapters)
            .map(renderChapterRow)
            .join("");


    refreshIcons();

    updateChapterCount(
        filteredChapters.length
    );

    attachChapterActions();

}


// =========================
// SORT CHAPTERS
// =========================

function sortChapters(a, b) {

    const novelA =
        getNovelById(a.novelId);

    const novelB =
        getNovelById(b.novelId);

    const novelTitleA =
        novelA?.title || "";

    const novelTitleB =
        novelB?.title || "";

    const novelCompare =
        novelTitleA.localeCompare(
            novelTitleB
        );

    if (novelCompare !== 0) {
        return novelCompare;
    }

    return (
        Number(a.chapterNumber || 0) -
        Number(b.chapterNumber || 0)
    );

}


// =========================
// RENDER ROW
// =========================

function renderChapterRow(chapter) {

    const novel =
        getNovelById(
            chapter.novelId
        );

    const novelTitle =
        novel?.title ||
        "Unknown Novel";

    const chapterNumber =
        chapter.chapterNumber ||
        "-";

    const chapterTitle =
        chapter.title ||
        `Chapter ${chapterNumber}`;

    const status =
        chapter.status ||
        "draft";

    const publishDate =
        formatDate(
            chapter.publishDate
        );

    const createdDate =
        formatDate(
            chapter.createdAt
        );

    return `
        <tr>

            <td>
                <div class="chapter-name">

                    <strong>
                        Chapter ${escapeHTML(
                            String(chapterNumber)
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            chapterTitle
                        )}
                    </span>

                </div>
            </td>

            <td>
                <strong>
                    ${escapeHTML(
                        novelTitle
                    )}
                </strong>
            </td>

            <td>
                <span class="status-badge status-${escapeHTML(
                    status
                )}">
                    ${capitalize(
                        status
                    )}
                </span>
            </td>

            <td>
                ${publishDate}
            </td>

            <td>
                ${createdDate}
            </td>

            <td>
                <div class="chapter-actions">

                    <a
                        href="edit-chapter.html?id=${encodeURIComponent(
                            chapter.id
                        )}"
                        class="table-action edit-action"
                        title="Edit Chapter">

                        <i data-lucide="pencil"></i>

                    </a>

                    <button
                        type="button"
                        class="table-action delete-action"
                        data-id="${escapeHTML(
                            chapter.id
                        )}"
                        title="Delete Chapter">

                        <i data-lucide="trash-2"></i>

                    </button>

                </div>
            </td>

        </tr>
    `;

}


// =========================
// STATS
// =========================

function updateStats() {

    const total =
        chapters.length;

    const published =
        chapters.filter(
            chapter =>
                chapter.status === "published"
        ).length;

    const scheduled =
        chapters.filter(
            chapter =>
                chapter.status === "scheduled"
        ).length;

    const drafts =
        chapters.filter(
            chapter =>
                chapter.status === "draft"
        ).length;


    const statCards =
        document.querySelectorAll(
            ".chapter-stat-card strong"
        );

    if (statCards.length >= 4) {

        statCards[0].textContent =
            total;

        statCards[1].textContent =
            published;

        statCards[2].textContent =
            scheduled;

        statCards[3].textContent =
            drafts;
    }

}


// =========================
// CHAPTER COUNT
// =========================

function updateChapterCount(count) {

    if (!chapterCount) {
        return;
    }

    chapterCount.textContent =
        `Showing ${count} chapter${
            count === 1 ? "" : "s"
        }`;

}


// =========================
// DELETE CHAPTER
// =========================

function attachChapterActions() {

    const deleteButtons =
        document.querySelectorAll(
            ".delete-action"
        );

    deleteButtons.forEach((button) => {

        button.addEventListener(
            "click",
            async () => {

                const chapterId =
                    button.dataset.id;

                if (!chapterId) {
                    return;
                }

                const confirmed =
                    confirm(
                        "Are you sure you want to delete this chapter?"
                    );

                if (!confirmed) {
                    return;
                }

                try {

                    button.disabled = true;

                    await deleteDoc(
                        doc(
                            db,
                            "chapters",
                            chapterId
                        )
                    );

                    // Remove locally
                    chapters =
                        chapters.filter(
                            chapter =>
                                chapter.id !== chapterId
                        );

                    updateStats();
                    renderChapters();

                } catch (error) {

                    console.error(
                        "Failed to delete chapter:",
                        error
                    );

                    alert(
                        "Failed to delete chapter.\n\n" +
                        error.message
                    );

                    button.disabled = false;
                }

            }
        );

    });

}


// =========================
// FILTER EVENTS
// =========================

novelFilter?.addEventListener(
    "change",
    renderChapters
);

statusFilter?.addEventListener(
    "change",
    renderChapters
);

chapterSearch?.addEventListener(
    "input",
    renderChapters
);


// =========================
// LOGOUT
// =========================

logoutBtn?.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "../login.html";

        } catch (error) {

            console.error(
                "Logout failed:",
                error
            );

            alert(
                "Failed to logout."
            );

        }

    }
);


// =========================
// DATE FORMAT
// =========================

function formatDate(value) {

    if (!value) {
        return "-";
    }

    let date;

    // Firestore Timestamp
    if (
        typeof value === "object" &&
        typeof value.toDate === "function"
    ) {
        date = value.toDate();
    }

    // JS Date
    else if (value instanceof Date) {
        date = value;
    }

    // String / number
    else {
        date = new Date(value);
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }

    return date.toLocaleDateString(
        "en-US",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


// =========================
// CAPITALIZE
// =========================

function capitalize(value) {

    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


// =========================
// ESCAPE HTML
// =========================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =========================
// LUCIDE
// =========================

function refreshIcons() {

    if (
        typeof lucide !== "undefined"
    ) {
        lucide.createIcons();
    }

}


// =========================
// ERROR STATE
// =========================

function showError(message) {

    if (!chapterTableBody) {
        return;
    }

    chapterTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state">

                    <div class="empty-icon">
                        <i data-lucide="triangle-alert"></i>
                    </div>

                    <h3>
                        Something went wrong
                    </h3>

                    <p>
                        ${escapeHTML(message)}
                    </p>

                </div>
            </td>
        </tr>
    `;

    refreshIcons();

}