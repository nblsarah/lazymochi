import { db } from "../firebase/firebase-config.js";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// DOM Elements
const novelBreadcrumb = document.getElementById("novelBreadcrumb");
const chapterBreadcrumb = document.getElementById("chapterBreadcrumb");
const chapterTitle = document.getElementById("chapterTitle");
const chapterPublishDate = document.getElementById("chapterPublishDate");
const chapterContent = document.getElementById("chapterContent");
const backToNovelBtn = document.getElementById("backToNovelBtn");
const progressBar = document.getElementById("progressBar");

// Navigation Buttons
const prevChapterTop = document.getElementById("prevChapterTop");
const nextChapterTop = document.getElementById("nextChapterTop");
const prevChapterBottom = document.getElementById("prevChapterBottom");
const nextChapterBottom = document.getElementById("nextChapterBottom");

// Font Size Buttons
const btnFontInc = document.getElementById("btnFontInc");
const btnFontDec = document.getElementById("btnFontDec");

// URL Params
const params = new URLSearchParams(window.location.search);
const chapterId = params.get("id");

let currentChapter = null;
let currentNovel = null;
let allChapters = [];
let fontSize = 18; // Default font size in px

if (!chapterId) {
    alert("Chapter ID not found!");
    window.location.href = "novels.html";
}

// 1. Fetch Chapter Data
async function loadChapterData() {
    try {
        const chapterRef = doc(db, "chapters", chapterId);
        const chapterSnap = await getDoc(chapterRef);

        if (!chapterSnap.exists()) {
            alert("Chapter not found!");
            window.location.href = "novels.html";
            return;
        }

        currentChapter = { id: chapterSnap.id, ...chapterSnap.data() };

        // Fetch Novel Details for Breadcrumbs & Back Link
        if (currentChapter.novelId) {
            await loadNovelDetails(currentChapter.novelId);
            await loadSiblingChapters(currentChapter.novelId);
        }

        renderChapterInfo();
    } catch (error) {
        console.error("Failed to load chapter:", error);
        chapterContent.textContent = "Failed to load chapter content. Please refresh or try again later.";
    }
}

// 2. Fetch Novel Information
async function loadNovelDetails(novelId) {
    try {
        const novelSnap = await getDoc(doc(db, "novels", novelId));
        if (novelSnap.exists()) {
            currentNovel = { id: novelSnap.id, ...novelSnap.data() };
            
            const title = currentNovel.title || "Novel Details";
            novelBreadcrumb.textContent = title;
            novelBreadcrumb.href = `novel-detail.html?id=${novelId}`;
            backToNovelBtn.href = `novel-detail.html?id=${novelId}`;
        }
    } catch (error) {
        console.error("Failed to load novel details:", error);
    }
}

// 3. Fetch All Chapters in Same Novel for Prev/Next Navigation
async function loadSiblingChapters(novelId) {
    try {
        const q = query(
            collection(db, "chapters"),
            where("novelId", "==", novelId)
        );
        const snapshot = await getDocs(q);

        allChapters = [];
        snapshot.docs.forEach((d) => {
            allChapters.push({ id: d.id, ...d.data() });
        });

        // Urutkan chapter berdasarkan nomor chapter (Ascending)
        allChapters.sort((a, b) => Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0));

        setupChapterNavigation();
    } catch (error) {
        console.error("Failed to load sibling chapters:", error);
    }
}

// 4. Render Chapter Info
function renderChapterInfo() {
    const chNum = currentChapter.chapterNumber ? `Chapter ${currentChapter.chapterNumber}` : "";
    const chTitle = currentChapter.title ? `${chNum}: ${currentChapter.title}` : chNum || "Untitled Chapter";

    document.title = `${chTitle} | Lazy Mochi`;
    chapterBreadcrumb.textContent = chNum || "Chapter";
    chapterTitle.textContent = chTitle;

    const dateStr = formatDate(currentChapter.createdAt || currentChapter.publishedAt);
    chapterPublishDate.textContent = `Published: ${dateStr}`;

    // Render Content Text
    const rawContent = currentChapter.content || "No content available.";
    chapterContent.textContent = rawContent;
}

// 5. Setup Prev / Next Chapter Links
function setupChapterNavigation() {
    const currentIndex = allChapters.findIndex((c) => c.id === chapterId);

    if (currentIndex === -1) return;

    // Previous Chapter
    if (currentIndex > 0) {
        const prevCh = allChapters[currentIndex - 1];
        setNavButtonState(prevChapterTop, `read-chapter.html?id=${prevCh.id}`, false);
        setNavButtonState(prevChapterBottom, `read-chapter.html?id=${prevCh.id}`, false);
    } else {
        setNavButtonState(prevChapterTop, "#", true);
        setNavButtonState(prevChapterBottom, "#", true);
    }

    // Next Chapter
    if (currentIndex < allChapters.length - 1) {
        const nextCh = allChapters[currentIndex + 1];
        setNavButtonState(nextChapterTop, `read-chapter.html?id=${nextCh.id}`, false);
        setNavButtonState(nextChapterBottom, `read-chapter.html?id=${nextCh.id}`, false);
    } else {
        setNavButtonState(nextChapterTop, "#", true);
        setNavButtonState(nextChapterBottom, "#", true);
    }
}

function setNavButtonState(btn, href, isDisabled) {
    if (!btn) return;
    btn.href = href;
    if (isDisabled) {
        btn.classList.add("disabled");
    } else {
        btn.classList.remove("disabled");
    }
}

// 6. Font Size Controls
btnFontInc?.addEventListener("click", () => {
    if (fontSize < 32) {
        fontSize += 2;
        chapterContent.style.fontSize = `${fontSize}px`;
    }
});

btnFontDec?.addEventListener("click", () => {
    if (fontSize > 12) {
        fontSize -= 2;
        chapterContent.style.fontSize = `${fontSize}px`;
    }
});

// 7. Reading Scroll Progress Bar
window.addEventListener("scroll", () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight <= 0) {
        progressBar.style.width = "100%";
        return;
    }
    const currentProgress = (window.scrollY / totalHeight) * 100;
    progressBar.style.width = `${Math.min(100, Math.max(0, currentProgress))}%`;
});

function formatDate(value) {
    if (!value) return "-";
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

loadChapterData();