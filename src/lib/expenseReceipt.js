import { supabase } from './supabase';

const BUCKET = 'expense-receipts';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — receipts don't need to be larger
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

/**
 * Upload an expense receipt (image or PDF) and return its public URL.
 * Path: {expenseId}/receipt.{ext} — replacement overwrites.
 */
export async function uploadExpenseReceipt(file, expenseId) {
  if (!file) throw new Error('No file provided');
  if (!expenseId) throw new Error('Missing expense id');
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please upload an image (JPG/PNG) or PDF receipt');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }

  // Pick extension from the mime type
  const ext = file.type === 'application/pdf' ? 'pdf'
    : file.type === 'image/png'                ? 'png'
    : file.type === 'image/webp'               ? 'webp'
    : file.type === 'image/heic'               ? 'heic'
    : 'jpg';
  const path = `${expenseId}/receipt.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${publicUrl}?t=${Date.now()}`;
}

export async function removeExpenseReceipt(expenseId) {
  if (!expenseId) return;
  // Try all known extensions since we don't know which one was uploaded
  const candidates = ['receipt.pdf', 'receipt.jpg', 'receipt.png', 'receipt.webp', 'receipt.heic']
    .map((f) => `${expenseId}/${f}`);
  await supabase.storage.from(BUCKET).remove(candidates);
}
