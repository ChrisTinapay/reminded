import type { AuthContextPort } from "../../ports/auth/AuthContextPort";
import { createAdminClient } from "@/utils/supabase/admin";

export class ProfileService {
  constructor(private readonly auth: AuthContextPort) {}

  async saveProfile(profileData: any) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized — please sign in again." };

    const { full_name, academic_level_id, program_id, program, email: emailFromPayload } =
      profileData ?? {};
    const supabase = createAdminClient();
    const programText =
      (typeof program === "string" && program.trim()) ||
      (typeof program_id === "string" && program_id.trim()) ||
      null;
    const levelId =
      academic_level_id && String(academic_level_id).trim()
        ? String(academic_level_id).trim()
        : null;
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name,
        email: (emailFromPayload ?? user.email) || "",
        academic_level_id: levelId,
        program: programText,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error("Error saving profile to Supabase:", error);
      return { success: false, error: "Failed to save profile. Please try again." };
    }
    return { success: true };
  }

  async getProfile() {
    const user = await this.auth.getCurrentUser();
    if (!user) return null;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) {
      console.error("Error fetching profile from Supabase:", error);
      return null;
    }
    return data;
  }
}

