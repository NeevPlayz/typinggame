import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.82);
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadMedia(
  file: File,
  roomCode: string
): Promise<{ url: string; path: string; mediaType: "image" | "video" }> {
  const isVideo = file.type.startsWith("video/");
  const ext = isVideo ? "mp4" : "jpg";
  const path = `rooms/${roomCode}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);

  let blob: Blob = file;
  if (!isVideo) blob = await compressImage(file);

  await uploadBytes(storageRef, blob, { contentType: isVideo ? file.type : "image/jpeg" });
  const url = await getDownloadURL(storageRef);
  return { url, path, mediaType: isVideo ? "video" : "image" };
}

export async function deleteMedia(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // already deleted or not found — fine
  }
}
