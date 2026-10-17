import { db } from "../../firebase/firebase-config.js";

import {
    collection,
    getDocs,
    orderBy,
    query
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const PAGE_SIZE = 5;

const elements = {
    search: document.getElementById("novelSearch"),
    globalSearch: document.getElementById("globalNovelSearch"),
    status: document.getElementById("statusFilter"),
    genre: document.getElementById("genreFilter"),
    language: document.getElementById("languageFilter"),
    reset: document.getElementById("resetFilter"),
    tableBody: document.getElementById("novelTableBody"),
    summary: document.getElementById("tableSummary"),
    pagination: document.getElementById("novelPagination")
};

let novels = [];
let filteredNovels = [];
let currentPage = 1;

const normalizedText = (value) => String(value ?? "").trim().toLowerCase();

const valueList = (value) => {
    if (Array.isArray(value)) {
        return value.flatMap(valueList);
    }

    if (value && typeof value === "object") {
        return valueList(value.name || value.title || value.label || "");
    }

    return String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();

    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
};

const toNumber = (value) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
};

const getTitle = (novel) => novel.title || novel.name || novel.novelTitle || "Untitled novel";
const getAlternativeTitle = (novel) => novel.alternativeTitle || novel.originalTitle || novel.nativeTitle || "";
const getAuthor = (novel) => novel.author || novel.authorName || "Unknown author";
const getStatus = (novel) => novel.status || "Unknown";
const getGenres = (novel) => valueList(novel.genres || novel.genre);
const getLanguages = (novel) => valueList(novel.languages || novel.language);

