import type { ProfileId, UserId } from "../../domain/shared/types";

export interface ProfileRecord {
  id: ProfileId;
  userId: UserId;
  fullName: string | null;
  email: string | null;
}

export interface ProfileRepository {
  getProfileByUserId(userId: UserId): Promise<ProfileRecord | null>;
}

