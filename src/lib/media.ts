import { supabase } from "@/integrations/supabase/client";

const BUCKET = "private";

/** Upload a file into the private bucket under the given folder (user id or "admin"). Returns storage path. */
export async function uploadFile(folder: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/** Admin-published artwork: upload and return a long-lived signed URL usable by every visitor. */
export async function uploadPublicImage(file: File) {
  const path = await uploadFile("admin", file);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (error || !data) throw error ?? new Error("Upload failed");
  return data.signedUrl;
}

export async function signedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}