const formatNumber = (value) => new Intl.NumberFormat("en-US", {
    notation: toNumber(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1
}).format(toNumber(value));

const formatDate = (value) => {
    const date = toDate(value);
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
};

const createCell = (content) => {
    const cell = document.createElement("td");
    if (content instanceof Node) cell.appendChild(content);
    else cell.textContent = content;
    return cell;
};

const createIcon = (name) => {
    const icon = document.createElement("i");
    icon.dataset.lucide = name;
    return icon;
};

const createNovelRow = (novel, rowNumber) => {
    const row = document.createElement("tr");
    row.dataset.novelId = novel.id;
    row.appendChild(createCell(rowNumber));

    const cover = document.createElement("img");
    cover.className = "cover";
    cover.src = novel.coverUrl || novel.cover || "../images/cover-placeholder.jpg";
    cover.alt = `${getTitle(novel)} cover`;
    cover.loading = "lazy";
    row.appendChild(createCell(cover));

    const title = document.createElement("div");
    title.className = "novel-title";
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = getTitle(novel);
    const alternativeTitle = document.createElement("span");
    alternativeTitle.textContent = getAlternativeTitle(novel);
    title.append(titleStrong, alternativeTitle);
    row.appendChild(createCell(title));

    row.appendChild(createCell(getAuthor(novel)));

    const status = document.createElement("span");
    const statusName = getStatus(novel);
    status.className = `status ${normalizedText(statusName).replace(/\s+/g, "-")}`;
    status.append(document.createElement("i"), document.createTextNode(statusName));
    row.appendChild(createCell(status));

    row.appendChild(createCell(formatNumber(novel.chapterCount ?? novel.chapters)));
    row.appendChild(createCell(formatNumber(novel.views)));
    row.appendChild(createCell(formatNumber(novel.bookmarkCount ?? novel.bookmarks)));

    const time = document.createElement("time");
    time.textContent = formatDate(novel.updatedAt || novel.createdAt);
    row.appendChild(createCell(time));

    const actions = document.createElement("div");
    actions.className = "actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.setAttribute("aria-label", `Edit ${getTitle(novel)}`);
    editButton.appendChild(createIcon("pencil"));
    editButton.addEventListener("click", () => {
        window.location.href = `edit-novel.html?id=${encodeURIComponent(novel.id)}`;
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-novel-btn";
    deleteButton.dataset.id = novel.id;
    deleteButton.setAttribute("aria-label", `Delete ${getTitle(novel)}`);
    deleteButton.appendChild(createIcon("trash-2"));

    actions.append(editButton, deleteButton);
    row.appendChild(createCell(actions));
    return row;
};

const renderEmptyState = (message) => {
    elements.tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = createCell(message);
    cell.colSpan = 10;
    cell.style.textAlign = "center";
    cell.style.color = "#777a82";
    row.appendChild(cell);
    elements.tableBody.appendChild(row);
};

const createPageButton = (label, page, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = Boolean(options.disabled);
    if (options.active) button.className = "active";
    if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);

    if (options.icon) button.appendChild(createIcon(options.icon));
    else button.textContent = label;

    button.addEventListener("click", () => {
        currentPage = page;
        renderTable();
    });
    return button;
};

const renderPagination = (totalPages) => {
    elements.pagination.replaceChildren();
    if (totalPages <= 1) return;

    elements.pagination.appendChild(createPageButton("", currentPage - 1, {
        disabled: currentPage === 1,
        ariaLabel: "Previous page",
        icon: "chevron-left"
    }));

    for (let page = 1; page <= totalPages; page += 1) {
        elements.pagination.appendChild(createPageButton(String(page), page, {
            active: page === currentPage,
            ariaLabel: `Page ${page}`
        }));
    }

    elements.pagination.appendChild(createPageButton("", currentPage + 1, {
        disabled: currentPage === totalPages,
        ariaLabel: "Next page",
        icon: "chevron-right"
    }));
};

function renderTable() {
    elements.tableBody.replaceChildren();

    if (!filteredNovels.length) {
        renderEmptyState("No novels match the selected filters.");
        elements.summary.textContent = "Showing 0 novels";
        elements.pagination.replaceChildren();
        return;
    }

    const totalPages = Math.ceil(filteredNovels.length / PAGE_SIZE);
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredNovels.slice(start, start + PAGE_SIZE);

    pageItems.forEach((novel, index) => {
        elements.tableBody.appendChild(createNovelRow(novel, start + index + 1));
    });

    const end = start + pageItems.length;
    elements.summary.textContent = `Showing ${start + 1} to ${end} of ${filteredNovels.length} novels`;
    renderPagination(totalPages);

    if (window.lucide) window.lucide.createIcons();
}

const syncSearchInputs = (source, target) => {
    if (target.value !== source.value) target.value = source.value;
};

function applyFilters() {
    const search = normalizedText(elements.search.value);
    const selectedStatus = normalizedText(elements.status.value);
    const selectedGenre = normalizedText(elements.genre.value);
    const selectedLanguage = normalizedText(elements.language.value);

    filteredNovels = novels.filter((novel) => {
        const searchableText = normalizedText([
            getTitle(novel),
            getAlternativeTitle(novel),
            getAuthor(novel)
        ].join(" "));

        const statusMatches = !selectedStatus || normalizedText(getStatus(novel)) === selectedStatus;
        const genreMatches = !selectedGenre || getGenres(novel).some((genre) => normalizedText(genre) === selectedGenre);
        const languageMatches = !selectedLanguage || getLanguages(novel).some((language) => normalizedText(language) === selectedLanguage);

        return searchableText.includes(search) && statusMatches && genreMatches && languageMatches;
    });

    currentPage = 1;
    renderTable();
}

const fillSelectFromData = (select, values) => {
    const existingValues = new Set([...select.options].map((option) => normalizedText(option.value)));
    [...new Set(values)].sort((a, b) => a.localeCompare(b)).forEach((value) => {
        if (!value || existingValues.has(normalizedText(value))) return;
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
};

const resetFilters = () => {
    elements.search.value = "";
    elements.globalSearch.value = "";
    elements.status.value = "";
    elements.genre.value = "";
    elements.language.value = "";
    applyFilters();
    elements.search.focus();
};

elements.search.addEventListener("input", () => {
    syncSearchInputs(elements.search, elements.globalSearch);
    applyFilters();
});

elements.globalSearch.addEventListener("input", () => {
    syncSearchInputs(elements.globalSearch, elements.search);
    applyFilters();
});

[elements.status, elements.genre, elements.language].forEach((select) => {
    select.addEventListener("change", applyFilters);
});

elements.reset.addEventListener("click", resetFilters);

async function loadNovels() {
    try {
        let snapshot;

        try {
            snapshot = await getDocs(query(collection(db, "novels"), orderBy("updatedAt", "desc")));
        } catch {
            snapshot = await getDocs(collection(db, "novels"));
        }

        // 1. Ambil seluruh data dari collection 'chapters'
        const chaptersSnapshot = await getDocs(collection(db, "chapters"));
        
        // 2. Hitung jumlah dokumen chapter per novelId
        const chapterCounts = {};
        chaptersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.novelId) {
                chapterCounts[data.novelId] = (chapterCounts[data.novelId] || 0) + 1;
            }
        });

        // 3. Gabungkan hasil hitungan aktual ke data novel
        novels = snapshot.docs.map((document) => {
            const data = document.data();
            return {
                id: document.id,
                ...data,
                // Pakai jumlah hitungan langsung dari collection chapters
                chapterCount: chapterCounts[document.id] || 0
            };
        });

        novels.sort((a, b) => {
            const aDate = toDate(a.updatedAt || a.createdAt)?.getTime() || 0;
            const bDate = toDate(b.updatedAt || b.createdAt)?.getTime() || 0;
            return bDate - aDate;
        });

        await loadGenresFilter();

        fillSelectFromData(elements.status, novels.map(getStatus));
        fillSelectFromData(elements.language, novels.flatMap(getLanguages));

        filteredNovels = [...novels];
        renderTable();
    } catch (error) {
        console.error("Failed to load novels:", error);
        renderEmptyState("Failed to load novels. Check Firebase configuration and Firestore rules.");
        elements.summary.textContent = "Unable to load novels";
        elements.pagination.replaceChildren();
    }
}

loadNovels();

async function loadGenresFilter() {
    try {
        const genreSelect = elements.genre;
        if (!genreSelect) return;

        // Ambil semua dokumen dari collection 'genres'
        const snapshot = await getDocs(collection(db, "genres"));
        
        // Simpan nilai yang sedang dipilih agar tidak reset saat re-render
        const currentValue = genreSelect.value;

        // Reset isi dropdown dengan pilihan default
        genreSelect.innerHTML = `<option value="">All Genre</option>`;

        const genreList = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name) {
                genreList.push(data.name);
            }
        });

        // Urutkan secara alfabetis
        genreList.sort((a, b) => a.localeCompare(b));

        // Tambahkan opsi ke select
        genreList.forEach((genreName) => {
            const option = document.createElement("option");
            option.value = genreName;
            option.textContent = genreName;
            genreSelect.appendChild(option);
        });

        // Kembalikan nilai terpilih jika ada
        if (currentValue) {
            genreSelect.value = currentValue;
        }
    } catch (error) {
        console.error("Gagal memuat filter genre dari Firestore:", error);
    }
}