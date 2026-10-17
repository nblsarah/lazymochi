import { db } from "./firebase-config.js";

import {

    collection,
    doc,

    addDoc,
    setDoc,
    getDoc,
    getDocs,

    updateDoc,
    deleteDoc,

    query,
    where,
    orderBy,
    limit

} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const novelsRef = collection(db, "novels");

const chaptersRef = collection(db, "chapters");

const usersRef = collection(db, "users");

const genresRef = collection(db, "genres");

const logsRef = collection(db, "logs");

const bookmarksRef = collection(db, "bookmarks");

const historyRef = collection(db, "history");

export async function addNovel(data){

    return await setDoc(

        doc(db,"novels",data.slug),

        data

    );

}

export async function getNovel(slug){

    const snapshot = await getDoc(

        doc(db,"novels",slug)

    );

    if(!snapshot.exists()){

        return null;

    }

    return snapshot.data();

}

export async function getAllNovels(){

    const snapshot = await getDocs(

        query(

            novelsRef,

            orderBy("title")

        )

    );

    return snapshot.docs.map(doc=>({

        id:doc.id,

        ...doc.data()

    }));

}

export async function deleteNovel(slug){

    await deleteDoc(

        doc(db,"novels",slug)

    );

}

export async function getNovelCount(){

    const snapshot = await getDocs(

        novelsRef

    );

    return snapshot.size;

}

export async function getUserCount(){

    const snapshot = await getDocs(

        usersRef

    );

    return snapshot.size;

}

export async function getChapterCount(){

    const snapshot = await getDocs(

        chaptersRef

    );

    return snapshot.size;

}

export async function getTotalViews(){

    const snapshot = await getDocs(

        novelsRef

    );

    let total = 0;

    snapshot.forEach(doc=>{

        total += doc.data().views || 0;

    });

    return total;

}

export async function getDashboardStats(){

    const [

        novels,

        chapters,

        users,

        views

    ] = await Promise.all([

        getNovelCount(),

        getChapterCount(),

        getUserCount(),

        getTotalViews()

    ]);

    return{

        novels,

        chapters,

        users,

        views

    };

}

export async function addLog(

    type,

    message,

    uid

){

    await addDoc(

        logsRef,

        {

            type,

            message,

            uid,

            createdAt:new Date()

        }

    );

}