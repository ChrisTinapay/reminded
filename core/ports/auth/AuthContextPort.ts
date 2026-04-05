import type { UserId, ProfileId } from "../../domain/shared/types";

export interface AuthUser {
  id: UserId;
  email?: string | null;
}

export interface AuthProfile {
  id: ProfileId;
  userId: UserId;
}

export interface AuthContextPort {
  getCurrentUser(): Promise<AuthUser | null>;
  getCurrentProfile(): Promise<AuthProfile | null>;
  requireUser(): Promise<AuthUser>;
}
