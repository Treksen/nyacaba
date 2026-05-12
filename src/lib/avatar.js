import { supabase } from './supabase';

/**
 * Compress an image file to a square JPEG.
 *
 * Center-crops to a square then resizes to `size`×`size` pixels.
 * Returns a Blob (typically 15–60 KB for typical phone photos).
 *
 * @param {File} file   The image file (any size, any common format)
 * @param {object} opts Optional: { size = 400, quality = 0.85 }
 * @returns {Promise<Blob>}
 */
export async function compressAvatar(file, { size = 400, quality = 0.85 } = {}) {
  if (!file) throw new Error('No file provided');
  if (!file.type?.startsWith('image/')) throw new Error('Selected file is not an image');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // White background for transparent PNGs
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          // Center-crop to a square
          const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth  - sourceSize) / 2;
          const sy = (img.naturalHeight - sourceSize) / 2;
          ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Compression produced no output')),
            'image/jpeg',
            quality
          );
        } catch (err) { reject(err); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a compressed avatar for the given user and update profiles.avatar_url.
 *
 * Path convention: `{userId}/avatar.jpg`.
 * Appends a cache-busting timestamp to the stored URL so the new image
 * shows up immediately even though the storage path is reused.
 *
 * @param {File} file
 * @param {string} userId  auth.uid()
 * @returns {Promise<string>} the cache-busted public URL written to the profile
 */
export async function uploadAvatar(file, userId) {
  if (!userId) throw new Error('No user');

  const blob = await compressAvatar(file);
  const path = `${userId}/avatar.jpg`;

  const { error: upErr } = await supabase
    .storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  const finalUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: finalUrl })
    .eq('id', userId);
  if (updErr) throw updErr;

  return finalUrl;
}

/**
 * Remove the stored avatar and clear profiles.avatar_url.
 */
export async function removeAvatar(userId) {
  if (!userId) return;
  await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
}
