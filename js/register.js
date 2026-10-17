import { auth, db } from "../firebase/firebase-config.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const provider = new GoogleAuthProvider();
const googleBtn =
document.getElementById("googleSignUp");
const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    // ==========================
    // GET INPUTS
    // ==========================

    const username = document
        .getElementById("username")
        .value
        .trim();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    const confirmPassword = document
        .getElementById("confirmPassword")
        .value;

    const terms = document
        .getElementById("terms")
        .checked;

    // ==========================
    // VALIDATION
    // ==========================

    if (username.length < 3) {
        alert("Username minimal 3 karakter.");
        return;
    }

    if (password.length < 6) {
        alert("Password minimal 6 karakter.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Password tidak sama.");
        return;
    }

    if (!terms) {
        alert("Silakan setujui Terms of Service.");
        return;
    }

    // ==========================
    // REGISTER
    // ==========================

    try {

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        // ==========================
        // UPDATE DISPLAY NAME
        // ==========================

        await updateProfile(userCredential.user, {
            displayName: username
        });

        // ==========================
        // SAVE TO FIRESTORE
        // ==========================

        await setDoc(
            doc(db, "users", userCredential.user.uid),
            {
                uid: userCredential.user.uid,
                username: username,
                email: email,
                role: "user",
                createdAt: serverTimestamp()
            }
        );

        alert("Account berhasil dibuat!");

        window.location.href = "index.html";

    }

    catch (error) {

        switch (error.code) {

            case "auth/email-already-in-use":
                alert("Email sudah digunakan.");
                break;

            case "auth/invalid-email":
                alert("Format email tidak valid.");
                break;

            case "auth/weak-password":
                alert("Password terlalu lemah.");
                break;

            default:
                console.error(error);
                alert(error.message);
        }

    }

});

googleBtn.addEventListener("click", async () => {

    try{

        const result =
            await signInWithPopup(
                auth,
                provider
            );

        const user = result.user;

        await setDoc(
            doc(db,"users",user.uid),
            {
                uid:user.uid,
                username:user.displayName,
                email:user.email,
                role:"user",
                createdAt:serverTimestamp()
            },
            {
                merge:true
            }
        );

        window.location.href="index.html";

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

});