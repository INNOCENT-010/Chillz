import { supabaseAdmin } from "./supabase-admin";

export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  referenceId?: string
) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    type,
    reference_id: referenceId || null,
    is_read: false,
  } as any);
}