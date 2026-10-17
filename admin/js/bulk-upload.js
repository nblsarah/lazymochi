import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// DOM Elements
const novelSelect = document.getElementById("novelSelect");
const defaultStatus = document.getElementById("defaultStatus");
const dropzone = document.getElementById("dropzone");
const bulkFileInput = document.getElementById("bulkFileInput");
const filePreviewContainer = document.getElementById("filePreviewContainer");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressStatus = document.getElementById("progressStatus");
const submitBtn = document.getElementById("submitBtn");
const bulkUploadForm = document.getElementById("bulkUploadForm");
const adminName = document.getElementById("adminName");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let selectedFiles = [];

// Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    currentUser = user;

    try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (userSnapshot.exists() && adminName) {
            adminName.textContent = userSnapshot.data().username || user.displayName || "Admin";
        }
        await loadNovels();
    } catch (err) {
        console.error("Auth error:", err);
    }
});

// Load List Novel
async function loadNovels() {
    try {
        const snapshot = await getDocs(collection(db, "novels"));
        novelSelect.innerHTML = `<option value="">-- Pilih Novel --</option>`;
        
        const novels = [];
        snapshot.forEach((d) => novels.push({ id: d.id, ...d.data() }));
        novels.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

        novels.forEach((novel) => {
            const opt = document.createElement("option");
            opt.value = novel.id;
            opt.textContent = novel.title || "Untitled Novel";
            novelSelect.appendChild(opt);
        });
    } catch (error) {
        console.error("Gagal memuat novel:", error);
        novelSelect.innerHTML = `<option value="">Gagal memuat novel</option>`;
    }
}

// Handler Pilih File
dropzone?.addEventListener("click", () => bulkFileInput?.click());

bulkFileInput?.addEventListener("change", (e) => {
    handleFiles(Array.from(e.target.files));
});

dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.background = "#e0f0ff";
});

dropzone?.addEventListener("dragleave", () => {
    dropzone.style.background = "#f0f7ff";
});

dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.background = "#f0f7ff";
    if (e.dataTransfer.files.length) {
        handleFiles(Array.from(e.dataTransfer.files));
    }
});

// Mengekstrak Angka Chapter dari Nama File (e.g. "1.txt", "Chapter 02.txt", "3 - Judul.txt")
function parseChapterNumber(filename) {
    const match = filename.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

// Pembersihan & Pengurutan File berdasarkan Nomor Chapter
function handleFiles(files) {
    const txtFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));

    if (txtFiles.length === 0) {
        alert("Harap pilih file dengan format .txt");
        return;
    }

    // Urutkan file berdasarkan angka dalam nama file (1, 2, 3, 4, ...)
    txtFiles.sort((a, b) => {
        const numA = parseChapterNumber(a.name) ?? Infinity;
        const numB = parseChapterNumber(b.name) ?? Infinity;
        return numA - numB;
    });

    selectedFiles = txtFiles;
    renderPreview();
}

function renderPreview() {
    if (!filePreviewContainer) return;
    
    filePreviewContainer.replaceChildren();
    filePreviewContainer.style.display = "block";

    selectedFiles.forEach((file, idx) => {
        const chapterNum = parseChapterNumber(file.name) ?? (idx + 1);
        const cleanTitle = file.name.replace(/\.txt$/i, "");

        const item = document.createElement("div");
        item.className = "file-item";
        item.innerHTML = `
            <div class="file-info">
                <span class="badge-chapter">Chapter ${chapterNum}</span>
                <strong>${cleanTitle}</strong>
                <span style="color:#64748b; font-size:11px;">(${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <i data-lucide="check-circle-2" style="color:#16a34a; width:18px;"></i>
        `;
        filePreviewContainer.appendChild(item);
    });

    if (submitBtn) submitBtn.disabled = selectedFiles.length === 0;
    if (window.lucide) window.lucide.createIcons();
}

// Proses Upload Massal ke Firestore
bulkUploadForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const novelId = novelSelect.value;
    const status = defaultStatus.value;

    if (!novelId) {
        alert("Silakan pilih novel terlebih dahulu.");
        return;
    }

    if (selectedFiles.length === 0) {
        alert("Belum ada file .txt yang dipilih.");
        return;
    }

    submitBtn.disabled = true;
    novelSelect.disabled = true;
    progressContainer.style.display = "block";

    let successCount = 0;
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        const chapterNumber = parseChapterNumber(file.name) ?? (i + 1);
        const rawTitle = file.name.replace(/\.txt$/i, "").trim();

        // Format Judul Bersih:
        // Jika nama file hanya angka "2.txt", buat judul "Chapter 2"
        // Jika nama file ada judulnya "2 - Awal Mula.txt", buat judul "2 - Awal Mula" atau "Chapter 2: Awal Mula"
        let formattedTitle = rawTitle;
        if (/^\d+$/.test(rawTitle)) {
            formattedTitle = `Chapter ${chapterNumber}`;
        }

        try {
            const content = await file.text();

            // 1. Simpan dokumen Chapter ke Firestore
            await addDoc(collection(db, "chapters"), {
                novelId: novelId,
                chapterNumber: chapterNumber,
                title: formattedTitle,
                status: status,
                content: content.trim(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: currentUser.uid
            });

            // 2. Increment jumlah chapterCount di dokumen novel
            await updateDoc(doc(db, "novels", novelId), {
                chapterCount: increment(1),
                updatedAt: serverTimestamp()
            });

            successCount++;

            // Update Progress Bar
            const percent = Math.round(((i + 1) / totalFiles) * 100);
            progressBar.style.width = `${percent}%`;
            progressStatus.textContent = `Mengunggah (${i + 1}/${totalFiles}): ${file.name}...`;

        } catch (error) {
            console.error(`Gagal mengunggah ${file.name}:`, error);
        }
    }

    progressStatus.textContent = `Selesai! Berhasil mengunggah ${successCount} dari ${totalFiles} chapter.`;
    alert(`Berhasil mengunggah ${successCount} chapter!`);
    
    window.location.href = "chapters.html";
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});