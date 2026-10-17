import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Elements
const genreTableBody = document.getElementById("genreTableBody");
const tableSummary = document.getElementById("tableSummary");
const globalGenreSearch = document.getElementById("globalGenreSearch");
const adminName = document.getElementById("adminName");
const logoutBtn = document.getElementById("logoutBtn");

// Modal Elements
const genreModal = document.getElementById("genreModal");
const modalTitle = document.getElementById("modalTitle");
const genreForm = document.getElementById("genreForm");
const genreIdInput = document.getElementById("genreId");
const genreNameInput = document.getElementById("genreName");
const genreDescriptionInput = document.getElementById("genreDescription");
const openAddGenreModalBtn = document.getElementById("openAddGenreModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");

let currentUser = null;
let genres = [];
let novels = [];

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
        await loadGenres();
    } catch (error) {
        console.error("Gagal inisialisasi:", error);
    }
});

// Load Data Novel untuk menghitung jumlah novel per genre
async function loadNovels() {
    try {
        const snapshot = await getDocs(collection(db, "novels"));
        novels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error("Gagal memuat data novel untuk kalkulasi genre:", err);
    }
}

// Load Data Genre
async function loadGenres() {
    try {
        const snapshot = await getDocs(collection(db, "genres"));
        genres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort secara alfabetis berdasarkan nama genre
        genres.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        renderGenresTable();
    } catch (error) {
        console.error("Gagal memuat genre:", error);
        genreTableBody.innerHTML = `
            <tr><td colspan="5" style="text-align: center; color: #ef4444;">Gagal memuat data genre.</td></tr>
        `;
    }
}

// Menghitung jumlah novel yang menggunakan genre tertentu
function countNovelsByGenre(genreName) {
    if (!genreName) return 0;
    const target = genreName.toLowerCase().trim();

    return novels.filter(novel => {
        const gList = Array.isArray(novel.genres) 
            ? novel.genres 
            : (novel.genre ? [novel.genre] : []);
        return gList.some(g => String(g).toLowerCase().trim() === target);
    }).length;
}

// Render Tabel
function renderGenresTable() {
    const searchTerm = (globalGenreSearch?.value || "").toLowerCase().trim();

    const filteredGenres = genres.filter(g => 
        (g.name || "").toLowerCase().includes(searchTerm) ||
        (g.description || "").toLowerCase().includes(searchTerm)
    );

    if (filteredGenres.length === 0) {
        genreTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #777a82; padding: 24px;">
                    Tidak ada genre yang ditemukan.
                </td>
            </tr>
        `;
        tableSummary.textContent = "Showing 0 genres";
        return;
    }

    genreTableBody.replaceChildren();

    filteredGenres.forEach((genre, index) => {
        const row = document.createElement("tr");

        const novelCount = countNovelsByGenre(genre.name);

        row.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td>
                <span class="genre-badge">${escapeHTML(genre.name || "Untitled")}</span>
            </td>
            <td style="color: #5f626a;">${escapeHTML(genre.description || "-")}</td>
            <td style="text-align: center;"><strong>${novelCount}</strong> Novel</td>
            <td>
                <div class="actions" style="display: flex; justify-content: center; gap: 8px;">
                    <button type="button" class="edit-genre-btn" data-id="${genre.id}" title="Edit Genre">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button type="button" class="delete-genre-btn" data-id="${genre.id}" title="Hapus Genre">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;

        genreTableBody.appendChild(row);
    });

    tableSummary.textContent = `Showing ${filteredGenres.length} genres`;
    if (window.lucide) window.lucide.createIcons();

    attachActionEvents();
}

// Modal Control
function openModal(isEdit = false, genre = null) {
    modalTitle.textContent = isEdit ? "Edit Genre" : "Tambah Genre";
    
    if (isEdit && genre) {
        genreIdInput.value = genre.id;
        genreNameInput.value = genre.name || "";
        genreDescriptionInput.value = genre.description || "";
    } else {
        genreForm.reset();
        genreIdInput.value = "";
    }

    genreModal.classList.add("active");
}

function closeModal() {
    genreModal.classList.remove("active");
}

openAddGenreModalBtn?.addEventListener("click", () => openModal(false));
closeModalBtn?.addEventListener("click", closeModal);
cancelModalBtn?.addEventListener("click", closeModal);

genreModal?.addEventListener("click", (e) => {
    if (e.target === genreModal) closeModal();
});

// Attach Edit & Delete Events
function attachActionEvents() {
    document.querySelectorAll(".edit-genre-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const genre = genres.find(g => g.id === id);
            if (genre) openModal(true, genre);
        });
    });

    document.querySelectorAll(".delete-genre-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const genre = genres.find(g => g.id === id);

            if (!genre) return;

            const confirmed = confirm(`Apakah Anda yakin ingin menghapus genre "${genre.name}"?`);
            if (!confirmed) return;

            try {
                await deleteDoc(doc(db, "genres", id));
                genres = genres.filter(g => g.id !== id);
                renderGenresTable();
            } catch (error) {
                console.error("Gagal menghapus genre:", error);
                alert("Gagal menghapus genre: " + error.message);
            }
        });
    });
}

// Form Submit (Save / Update)
genreForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = genreIdInput.value;
    const name = genreNameInput.value.trim();
    const description = genreDescriptionInput.value.trim();

    if (!name) {
        alert("Nama genre wajib diisi.");
        return;
    }

    const saveBtn = document.getElementById("saveGenreBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "genres", id), {
                name,
                description,
                updatedAt: serverTimestamp()
            });

            const index = genres.findIndex(g => g.id === id);
            if (index !== -1) {
                genres[index] = { ...genres[index], name, description };
            }
        } else {
            // Create
            const docRef = await addDoc(collection(db, "genres"), {
                name,
                description,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            genres.push({
                id: docRef.id,
                name,
                description
            });
        }

        genres.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        renderGenresTable();
        closeModal();
    } catch (error) {
        console.error("Gagal menyimpan genre:", error);
        alert("Gagal menyimpan genre: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Simpan";
    }
});

// Search Filter
globalGenreSearch?.addEventListener("input", renderGenresTable);

// Logout Handler
logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});

function escapeHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}