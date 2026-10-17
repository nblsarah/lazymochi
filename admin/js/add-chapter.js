// =========================
// FIREBASE
// =========================

import {
    auth,
    db
} from "../../firebase/firebase-config.js";

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


// =========================
// ELEMENTS
// =========================

const form =
    document.getElementById("addChapterForm");

const novelSelect =
    document.getElementById("novelId");

const chapterNumberInput =
    document.getElementById("chapterNumber");

const chapterTitleInput =
    document.getElementById("chapterTitle");

const chapterStatusSelect =
    document.getElementById("chapterStatus");

const publishDateInput =
    document.getElementById("publishDate");

const chapterFile =
    document.getElementById("chapterFile");

const txtUpload =
    document.getElementById("txtUpload");

const browseTxtButton =
    document.getElementById("browseTxtButton");

const selectedFile =
    document.getElementById("selectedFile");

const fileName =
    document.getElementById("fileName");

const fileSize =
    document.getElementById("fileSize");

const removeFile =
    document.getElementById("removeFile");

const adminName =
    document.getElementById("adminName");

const logoutBtn =
    document.getElementById("logoutBtn");


// =========================
// STATE
// =========================

let currentUser = null;

let novels = [];

let chapterContent = "";

let selectedTxtFile = null;


// =========================
// AUTH
// =========================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "../login.html";

            return;
        }

        currentUser = user;

        try {

            // =========================
            // GET USER PROFILE
            // =========================

            const userSnapshot =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (!userSnapshot.exists()) {

                alert(
                    "User profile not found."
                );

                await signOut(auth);

                return;
            }


            const userData =
                userSnapshot.data();


            // =========================
            // ADMIN CHECK
            // =========================

            if (
                userData.role !== "admin"
            ) {

                alert(
                    "You do not have permission to access this page."
                );

                window.location.href =
                    "../index.html";

                return;
            }


            // =========================
            // ADMIN NAME
            // =========================

            if (adminName) {

                adminName.textContent =
                    userData.username ||
                    user.displayName ||
                    "Admin";

            }


            // =========================
            // LOAD NOVELS
            // =========================

            await loadNovels();

        }

        catch (error) {

            console.error(
                "Initialization error:",
                error
            );

            alert(
                "Failed to load Add Chapter page."
            );

        }

    }
);


// =========================
// LOAD NOVELS
// =========================

async function loadNovels() {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "novels"
                )
            );


        novels = [];


        snapshot.forEach(
            (document) => {

                novels.push({

                    id: document.id,

                    ...document.data()

                });

            }
        );


        // =========================
        // SORT NOVELS
        // =========================

        novels.sort(
            (a, b) => {

                const titleA =
                    a.title || "";

                const titleB =
                    b.title || "";

                return titleA.localeCompare(
                    titleB
                );

            }
        );


        // =========================
        // POPULATE SELECT
        // =========================

        populateNovelSelect();

    }

    catch (error) {

        console.error(
            "Failed to load novels:",
            error
        );

        if (novelSelect) {

            novelSelect.innerHTML = `
                <option value="">
                    Failed to load novels
                </option>
            `;

        }

        throw error;
    }

}


// =========================
// POPULATE NOVEL SELECT
// =========================

function populateNovelSelect() {

    if (!novelSelect) {
        return;
    }


    novelSelect.innerHTML = `
        <option value="">
            Select novel...
        </option>
    `;


    novels.forEach(
        (novel) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                novel.id;


            option.textContent =
                novel.title ||
                "Untitled Novel";


            novelSelect.appendChild(
                option
            );

        }
    );

}


// =========================
// TXT UPLOAD
// =========================


// =========================
// BROWSE BUTTON
// =========================

browseTxtButton?.addEventListener(
    "click",
    () => {

        if (!chapterFile) {
            return;
        }

        chapterFile.click();

    }
);


// =========================
// FILE SELECT
// =========================

