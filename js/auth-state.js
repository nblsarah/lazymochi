import { auth, db } from "../firebase/firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const authArea = document.getElementById("authArea");

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        authArea.innerHTML = `
            <a href="login.html" class="login-btn">
                Log In
            </a>
        `;

        return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));

    let userData = {};

    if (userDoc.exists()) {
        userData = userDoc.data();
    }

    let adminLink = "";

    if (userData.role === "admin") {

        adminLink = `
            <a href="admin/index.html">
                🛠 Admin Dashboard
            </a>
        `;

    }

    authArea.innerHTML = `
        <div class="user-menu">

            <button class="user-btn">

                ${userData.username || user.displayName || user.email}

                ▼

            </button>

            <div class="dropdown">

                ${adminLink}

                <a href="#">Profile</a>

                <a href="#">Bookmarks</a>

                <a href="#">Settings</a>

                <button id="logoutBtn">

                    Log Out

                </button>

            </div>

        </div>
    `;

    const menu = document.querySelector(".user-menu");
    const btn = document.querySelector(".user-btn");
    const dropdown = document.querySelector(".dropdown");

    btn.addEventListener("click", (e) => {

        e.stopPropagation();

        menu.classList.toggle("open");

    });

    dropdown.addEventListener("click", (e) => {

        e.stopPropagation();

    });

    document.addEventListener("click", () => {

        menu.classList.remove("open");

    });

    document
        .getElementById("logoutBtn")
        .addEventListener("click", async () => {

            await signOut(auth);

            location.reload();

        });

});
