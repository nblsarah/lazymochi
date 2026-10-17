import { auth, db } from "../../firebase/firebase-config.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = "ogrm6cpi";
const CLOUDINARY_UPLOAD_PRESET = "lazy_mochi_covers";

// Elements
const adminName = document.getElementById("adminName");
const topbarAvatar = document.getElementById("topbarAvatar");
const logoutBtn = document.getElementById("logoutBtn");

// Tab Items
const navItems = document.querySelectorAll(".settings-nav-item");
const tabSections = document.querySelectorAll(".settings-section");

// Form Profile
const profileForm = document.getElementById("profileForm");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const bioInput = document.getElementById("bio");
const avatarPreview = document.getElementById("avatarPreview");
const avatarInput = document.getElementById("avatarInput");
const btnBrowseAvatar = document.getElementById("btnBrowseAvatar");

// Form Website
const websiteForm = document.getElementById("websiteForm");
const siteNameInput = document.getElementById("siteName");
const contactEmailInput = document.getElementById("contactEmail");
const announcementBannerInput = document.getElementById("announcementBanner");
const siteDescriptionInput = document.getElementById("siteDescription");

// Form Security
const securityForm = document.getElementById("securityForm");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

let currentUser = null;
let newAvatarFile = null;

// Navigation Tabs Handler
navItems.forEach(item => {
    item.addEventListener("click", () => {
        const targetTab = item.dataset.tab;

        navItems.forEach(nav => nav.classList.remove("active"));
        tabSections.forEach(sec => sec.classList.remove("active"));

        item.classList.add("active");
        document.getElementById(targetTab)?.classList.add("active");
    });
});

// Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    currentUser = user;

    try {
        await loadAdminProfile();
        await loadWebsiteSettings();
    } catch (error) {
        console.error("Gagal inisialisasi Settings:", error);
    }
});

// Load Admin Profile
async function loadAdminProfile() {
    if (!currentUser) return;

    emailInput.value = currentUser.email || "";

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        const data = snap.data();
        usernameInput.value = data.username || currentUser.displayName || "";
        bioInput.value = data.bio || "";

        const photo = data.photoURL || currentUser.photoURL || "../images/avatar.png";
        avatarPreview.src = photo;
        if (topbarAvatar) topbarAvatar.src = photo;
        if (adminName) adminName.textContent = data.username || currentUser.displayName || "Admin";
    }
}

// Load Website Settings dari Firestore (doc settings/general)
async function loadWebsiteSettings() {
    try {
        const settingsRef = doc(db, "settings", "general");
        const snap = await getDoc(settingsRef);

        if (snap.exists()) {
            const data = snap.data();
            siteNameInput.value = data.siteName || "Lazy Mochi";
            contactEmailInput.value = data.contactEmail || "";
            announcementBannerInput.value = data.announcementBanner || "";
            siteDescriptionInput.value = data.siteDescription || "";
        }
    } catch (err) {
        console.error("Gagal memuat pengaturan website:", err);
    }
}

// Avatar Browse Handler
btnBrowseAvatar?.addEventListener("click", () => avatarInput?.click());

avatarInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        alert("Format avatar harus JPG, PNG, atau WEBP.");
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran avatar maksimal 2 MB.");
        return;
    }

    newAvatarFile = file;
    avatarPreview.src = URL.createObjectURL(file);
});

// Cloudinary Upload
async function uploadAvatarToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gagal upload avatar.");
    return data.secure_url;
}

// Save Profile Submit
profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const bio = bioInput.value.trim();

    if (!username) {
        alert("Username wajib diisi.");
        return;
    }

    const btn = document.getElementById("btnSaveProfile");
    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    try {
        let photoURL = avatarPreview.src;

        if (newAvatarFile) {
            photoURL = await uploadAvatarToCloudinary(newAvatarFile);
        }

        await updateDoc(doc(db, "users", currentUser.uid), {
            username,
            bio,
            photoURL
        });

        if (adminName) adminName.textContent = username;
        if (topbarAvatar) topbarAvatar.src = photoURL;

        alert("Profil berhasil diperbarui!");
    } catch (error) {
        console.error("Gagal update profil:", error);
        alert("Gagal update profil: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save"></i> Simpan Profil`;
        if (window.lucide) window.lucide.createIcons();
    }
});

// Save Website Settings Submit
websiteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const siteName = siteNameInput.value.trim();
    const contactEmail = contactEmailInput.value.trim();
    const announcementBanner = announcementBannerInput.value.trim();
    const siteDescription = siteDescriptionInput.value.trim();

    const btn = document.getElementById("btnSaveWebsite");
    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    try {
        await setDoc(doc(db, "settings", "general"), {
            siteName,
            contactEmail,
            announcementBanner,
            siteDescription,
            updatedAt: new Date()
        }, { merge: true });

        alert("Pengaturan website berhasil disimpan!");
    } catch (error) {
        console.error("Gagal update pengaturan situs:", error);
        alert("Gagal menyimpan pengaturan situs: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save"></i> Simpan Pengaturan Situs`;
        if (window.lucide) window.lucide.createIcons();
    }
});

// Security Password Update Submit
securityForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword !== confirmPassword) {
        alert("Konfirmasi password baru tidak cocok.");
        return;
    }

    const btn = document.getElementById("btnSaveSecurity");
    btn.disabled = true;
    btn.textContent = "Memproses...";

    try {
        // Re-sertifikasi akun sebelum ubah password
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // Update password baru
        await updatePassword(currentUser, newPassword);

        alert("Password berhasil diubah!");
        securityForm.reset();
    } catch (error) {
        console.error("Gagal ubah password:", error);
        alert("Gagal merubah password. Pastikan password saat ini benar.\n\nDetail: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="shield-check"></i> Ubah Password`;
        if (window.lucide) window.lucide.createIcons();
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
});