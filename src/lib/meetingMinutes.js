import { supabase } from './supabase';

const BUCKET = 'meeting-minutes';
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — generous ceiling for a PDF

/**
 * Upload a PDF for the given meeting and return its public URL.
 * Path: {meetingId}/minutes.pdf — overwrites any existing file.
 * Cache-buster timestamp ensures the new file shows up immediately.
 */
export async function uploadMeetingMinutesPdf(file, meetingId) {
  if (!file) throw new Error('No file provided');
  if (!meetingId) throw new Error('Missing meeting id');
  if (file.type !== 'application/pdf') throw new Error('Please upload a PDF file');
  if (file.size > MAX_BYTES) throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);

  const path = `${meetingId}/minutes.pdf`;

  const { error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${publicUrl}?t=${Date.now()}`;
}

/**
 * Remove the stored PDF for a meeting.
 */
export async function removeMeetingMinutesPdf(meetingId) {
  if (!meetingId) return;
  await supabase.storage.from(BUCKET).remove([`${meetingId}/minutes.pdf`]);
}
