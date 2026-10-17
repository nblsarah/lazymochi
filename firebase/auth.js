import { auth } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

const googleBtn = document.getElementById("googleLogin");

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e)=>{

    e.preventDefault();

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    try{

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        alert("Login berhasil!");

        console.log(userCredential.user);

        window.location.href="index.html";

    }

    catch (error) {

        switch (error.code) {

            case "auth/invalid-credential":
                alert("Email atau password salah.");
                break;

            case "auth/invalid-email":
                alert("Format email tidak valid.");
                break;

            case "auth/too-many-requests":
                alert("Terlalu banyak percobaan login. Coba lagi beberapa saat.");
                break;

            default:
                console.error(error);
                alert("Terjadi kesalahan. Silakan coba lagi.");
        }

    }

});

googleBtn.addEventListener("click", async () => {

    try {

        await signInWithPopup(auth, provider);

        window.location.href = "index.html";

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

});