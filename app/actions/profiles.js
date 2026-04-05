'use server';

import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext';
import { createApplicationContext, createProfileService } from '@core/application/container';

function createProfilesModule() {
    const auth = new SupabaseAuthContext();
    const ctx = createApplicationContext({ auth });
    const profileService = createProfileService(ctx);
    return { profileService };
}

export async function saveTursoProfile(profileData) {
    const { profileService } = createProfilesModule();
    return await profileService.saveProfile(profileData);
}

export async function getTursoProfile() {
    const { profileService } = createProfilesModule();
    return await profileService.getProfile();
}