chapterFile?.addEventListener(
    "change",
    () => {

        const file =
            chapterFile.files[0];


        if (!file) {
            return;
        }


        handleTxtFile(file);

    }
);


// =========================
// HANDLE TXT FILE
// =========================

async function handleTxtFile(file) {

    // =========================
    // CHECK EXTENSION
    // =========================

    const isTxt =
        file.name
            .toLowerCase()
            .endsWith(".txt");


    if (!isTxt) {

        alert(
            "Please upload a TXT file."
        );

        resetFileInput();

        return;
    }


    // =========================
    // CHECK SIZE
    // =========================

    const maxSize =
        5 * 1024 * 1024;


    if (
        file.size > maxSize
    ) {

        alert(
            "TXT file must be smaller than 5 MB."
        );

        resetFileInput();

        return;
    }


    try {

        // =========================
        // READ FILE
        // =========================

        const text =
            await file.text();


        if (!text.trim()) {

            alert(
                "The TXT file is empty."
            );

            resetFileInput();

            return;
        }


        // =========================
        // SAVE STATE
        // =========================

        selectedTxtFile =
            file;

        chapterContent =
            text;


        // =========================
        // SHOW FILE INFO
        // =========================

        if (fileName) {

            fileName.textContent =
                file.name;

        }


        if (fileSize) {

            fileSize.textContent =
                formatFileSize(
                    file.size
                );

        }


        // =========================
        // HIDE UPLOADER
        // =========================

        if (txtUpload) {

            txtUpload.style.display =
                "none";

        }


        // =========================
        // SHOW SELECTED FILE
        // =========================

        if (selectedFile) {

            selectedFile.hidden =
                false;

        }


        refreshIcons();


        console.log(
            "TXT loaded:",
            file.name
        );


        console.log(
            "Characters:",
            chapterContent.length
        );

    }

    catch (error) {

        console.error(
            "Failed to read TXT:",
            error
        );

        alert(
            "Failed to read TXT file."
        );

        resetFileInput();

    }

}


// =========================
// REMOVE FILE
// =========================

removeFile?.addEventListener(
    "click",
    () => {

        resetFileInput();

    }
);


// =========================
// RESET FILE
// =========================

function resetFileInput() {

    // Clear input
    if (chapterFile) {

        chapterFile.value =
            "";

    }


    // Clear state
    chapterContent =
        "";

    selectedTxtFile =
        null;


    // Hide selected file
    if (selectedFile) {

        selectedFile.hidden =
            true;

    }


    // Show uploader
    if (txtUpload) {

        txtUpload.style.display =
            "";

    }


    refreshIcons();

}


// =========================
// DRAG & DROP
// =========================

txtUpload?.addEventListener(
    "dragover",
    (event) => {

        event.preventDefault();

        txtUpload.classList.add(
            "dragover"
        );

    }
);


txtUpload?.addEventListener(
    "dragleave",
    () => {

        txtUpload.classList.remove(
            "dragover"
        );

    }
);


txtUpload?.addEventListener(
    "drop",
    (event) => {

        event.preventDefault();

        txtUpload.classList.remove(
            "dragover"
        );


        const files =
            event.dataTransfer.files;


        if (!files || !files.length) {
            return;
        }


        const file =
            files[0];


        handleTxtFile(file);

    }
);


// =========================
// FORM SUBMIT
// =========================

