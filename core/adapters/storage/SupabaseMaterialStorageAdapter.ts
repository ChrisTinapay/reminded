import type { MaterialStoragePort } from "../../ports/storage/MaterialStoragePort";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseMaterialStorageAdapter implements MaterialStoragePort {
  async removeMaterial(filePath: string): Promise<void> {
    const supabase = createAdminClient();
    // New format: filePath is the storage object key (e.g. "123-...-file.pdf")
    // Backward compatible: if an old public URL is stored, extract the key after "/materials/".
    let key = String(filePath || "").trim();
    if (!key) return;
    if (key.startsWith("http")) {
      const parts = key.split("/materials/");
      if (parts.length <= 1) return;
      key = decodeURIComponent(parts[1]);
    }
    const { error } = await supabase.storage.from("materials").remove([key]);
    if (error) throw error;
  }
}

