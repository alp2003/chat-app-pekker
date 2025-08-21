// app/(protected)/page.tsx
import { cookies } from "next/headers";
import { getMe, listConversations } from "@/lib/api";
import Logger from "@/lib/logger";
import ProtectedPageClient from "./page.client";

export default async function ProtectedPage() {
    let initialData = null;

    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("access")?.value;

        if (accessToken) {
            const serverStart = performance.now();
            Logger.api.log("🚀", "Starting protected server-side bootstrap...");

            // Fetch user and conversations in parallel for better performance
            const [user, conversations] = await Promise.all([
                getMe(),
                listConversations()
            ]);

            initialData = { user, conversations };

            const serverTime = Math.round(performance.now() - serverStart);
            Logger.api.log(
                "🎉",
                `Protected server bootstrap complete in ${serverTime}ms`
            );
        } else {
            Logger.api.log(
                "⚠️",
                "No access token found - client will bootstrap"
            );
        }
    } catch (error) {
        Logger.api.error("❌", "Protected server bootstrap error:", error);
        // Fall back to client-side bootstrap
    }

    return <ProtectedPageClient initialData={initialData} />;
}
