/**
 * Run this once from the browser console or as a one-shot script
 * to seed Firestore with the initial LibraryOS data.
 *
 * Usage: import and call seedDatabase() once.
 */
import { collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { books, members, loans } from "../data/libraryData";

async function clearCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function seedDatabase() {
  console.log("🌱 Seeding Firestore...");
  await clearCollection("books");
  await clearCollection("members");
  await clearCollection("loans");

  for (const book of books) {
    const { id, ...rest } = book;
    await addDoc(collection(db, "books"), rest);
  }
  for (const member of members) {
    const { id, ...rest } = member;
    await addDoc(collection(db, "members"), rest);
  }
  for (const loan of loans) {
    const { id, ...rest } = loan;
    await addDoc(collection(db, "loans"), rest);
  }

  console.log("✅ Firestore seeded successfully!");
}
