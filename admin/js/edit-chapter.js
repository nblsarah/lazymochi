import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// DOM Elements
const form = document.getElementById("editChapterForm");
const novelSelect = document.getElementById("novelId");
const chapterNumberInput = document.getElementById("chapterNumber");
const chapterTitleInput = document.getElementById("chapterTitle");
const chapterStatusSelect = document.getElementById("chapterStatus");
const publishDateInput = document.getElementById("publishDate");
const chapterContentInput = document.getElementById("chapterContent");

const chapterFile = document.getElementById("chapterFile");
const txtUpload = document.getElementById("txtUpload");
const browseTxtButton = document.getElementById("browseTxtButton");
const selectedFile = document.getElementById("selectedFile");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFile = document.getElementById("removeFile");

const adminName = document.getElementById("adminName");
const logoutBtn = document.getElementById("logoutBtn");

// URL Params
const params = new URLSearchParams(window.location.search);
const chapterId = params.get("id");

let currentUser = null;
let novels = [];

if (!chapterId) {
    alert("ID Chapter tidak ditemukan.");
    window.location.href = "chapters.html";
}

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
            alert("Anda tidak memiliki akses ke halaman ini.");
            window.location.href = "../index.html";
            return;
        }

        if (adminName) {
            adminName.textContent = userSnapshot.data().username || user.displayName || "Admin";
        }

        await loadNovels();
        await loadChapterData();
    } catch (error) {
        console.error("Gagal memuat data:", error);
        alert("Terjadi kesalahan saat memuat halaman Edit Chapter.");
    }
});

// Load Novels
async function loadNovels() {
    try {
        const snapshot = await getDocs(collection(db, "novels"));
        novels = [];
        snapshot.forEach((d) => novels.push({ id: d.id, ...d.data() }));

        novels.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

        novelSelect.innerHTML = `<option value="">Pilih novel...</option>`;
        novels.forEach((novel) => {
            const opt = document.createElement("option");
            opt.value = novel.id;
            opt.textContent = novel.title || "Untitled Novel";
            novelSelect.appendChild(opt);
        });
    } catch (error) {
        console.error("Gagal memuat list novel:", error);
    }
}

// Load Existing Chapter Data
async function loadChapterData() {
    try {
        const chapterRef = doc(db, "chapters", chapterId);
        const chapterSnap = await getDoc(chapterRef);

        if (!chapterSnap.exists()) {
            alert("Chapter tidak ditemukan.");
            window.location.href = "chapters.html";
            return;
        }

        const data = chapterSnap.data();

        novelSelect.value = data.novelId || "";
        chapterNumberInput.value = data.chapterNumber || "";
        chapterTitleInput.value = data.title || "";
        chapterStatusSelect.value = data.status || "published";
        chapterContentInput.value = data.content || "";

        if (data.publishDate) {
            const date = data.publishDate.toDate ? data.publishDate.toDate() : new Date(data.publishDate);
            publishDateInput.value = date.toISOString().slice(0, 16);
        }
    } catch (error) {
        console.error("Gagal mengambil data chapter:", error);
    }
}

// TXT File Handlers
browseTxtButton?.addEventListener("click", () => chapterFile?.click());

chapterFile?.addEventListener("change", () => {
    const file = chapterFile.files[0];
    if (file) handleTxtFile(file);
});

async function handleTxtFile(file) {
    if (!file.name.toLowerCase().endsWith(".txt")) {
        alert("Harap pilih file dengan format .txt");
        resetFileInput();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file .txt maksimal 5 MB.");
        resetFileInput();
        return;
    }

    try {
        const text = await file.text();
        chapterContentInput.value = text;

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = formatFileSize(file.size);

        if (txtUpload) txtUpload.style.display = "none";
        if (selectedFile) selectedFile.hidden = false;
        refreshIcons();
    } catch (error) {
        console.error("Gagal membaca file TXT:", error);
        alert("Gagal membaca file TXT.");
        resetFileInput();
    }
}

removeFile?.addEventListener("click", () => resetFileInput());

function resetFileInput() {
    if (chapterFile) chapterFile.value = "";
    if (selectedFile) selectedFile.hidden = true;
    if (txtUpload) txtUpload.style.display = "";
    refreshIcons();
}

// Form Submit (Update)
form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const novelId = novelSelect.value;
    const chapterNumber = Number(chapterNumberInput.value);
    const title = chapterTitleInput.value.trim();
    const status = chapterStatusSelect.value;
    const publishDate = publishDateInput.value;
    const content = chapterContentInput.value.trim();

    if (!novelId || !chapterNumber || !title || !content) {
        alert("Harap lengkapi semua field yang wajib diisi.");
        return;
    }

    const saveButton = form.querySelector(".save-button");
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `<i data-lucide="loader-circle"></i> Menyimpan...`;
        refreshIcons();
    }

    try {
        const chapterRef = doc(db, "chapters", chapterId);

        await updateDoc(chapterRef, {
            novelId,
            chapterNumber,
            title,
            status,
            publishDate: publishDate ? new Date(publishDate) : null,
            content,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        });

        alert("Chapter berhasil diperbarui!");
        window.location.href = "chapters.html";
    } catch (error) {
        console.error("Gagal memperbarui chapter:", error);
        alert("Gagal memperbarui chapter.\n\n" + error.message);

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = `<i data-lucide="save"></i> Simpan Perubahan`;
            refreshIcons();
        }
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function refreshIcons() {
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}