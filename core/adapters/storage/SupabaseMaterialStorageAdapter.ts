import type { MaterialStoragePort } from "../../ports/storage/MaterialStoragePort";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseMaterialStorageAdapter implements MaterialStoragePort {
  async removeMaterial(filePath: string): Promise<void> {
    const supabase = createAdminClient();
    const urlParts = filePath.split("/materials/");
    if (urlParts.length <= 1) return;
    const storageFileName = decodeURIComponent(urlParts[1]);
    const { error } = await supabase.storage.from("materials").remove([storageFileName]);
    if (error) throw error;
  }
}

