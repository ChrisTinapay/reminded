'use server';

import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext';
import { SupabaseDashboardReadModel } from '@core/adapters/persistence/supabase/SupabaseDashboardReadModel';
import { createApplicationContext, createDashboardService } from '@core/application/container';

/**
 * Combined fetch for the entire dashboard — SINGLE auth check, SINGLE DB connection.
 * Consolidates legacy per-widget server actions into one fetch path.
 * This avoids repeated auth checks and DB connections.
 *
 * Before: ~5 Supabase auth calls + ~8 Turso queries per dashboard load
 * After:  1 Supabase auth call + 5 Turso queries per dashboard load
 */
export async function fetchDashboardData(clientToday = null) {
    const auth = new SupabaseAuthContext();
    const dashboardReadModel = new SupabaseDashboardReadModel();
    const ctx = createApplicationContext({ auth, dashboardReadModel });
    const dashboardService = createDashboardService(ctx);
    return await dashboardService.fetchDashboardData(clientToday);
}
