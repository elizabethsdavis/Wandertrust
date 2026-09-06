// Outfit photos (Outfits batch).
//
// The whole PackPal state is ONE Firestore document capped at 1 MiB, so photos
// never go in it. In cloud mode the resized photo is uploaded to Firebase
// Storage at outfits/{uid}/{outfitId}.jpg (storage.rules: owner only) together
// with a card-sized rendition at outfits/{uid}/{outfitId}_card.jpg (Photo
// Quality fix: ~480 px, ~30–50 KB — the closet grid and the trip's outfit cards
// draw this one, crisp on a 3× phone screen, instead of the 80 px thumb that
// looked blurry there), and the outfit keeps { url, path, cardUrl, cardPath,
// thumb } — download URLs plus a tiny inline thumbnail (~80 px, ~2 KB) that
// shows instantly / offline while the card loads. Photos saved before the fix
// have no cardUrl: cards fall back to the full image (cached after first view).
// In local mode (no Firebase) the outfit keeps { dataUrl, thumb } — a 320 px
// JPEG data URL, which localStorage can afford.
//
// preparePhoto() does the resizing in the browser (canvas), so the upload is
// ~100–250 KB instead of a 4 MB camera original.
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app, LOCAL_MODE } from "./firebase";

export const storage = LOCAL_MODE || !app ? null : getStorage(app);

export const PHOTO_MAX_PX = 1200; // longest edge of the uploaded image
export const PHOTO_CARD_PX = 480; // longest edge of the card rendition (grid / trip cards)
export const PHOTO_LOCAL_PX = 320; // longest edge of the local-mode data URL
export const THUMB_PX = 80; // inline thumbnail (lives in the state blob)

/** True when this build can upload to Firebase Storage. */
export const photosUseStorage = () => !!storage;

/** What to show for an outfit's photo (largest available); null when none. */
export function photoSrc(photo) {
  if (!photo || typeof photo !== "object") return null;
  return photo.url || photo.dataUrl || photo.thumb || null;
}

/** The card rendition for grids / trip cards: ~480 px when it exists, else the full image (older photos), else local data. */
export function photoCard(photo) {
  if (!photo || typeof photo !== "object") return null;
  return photo.cardUrl || photo.url || photo.dataUrl || photo.thumb || null;
}

/** The tiny inline version — an instant placeholder while the real image loads. */
export function photoThumb(photo) {
  if (!photo || typeof photo !== "object") return null;
  return photo.thumb || photo.dataUrl || photo.url || null;
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}

function drawScaled(src, maxPx) {
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));

/**
 * preparePhoto(file) → { blob, cardBlob, thumb, dataUrl, width, height }
 *   blob      JPEG ≤ PHOTO_MAX_PX for Storage (the sheet / full view)
 *   cardBlob  JPEG ≤ PHOTO_CARD_PX for Storage (grid + trip cards)
 *   thumb     JPEG data URL ≤ THUMB_PX (goes in the state blob)
 *   dataUrl   JPEG data URL ≤ PHOTO_LOCAL_PX (local mode only, else null)
 */
export async function preparePhoto(file, { forLocal = !photosUseStorage() } = {}) {
  if (!file || !/^image\//.test(file.type || "")) throw new Error("Pick a photo (JPEG, PNG, HEIC…).");
  const src = await loadBitmap(file);
  const big = drawScaled(src, PHOTO_MAX_PX);
  const blob = await toBlob(big, 0.82);
  const cardBlob = forLocal ? null : await toBlob(drawScaled(big, PHOTO_CARD_PX), 0.8);
  const thumb = drawScaled(big, THUMB_PX).toDataURL("image/jpeg", 0.6);
  const dataUrl = forLocal ? drawScaled(big, PHOTO_LOCAL_PX).toDataURL("image/jpeg", 0.7) : null;
  if (typeof src.close === "function") src.close();
  return { blob, cardBlob, thumb, dataUrl, width: big.width, height: big.height };
}

/** Storage paths for an outfit's photo: the full image and its card rendition. */
export const outfitPhotoPath = (uid, outfitId) => `outfits/${uid}/${outfitId}.jpg`;
export const outfitCardPath = (uid, outfitId) => `outfits/${uid}/${outfitId}_card.jpg`;

const UPLOAD_META = { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" };

/**
 * savePhoto({ uid, outfitId, file }) → the `photo` value to store on the outfit.
 * Cloud: uploads the full image + the card rendition and returns
 * { url, path, cardUrl, cardPath, thumb }. Local: returns { dataUrl, thumb }.
 */
export async function savePhoto({ uid, outfitId, file }) {
  const prepared = await preparePhoto(file);
  if (!photosUseStorage() || !uid) return { dataUrl: prepared.dataUrl || prepared.thumb, thumb: prepared.thumb };
  const path = outfitPhotoPath(uid, outfitId);
  const cardPath = outfitCardPath(uid, outfitId);
  const r = ref(storage, path);
  const rc = ref(storage, cardPath);
  await uploadBytes(r, prepared.blob, UPLOAD_META);
  const url = await getDownloadURL(r);
  let cardUrl = null;
  try {
    await uploadBytes(rc, prepared.cardBlob || prepared.blob, UPLOAD_META);
    cardUrl = await getDownloadURL(rc);
  } catch (e) {
    console.warn("[PackPal] Card rendition not uploaded, cards will use the full image:", e?.message || e);
  }
  return cardUrl ? { url, path, cardUrl, cardPath, thumb: prepared.thumb } : { url, path, thumb: prepared.thumb };
}

/** Best-effort removal of the stored files (the outfit record is the caller's job). */
export async function deletePhoto(photo) {
  if (!photosUseStorage()) return;
  for (const path of [photo?.path, photo?.cardPath]) {
    if (!path) continue;
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      console.warn("[PackPal] Could not delete photo:", e?.message || e);
    }
  }
}
