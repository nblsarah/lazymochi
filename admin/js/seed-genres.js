import { db } from "../../firebase/firebase-config.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

async function seedGenresFromNovels() {
    console.log("Memulai ekstraksi genre dari novel...");

    try {
        const novelsSnap = await getDocs(collection(db, "novels"));
        const existingGenresSnap = await getDocs(collection(db, "genres"));

        // Ambil genre yang sudah ada di collection genres
        const existingGenreNames = new Set(
            existingGenresSnap.docs.map(doc => (doc.data().name || "").toLowerCase().trim())
        );

        const extractedGenres = new Set();

        // Kumpulkan semua genre dari setiap novel
        novelsSnap.docs.forEach(doc => {
            const data = doc.data();
            const gList = Array.isArray(data.genres) ? data.genres : (data.genre ? [data.genre] : []);
            
            gList.forEach(g => {
                if (typeof g === "string" && g.trim()) {
                    extractedGenres.add(g.trim());
                }
            });
        });

        // Tambahkan juga genre standar jika belum ada
        const defaultGenres = ["Action", "Fantasy", "Adventure", "Martial Arts", "Romance"];
        defaultGenres.forEach(g => extractedGenres.add(g));

        let addedCount = 0;

        for (const genreName of extractedGenres) {
            if (!existingGenreNames.has(genreName.toLowerCase())) {
                await addDoc(collection(db, "genres"), {
                    name: genreName,
                    description: `Kategori novel ${genreName}`,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                console.log(`Berhasil menambahkan genre: ${genreName}`);
                addedCount++;
            }
        }

        alert(`Selesai! Berhasil memasukkan ${addedCount} genre baru ke Firestore.`);
        location.reload();
    } catch (error) {
        console.error("Gagal melakukan seed genre:", error);
    }
}

seedGenresFromNovels();