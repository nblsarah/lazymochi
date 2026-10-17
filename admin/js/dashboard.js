import { auth, db } from "../../firebase/firebase-config.js";

import {
    collection,
    doc,
    getDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


// =========================
// DASHBOARD STATISTICS
// =========================

const novelSnapshot = await getDocs(collection(db, "novels"));
const userSnapshot = await getDocs(collection(db, "users"));
const chapterSnapshot = await getDocs(collection(db, "chapters"));

document.getElementById("totalNovels").textContent =
    novelSnapshot.size;

document.getElementById("totalUsers").textContent =
    userSnapshot.size;

document.getElementById("totalChapters").textContent =
    chapterSnapshot.size;

let totalViews = 0;

novelSnapshot.forEach((snapshot) => {
    totalViews += snapshot.data().views || 0;
});

document.getElementById("totalViews").textContent =
    totalViews.toLocaleString();


// =========================
// RECENT ACTIVITY
// =========================

const activityList =
    document.getElementById("activityList");

const viewAllActivities =
    document.getElementById("viewAllActivities");

const activities = [];


// Mengubah Firebase Timestamp menjadi Date
const toDate = (value) => {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
};


// Mengambil nama novel
const getNovelTitle = (data) => {
    return (
        data.title ||
        data.name ||
        data.novelTitle ||
        "Untitled novel"
    );
};


// Mengambil nama atau nomor chapter
const getChapterLabel = (data) => {
    return (
        data.chapterTitle ||
        data.title ||
        (
            data.chapterNumber != null
                ? `Chapter ${data.chapterNumber}`
                : "New chapter"
        )
    );
};


// Aktivitas dari collection novels
novelSnapshot.forEach((snapshot) => {
    const data = snapshot.data();

    const createdAt = toDate(data.createdAt);
    const updatedAt = toDate(data.updatedAt);
    const title = getNovelTitle(data);

    if (createdAt) {
        activities.push({
            action: "You added a new novel",
            detail: title,
            date: createdAt
        });
    }

    // Hindari createdAt dan updatedAt yang tercatat
    // sebagai dua aktivitas pada saat bersamaan
    if (
        updatedAt &&
        (
            !createdAt ||
            updatedAt.getTime() >
                createdAt.getTime() + 1000
        )
    ) {
        activities.push({
            action: "You updated novel information",
            detail: title,
            date: updatedAt
        });
    }
});


// Aktivitas dari collection chapters
chapterSnapshot.forEach((snapshot) => {
    const data = snapshot.data();

    const publishedAt = toDate(
        data.publishedAt || data.createdAt
    );

    if (!publishedAt) return;

    activities.push({
        action: "You published a new chapter",
        detail:
            `${getNovelTitle(data)} • ${getChapterLabel(data)}`,
        date: publishedAt
    });
});


// Urutkan dari aktivitas terbaru
activities.sort((a, b) => b.date - a.date);


// Format tanggal aktivitas
const formatActivityDate = (date) => {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
};


// Menampilkan aktivitas
const renderActivities = (showAll = false) => {
    activityList.replaceChildren();

    if (!activities.length) {
        const emptyItem =
            document.createElement("div");

        emptyItem.className = "activity-item";

        const message =
            document.createElement("p");

        message.textContent = "No activity yet.";

        emptyItem.appendChild(message);
        activityList.appendChild(emptyItem);

        viewAllActivities.hidden = true;

        return;
    }

    const visibleActivities = showAll
        ? activities
        : activities.slice(0, 3);

    visibleActivities.forEach(
        ({ action, detail, date }) => {
            const item =
                document.createElement("div");

            item.className = "activity-item";

            const heading =
                document.createElement("h4");

            heading.textContent = action;

            const description =
                document.createElement("p");

            description.textContent =
                `${detail} • ${formatActivityDate(date)}`;

            item.append(heading, description);
            activityList.appendChild(item);
        }
    );

    viewAllActivities.hidden =
        activities.length <= 3;

    viewAllActivities.textContent =
        showAll ? "Show Less" : "View All";
};


let showingAllActivities = false;

viewAllActivities.addEventListener("click", () => {
    showingAllActivities =
        !showingAllActivities;

    renderActivities(showingAllActivities);
});

renderActivities();


// =========================
// ADMIN PROFILE
// =========================

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const snapshot = await getDoc(
        doc(db, "users", user.uid)
    );

    const adminName =
        document.getElementById("adminName");

    if (adminName && snapshot.exists()) {
        const userData = snapshot.data();

        adminName.textContent =
            userData.username ||
            userData.name ||
            user.email;
    }
});