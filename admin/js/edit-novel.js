import { auth, db } from "../../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc,
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
// ELEMENTS
// =========================

const form = document.getElementById("addNovelForm");

const coverInput =
    document.getElementById("novelCover");

const coverPreview =
    document.getElementById("coverPreview");

const uploadPlaceholder =
    document.getElementById("uploadPlaceholder");


const params =
    new URLSearchParams(window.location.search);

const novelId =
    params.get("id");


let currentUser = null;

let existingCoverUrl = "";


// =========================
// CHECK NOVEL ID
// =========================

if (!novelId) {

    alert("Novel ID is missing.");

    window.location.href =
        "novels.html";

}


// =========================
// AUTH
// =========================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        alert("Please log in first.");

        window.location.href =
            "../login.html";

        return;

    }

    currentUser = user;

    await loadNovel();

});


// =========================
// LOAD NOVEL
// =========================

async function loadNovel() {

    try {

        console.log(
            "Loading novel:",
            novelId
        );


        const novelRef =
            doc(
                db,
                "novels",
                novelId
            );


        const snapshot =
            await getDoc(novelRef);


        if (!snapshot.exists()) {

            alert("Novel not found.");

            window.location.href =
                "novels.html";

            return;

        }


        const data =
            snapshot.data();


        console.log(
            "Novel data:",
            data
        );


        // =========================
        // BASIC INFORMATION
        // =========================

        document
            .getElementById("novelTitle")
            .value =
            data.title || "";


        document
            .getElementById("alternativeTitle")
            .value =
            data.alternativeTitle || "";


        document
            .getElementById("novelAuthor")
            .value =
            data.author || "";


        document
            .getElementById("novelStatus")
            .value =
            data.status || "";


        document
            .getElementById("novelLanguage")
            .value =
            data.language || "";


        document
            .getElementById("novelSynopsis")
            .value =
            data.synopsis || "";


        document
            .getElementById("sourceUrl")
            .value =
            data.sourceUrl || "";


        document
            .getElementById("releaseYear")
            .value =
            data.releaseYear || "";


        document
            .getElementById("translationStatus")
            .value =
            data.translationStatus || "";


        document
            .getElementById("visibility")
            .value =
            data.visibility || "";


        // =========================
        // GENRES
        // =========================

        const genres =
            Array.isArray(data.genres)
                ? data.genres
                : [];


        document
            .querySelectorAll(
                'input[name="genres"]'
            )
            .forEach((checkbox) => {

                checkbox.checked =
                    genres.includes(
                        checkbox.value
                    );

            });


        updateSelectedGenres();


        // =========================
        // EXISTING COVER
        // =========================

        existingCoverUrl =
            data.coverUrl || "";


        if (existingCoverUrl) {

            coverPreview.src =
                existingCoverUrl;

            coverPreview.classList.add(
                "visible"
            );

            uploadPlaceholder.hidden =
                true;

        }


    } catch (error) {

        console.error(
            "LOAD NOVEL ERROR:",
            error
        );


        alert(
            "Failed to load novel.\n\n" +
            error.message
        );

    }

}


// =========================
// GENRE DISPLAY
// =========================

function updateSelectedGenres() {

    const checkboxes =
        document.querySelectorAll(
            'input[name="genres"]'
        );


    const selected =
        Array.from(checkboxes)
            .filter(
                checkbox =>
                    checkbox.checked
            )
            .map(
                checkbox =>
                    checkbox.value
            );


    const placeholder =
        document.getElementById(
            "genrePlaceholder"
        );


    if (!placeholder) return;


    if (!selected.length) {

        placeholder.textContent =
            "Select genres...";

        placeholder.classList.remove(
            "genre-selected"
        );

        return;

    }


    placeholder.textContent =
        selected.join(", ");


    placeholder.classList.add(
        "genre-selected"
    );

}


// =========================
// COVER PREVIEW
// =========================

