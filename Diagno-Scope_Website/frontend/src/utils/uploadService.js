import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase"; // Importing storage

/**
 * Uploads a single file to Firebase Storage.
 */
export async function uploadToFirebase(file) {
    if (!storage) {
        alert("System Error: Cloud Storage not initialized.");
        throw new Error("Firebase Storage not initialized");
    }

    try {
        const fileName = `scans/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);

        console.log(`Uploading ${file.name} to Cloud Storage...`);
        const snapshot = await uploadBytes(storageRef, file);

        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log("File available at", downloadURL);

        return downloadURL;
    } catch (error) {
        console.error("Cloud Upload Error:", error);
        alert(`Failed to upload image: ${file.name}. Error: ${error.message}`);
        throw error;
    }
}

/**
 * Uploads multiple files to Firebase Storage in parallel.
 */
export async function uploadMultipleFiles(files) {
    const fileArray = Array.from(files);
    console.log(`Starting upload for ${fileArray.length} files...`);

    if (fileArray.length === 0) return [];

    // Upload all files in parallel
    const urlPromises = fileArray.map(file => uploadToFirebase(file));
    const urls = await Promise.all(urlPromises);

    return urls;
}

/**
 * Saves the case data to Firestore. 
 */
export async function saveCaseToFirestore(caseId, metadata, files) {
    if (!db) {
        alert("Database connection failed (Offline Mode).");
        return;
    }

    if (!caseId) {
        alert("Error: Case ID is missing.");
        return;
    }

    const cleanId = String(caseId).trim();
    console.log(`Processing Firestore Save for Case ID: ${cleanId}...`);

    try {
        // STEP 1: Upload Images (CRITICAL STEP)
        let imageUrls = [];
        if (files && files.length > 0) {
            try {
                imageUrls = await uploadMultipleFiles(files);
                console.log("All images uploaded successfully:", imageUrls);
            } catch (uploadError) {
                console.error("Critical Upload Error:", uploadError);
                // We alert the user but CONTINUED to save metadata might be desired?
                // The user specifically wants the URL. If upload fails, we should probably stop or warn loudly.
                alert("Warning: Images failed to upload to Cloud Storage. Saving record without images.");
            }
        }

        // STEP 2: Create new document
        const casesRef = collection(db, "cases");

        const newCaseData = {
            case_id: cleanId,
            Image_urls: imageUrls, // This determines if the field is populated
            ...metadata,
            created_at: serverTimestamp(),
            local_time: new Date().toISOString()
        };

        const newDocRef = await addDoc(casesRef, newCaseData);
        console.log(`New Document Created! Auto-ID: ${newDocRef.id}`);

        return { id: newDocRef.id, urls: imageUrls };
    } catch (error) {
        console.error("CRITICAL FIRESTORE ERROR in saveCaseToFirestore:", error);
        alert("Database Save Failed: " + error.message);
        return null;
    }
}
