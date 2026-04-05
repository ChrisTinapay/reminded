import type { AuthContextPort, AuthProfile, AuthUser } from "../../ports/auth/AuthContextPort";
import { createClient } from "@/utils/supabase/server";

export class SupabaseAuthContext implements AuthContextPort {
  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async requireUser(): Promise<AuthUser> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return user;
  }

  async getCurrentProfile(): Promise<AuthProfile | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;
    return { id: user.id, userId: user.id };
  }
}

