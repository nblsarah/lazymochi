import { db } from "../../firebase/firebase-config.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

async function fixChapterTitles() {
    console.log("Memulai perbaikan judul chapter...");

    try {
        const snapshot = await getDocs(collection(db, "chapters"));
        let updatedCount = 0;

        for (const chapterDoc of snapshot.docs) {
            const data = chapterDoc.data();
            const chapterNumber = data.chapterNumber;
            const currentTitle = data.title || "";

            // Deteksi judul pola ganda seperti "Chapter 2: 2", "Chapter 3: 3", dst.
            // atau pola ganda dengan titik dua
            const regexDoublePrefix = new RegExp(`^Chapter\\s*${chapterNumber}\\s*:\\s*${chapterNumber}$`, "i");

            if (regexDoublePrefix.test(currentTitle.trim())) {
                const newTitle = `Chapter ${chapterNumber}`;

                await updateDoc(doc(db, "chapters", chapterDoc.id), {
                    title: newTitle
                });

                console.log(`Berhasil mengubah "${currentTitle}" -> "${newTitle}"`);
                updatedCount++;
            }
        }

        alert(`Selesai! Berhasil merapikan ${updatedCount} judul chapter.`);
        location.reload(); // Refresh halaman setelah selesai
    } catch (error) {
        console.error("Gagal merapikan judul chapter:", error);
        alert("Terjadi kesalahan saat memperbarui judul chapter. Cek console untuk detail.");
    }
}

// Jalankan fungsi
fixChapterTitles();