coverInput.addEventListener(
    "change",
    () => {

        const file =
            coverInput.files[0];


        if (!file) return;


        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            alert(
                "Cover must be JPG, PNG, or WEBP."
            );

            coverInput.value = "";

            return;

        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            alert(
                "Cover size must be less than 5 MB."
            );

            coverInput.value = "";

            return;

        }


        coverPreview.src =
            URL.createObjectURL(file);


        coverPreview.classList.add(
            "visible"
        );


        uploadPlaceholder.hidden =
            true;

    }
);


// =========================
// CLOUDINARY UPLOAD
// =========================

async function uploadCoverToCloudinary(file) {

    if (!file) {

        return "";

    }


    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        throw new Error(
            "Cover must be JPG, PNG, or WEBP."
        );

    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        throw new Error(
            "Cover size must be less than 5 MB."
        );

    }


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
    );


    const response =
        await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: "POST",
                body: formData
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        console.error(
            "Cloudinary error:",
            data
        );


        throw new Error(
            data.error?.message ||
            "Failed to upload cover."
        );

    }


    return data.secure_url;

}


// =========================
// SAVE
// =========================

form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        console.log(
            "SAVE BUTTON CLICKED"
        );


        if (!currentUser) {

            alert(
                "Authentication is still loading."
            );

            return;

        }


        // =========================
        // GET VALUES
        // =========================

        const title =
            document
                .getElementById(
                    "novelTitle"
                )
                .value
                .trim();


        const alternativeTitle =
            document
                .getElementById(
                    "alternativeTitle"
                )
                .value
                .trim();


        const author =
            document
                .getElementById(
                    "novelAuthor"
                )
                .value
                .trim();


        const status =
            document
                .getElementById(
                    "novelStatus"
                )
                .value;


        const language =
            document
                .getElementById(
                    "novelLanguage"
                )
                .value;


        const synopsis =
            document
                .getElementById(
                    "novelSynopsis"
                )
                .value
                .trim();


        const sourceUrl =
            document
                .getElementById(
                    "sourceUrl"
                )
                .value
                .trim();


        const releaseYear =
            document
                .getElementById(
                    "releaseYear"
                )
                .value;


        const translationStatus =
            document
                .getElementById(
                    "translationStatus"
                )
                .value;


        const visibility =
            document
                .getElementById(
                    "visibility"
                )
                .value;


        const genres =
            Array.from(
                document.querySelectorAll(
                    'input[name="genres"]:checked'
                )
            ).map(
                checkbox =>
                    checkbox.value
            );


        const coverFile =
            coverInput.files[0] || null;


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


        if (!genres.length) {

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
        // BUTTON LOADING
        // =========================

        const buttons =
            document.querySelectorAll(
                ".save-button"
            );


        buttons.forEach(
            (button) => {

                button.disabled =
                    true;

                button.textContent =
                    "Saving...";

            }
        );


        try {

            // =========================
            // COVER
            // =========================

            let coverUrl =
                existingCoverUrl;


            if (coverFile) {

                buttons.forEach(
                    (button) => {

                        button.textContent =
                            "Uploading Cover...";

                    }
                );


                coverUrl =
                    await uploadCoverToCloudinary(
                        coverFile
                    );


                console.log(
                    "Cloudinary cover URL:",
                    coverUrl
                );

            }


            // =========================
            // UPDATE FIRESTORE
            // =========================

            buttons.forEach(
                (button) => {

                    button.textContent =
                        "Saving Novel...";

                }
            );


            await updateDoc(
                doc(
                    db,
                    "novels",
                    novelId
                ),
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
                            ? Number(
                                releaseYear
                            )
                            : null,

                    translationStatus,

                    visibility,

                    coverUrl,

                    updatedAt:
                        serverTimestamp(),

                    updatedBy:
                        currentUser.uid

                }
            );


            console.log(
                "Novel successfully updated."
            );


            // =========================
            // SUCCESS
            // =========================

            alert(
                "Novel successfully updated!"
            );


            window.location.href =
                "novels.html";


        } catch (error) {

            console.error(
                "SAVE ERROR:",
                error
            );


            alert(
                "Failed to update novel.\n\n" +
                error.message
            );


            buttons.forEach(
                (button) => {

                    button.disabled =
                        false;

                    button.textContent =
                        "Save Novel";

                }
            );

        }

    }
);