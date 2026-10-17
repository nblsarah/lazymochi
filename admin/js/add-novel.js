import { auth, db } from "../../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


// =========================
// CLOUDINARY CONFIG
// =========================

const CLOUDINARY_CLOUD_NAME = "ogrm6cpi";
const CLOUDINARY_UPLOAD_PRESET = "lazy_mochi_covers";


// =========================
// FORM
// =========================

const form = document.getElementById("addNovelForm");

let currentUser = null;


// =========================
// AUTH
// =========================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        alert("Please log in first.");
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

});


// =========================
// CLOUDINARY UPLOAD
// =========================

async function uploadCoverToCloudinary(file) {

    if (!file) {
        return "";
    }


    // Allowed formats

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        throw new Error(
            "Cover must be JPG, PNG, or WEBP."
        );

    }


    // Max 5 MB

    if (file.size > 5 * 1024 * 1024) {

        throw new Error(
            "Cover size must be less than 5 MB."
        );

    }


    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
    );


    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );


    const data = await response.json();


    if (!response.ok) {

        console.error(
            "Cloudinary error:",
            data
        );

        throw new Error(
            data.error?.message ||
            "Failed to upload cover to Cloudinary."
        );

    }


    return data.secure_url;

}


// =========================
// SAVE NOVEL
// =========================

form.addEventListener("submit", async (event) => {

    event.preventDefault();


    // =========================
    // AUTH CHECK
    // =========================

    if (!currentUser) {

        alert(
            "Authentication is still loading. Please try again."
        );

        return;

    }


    // =========================
    // FORM VALUES
    // =========================

    const title =
        document
            .getElementById("novelTitle")
            .value
            .trim();


    const alternativeTitle =
        document
            .getElementById("alternativeTitle")
            .value
            .trim();


    const author =
        document
            .getElementById("novelAuthor")
            .value
            .trim();


    const status =
        document
            .getElementById("novelStatus")
            .value;


    const language =
        document
            .getElementById("novelLanguage")
            .value;


    const synopsis =
        document
            .getElementById("novelSynopsis")
            .value
            .trim();


    const sourceUrl =
        document
            .getElementById("sourceUrl")
            .value
            .trim();


    const releaseYear =
        document
            .getElementById("releaseYear")
            .value;


    const translationStatus =
        document
            .getElementById("translationStatus")
            .value;


    const visibility =
        document
            .getElementById("visibility")
            .value;


    // =========================
    // COVER
    // =========================

    const coverInput =
        document.getElementById("novelCover");


    const coverFile =
        coverInput.files[0] || null;


    // =========================
    // GENRES
    // =========================

    const genres = Array.from(
        document.querySelectorAll(
            'input[name="genres"]:checked'
        )
    ).map(
        (checkbox) => checkbox.value
    );


    // =========================
    // VALIDATION
    // =========================

    if (!title) {

        alert(
            "Please enter the novel title."
        );

        return;

    }


    if (!author) {

        alert(
            "Please enter the author."
        );

        return;

    }


    if (!status) {

        alert(
            "Please select a status."
        );

        return;

    }


    if (!language) {

        alert(
            "Please select a language."
        );

        return;

    }


    if (genres.length === 0) {

        alert(
            "Please select at least one genre."
        );

        return;

    }


    if (!synopsis) {

        alert(
            "Please enter the synopsis."
        );

        return;

    }


    if (!visibility) {

        alert(
            "Please select visibility."
        );

        return;

    }


    // =========================
    // COVER VALIDATION
    // =========================

    if (coverFile) {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


        if (!allowedTypes.includes(coverFile.type)) {

            alert(
                "Cover must be JPG, PNG, or WEBP."
            );

            return;

        }


        if (coverFile.size > 5 * 1024 * 1024) {

            alert(
                "Cover size must be less than 5 MB."
            );

            return;

        }

    }


    // =========================
    // BUTTON LOADING
    // =========================

    const saveButtons =
        document.querySelectorAll(
            ".save-button"
        );


    saveButtons.forEach((button) => {

        button.disabled = true;

        button.textContent = "Saving...";

    });


    try {

        // =========================
        // UPLOAD COVER FIRST
        // =========================

        let coverUrl = "";


        if (coverFile) {

            saveButtons.forEach((button) => {

                button.textContent =
                    "Uploading Cover...";

            });


            coverUrl =
                await uploadCoverToCloudinary(
                    coverFile
                );

        }


        // =========================
        // CREATE NOVEL
        // =========================

        saveButtons.forEach((button) => {

            button.textContent =
                "Saving Novel...";

        });


        const novelRef = await addDoc(
            collection(db, "novels"),
            {

                title,

                alternativeTitle,

                author,

                status,

                language,

                genres,

                synopsis,

                sourceUrl,

                releaseYear:
                    releaseYear
                        ? Number(releaseYear)
                        : null,

                translationStatus,

                visibility,

                views: 0,

                bookmarkCount: 0,

                chapterCount: 0,

                coverUrl,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp(),

                createdBy:
                    currentUser.uid

            }
        );


        console.log(
            "Novel saved:",
            novelRef.id
        );


        // =========================
        // SUCCESS
        // =========================

        alert(
            "Novel successfully added!"
        );


        window.location.href =
            "novels.html";


    } catch (error) {

        console.error(
            "Error saving novel:",
            error
        );


        alert(
            "Failed to save novel.\n\n" +
            error.message
        );


        // =========================
        // RESET BUTTON
        // =========================

        saveButtons.forEach((button) => {

            button.disabled = false;

            button.textContent =
                "Save Novel";

        });

    }

});