import type { ProfileRecord, ProfileRepository } from "../../../ports/persistence/ProfileRepository";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseProfileRepository implements ProfileRepository {
  async getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: String((data as any).id),
      userId: userId,
      fullName: (data as any).full_name,
      email: null,
    };
  }
}