form?.addEventListener(
    "submit",
    async (event) => {

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
        // GET VALUES
        // =========================

        const novelId =
            novelSelect.value;


        const chapterNumber =
            Number(
                chapterNumberInput.value
            );


        const chapterTitle =
            chapterTitleInput.value
                .trim();


        const status =
            chapterStatusSelect.value;


        const publishDate =
            publishDateInput.value;


        const content =
            chapterContent.trim();


        // =========================
        // VALIDATION
        // =========================

        if (!novelId) {

            alert(
                "Please select a novel."
            );

            return;
        }


        if (
            !chapterNumber ||
            chapterNumber < 1
        ) {

            alert(
                "Please enter a valid chapter number."
            );

            return;
        }


        if (!status) {

            alert(
                "Please select a chapter status."
            );

            return;
        }


        if (!content) {

            alert(
                "Please upload a TXT chapter file."
            );

            return;
        }


        if (
            status === "scheduled" &&
            !publishDate
        ) {

            alert(
                "Please select a publish date for scheduled chapters."
            );

            return;
        }


        // =========================
        // DUPLICATE CHAPTER CHECK
        // =========================

        const duplicate =
            await checkDuplicateChapter(
                novelId,
                chapterNumber
            );


        if (duplicate) {

            const proceed =
                confirm(
                    `Chapter ${chapterNumber} already exists for this novel.\n\nDo you want to continue?`
                );


            if (!proceed) {
                return;
            }

        }


        // =========================
        // BUTTON LOADING
        // =========================

        const saveButton =
            form.querySelector(
                ".save-button"
            );


        if (saveButton) {

            saveButton.disabled =
                true;


            saveButton.innerHTML = `
                <i data-lucide="loader-circle"></i>
                Saving...
            `;


            refreshIcons();

        }


        try {

            // =========================
            // SAVE CHAPTER
            // =========================

            const chapterRef =
                await addDoc(
                    collection(
                        db,
                        "chapters"
                    ),
                    {

                        novelId,

                        chapterNumber,

                        title:
                            chapterTitle ||
                            `Chapter ${chapterNumber}`,

                        status,

                        publishDate:
                            publishDate
                                ? new Date(
                                    publishDate
                                )
                                : null,

                        content,

                        createdAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp(),

                        createdBy:
                            currentUser.uid

                    }
                );

                // =========================
                // UPDATE NOVEL CHAPTER COUNT
                // =========================

                await updateDoc(
                    doc(
                        db,
                        "novels",
                        novelId
                    ),
                    {
                        chapterCount:
                            increment(1),

                        updatedAt:
                            serverTimestamp()
                    }
                );


            console.log(
                "Chapter saved:",
                chapterRef.id
            );


            // =========================
            // SUCCESS
            // =========================

            alert(
                "Chapter successfully added!"
            );


            window.location.href =
                "chapters.html";

        }

        catch (error) {

            console.error(
                "Failed to save chapter:",
                error
            );


            alert(
                "Failed to save chapter.\n\n" +
                error.message
            );


            // Restore button
            if (saveButton) {

                saveButton.disabled =
                    false;


                saveButton.innerHTML = `
                    <i data-lucide="save"></i>
                    Save Chapter
                `;


                refreshIcons();

            }

        }

    }
);


// =========================
// DUPLICATE CHECK
// =========================

async function checkDuplicateChapter(
    novelId,
    chapterNumber
) {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "chapters"
                )
            );


        let duplicate = false;


        snapshot.forEach(
            (document) => {

                const data =
                    document.data();


                if (
                    data.novelId === novelId &&
                    Number(
                        data.chapterNumber
                    ) === chapterNumber
                ) {

                    duplicate = true;

                }

            }
        );


        return duplicate;

    }

    catch (error) {

        console.error(
            "Duplicate check failed:",
            error
        );

        // Don't block saving
        return false;
    }

}


// =========================
// LOGOUT
// =========================

logoutBtn?.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);


            window.location.href =
                "../login.html";

        }

        catch (error) {

            console.error(
                "Logout failed:",
                error
            );


            alert(
                "Failed to logout."
            );

        }

    }
);


// =========================
// FILE SIZE FORMAT
// =========================

function formatFileSize(bytes) {

    if (bytes < 1024) {

        return (
            bytes +
            " B"
        );

    }


    if (
        bytes <
        1024 * 1024
    ) {

        return (
            (bytes / 1024)
                .toFixed(1) +
            " KB"
        );

    }


    return (
        (bytes / (
            1024 * 1024
        )).toFixed(1) +
        " MB"
    );

}


// =========================
// LUCIDE REFRESH
// =========================

function refreshIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}