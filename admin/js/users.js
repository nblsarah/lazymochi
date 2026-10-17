import { auth, db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const PAGE_SIZE = 10;

const elements = {
    search: document.getElementById("userSearch"),
    globalSearch: document.getElementById("globalUserSearch"),
    roleFilter: document.getElementById("roleFilter"),
    resetBtn: document.getElementById("resetFilter"),
    tableBody: document.getElementById("userTableBody"),
    summary: document.getElementById("tableSummary"),
    pagination: document.getElementById("userPagination"),
    adminName: document.getElementById("adminName"),
    logoutBtn: document.getElementById("logoutBtn")
};

let currentUser = null;
let users = [];
let filteredUsers = [];
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

        await loadUsers();
    } catch (error) {
        console.error("Gagal inisialisasi User Management:", error);
    }
});

// Load Users
async function loadUsers() {
    try {
        const snapshot = await getDocs(collection(db, "users"));
        users = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        // Urutkan dari role admin terlebih dahulu, lalu nama
        users.sort((a, b) => {
            const roleA = a.role || "user";
            const roleB = b.role || "user";
            if (roleA !== roleB) {
                return roleA === "admin" ? -1 : 1;
            }
            return (a.username || a.displayName || "").localeCompare(b.username || b.displayName || "");
        });

        filteredUsers = [...users];
        renderTable();
    } catch (error) {
        console.error("Gagal memuat pengguna:", error);
        renderEmptyState("Gagal memuat data pengguna dari Firestore.");
    }
}

function renderEmptyState(message) {
    elements.tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.style.textAlign = "center";
    cell.style.color = "#777a82";
    cell.style.padding = "24px";
    cell.textContent = message;
    row.appendChild(cell);
    elements.tableBody.appendChild(row);
    elements.summary.textContent = "Showing 0 users";
    elements.pagination.replaceChildren();
}

function applyFilters() {
    const search = (elements.search?.value || elements.globalSearch?.value || "").toLowerCase().trim();
    const selectedRole = (elements.roleFilter?.value || "").toLowerCase();

    filteredUsers = users.filter(user => {
        const username = (user.username || user.displayName || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const role = (user.role || "user").toLowerCase();

        const searchMatches = !search || username.includes(search) || email.includes(search);
        const roleMatches = !selectedRole || role === selectedRole;

        return searchMatches && roleMatches;
    });

    currentPage = 1;
    renderTable();
}

function renderTable() {
    elements.tableBody.replaceChildren();

    if (!filteredUsers.length) {
        renderEmptyState("Tidak ada pengguna yang cocok dengan filter.");
        return;
    }

    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredUsers.slice(start, start + PAGE_SIZE);

    pageItems.forEach((user, index) => {
        elements.tableBody.appendChild(createUserRow(user, start + index + 1));
    });

    const end = start + pageItems.length;
    elements.summary.textContent = `Showing ${start + 1} to ${end} of ${filteredUsers.length} users`;
    renderPagination(totalPages);

    if (window.lucide) window.lucide.createIcons();
    attachRoleChangeEvents();
    attachDeleteEvents();
}

function createUserRow(user, rowNumber) {
    const row = document.createElement("tr");

    const username = user.username || user.displayName || "User Tanpa Nama";
    const email = user.email || "-";
    const role = user.role || "user";
    const avatarUrl = user.photoURL || user.avatar || "../images/avatar.png";
    const createdAt = formatDate(user.createdAt);

    row.innerHTML = `
        <td style="text-align: center;">${rowNumber}</td>
        <td>
            <div class="user-info-cell">
                <img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(username)}" class="user-avatar" onerror="this.src='../images/avatar.png'">
                <div class="user-info-details">
                    <strong>${escapeHTML(username)}</strong>
                    <span>ID: ${escapeHTML(user.id.substring(0, 8))}...</span>
                </div>
            </div>
        </td>
        <td>${escapeHTML(email)}</td>
        <td style="text-align: center;">
            <span class="role-badge ${role}">
                <i></i>${role}
            </span>
        </td>
        <td style="text-align: center;">
            <select class="select-role-dropdown" data-id="${user.id}" ${user.id === currentUser.uid ? "disabled title='Tidak dapat mengubah role sendiri'" : ""}>
                <option value="user" ${role === "user" ? "selected" : ""}>User</option>
                <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
        </td>
        <td>${createdAt}</td>
        <td style="text-align: center;">
            <div class="actions" style="justify-content: center;">
                <button type="button" class="delete-user-btn" data-id="${user.id}" title="Hapus User" ${user.id === currentUser.uid ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}>
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

// Event Ubah Role
function attachRoleChangeEvents() {
    document.querySelectorAll(".select-role-dropdown").forEach(select => {
        select.addEventListener("change", async () => {
            const userId = select.dataset.id;
            const newRole = select.value;

            try {
                await updateDoc(doc(db, "users", userId), {
                    role: newRole
                });

                const user = users.find(u => u.id === userId);
                if (user) user.role = newRole;

                applyFilters();
                alert(`Role pengguna berhasil diubah menjadi ${newRole.toUpperCase()}`);
            } catch (error) {
                console.error("Gagal mengubah role:", error);
                alert("Gagal mengubah role pengguna: " + error.message);
                select.value = select.value === "admin" ? "user" : "admin";
            }
        });
    });
}

// Event Hapus User
function attachDeleteEvents() {
    document.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const userId = btn.dataset.id;
            const user = users.find(u => u.id === userId);

            if (!user) return;

            const confirmed = confirm(`Apakah Anda yakin ingin menghapus data pengguna "${user.username || user.email}"?`);
            if (!confirmed) return;

            try {
                await deleteDoc(doc(db, "users", userId));
                users = users.filter(u => u.id !== userId);
                applyFilters();
                alert("Pengguna berhasil dihapus.");
            } catch (error) {
                console.error("Gagal menghapus pengguna:", error);
                alert("Gagal menghapus pengguna: " + error.message);
            }
        });
    });
}

// Format Tanggal
function formatDate(value) {
    if (!value) return "—";
    let date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

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

// Listeners Filter & Search
elements.search?.addEventListener("input", () => {
    if (elements.globalSearch) elements.globalSearch.value = elements.search.value;
    applyFilters();
});

elements.globalSearch?.addEventListener("input", () => {
    if (elements.search) elements.search.value = elements.globalSearch.value;
    applyFilters();
});

elements.roleFilter?.addEventListener("change", applyFilters);

elements.resetBtn?.addEventListener("click", () => {
    if (elements.search) elements.search.value = "";
    if (elements.globalSearch) elements.globalSearch.value = "";
    if (elements.roleFilter) elements.roleFilter.value = "";
    applyFilters();
});

// Logout
elements.logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});