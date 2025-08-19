"use server";

import { API, ACCESS_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function logoutAction() {
    // ask API to revoke refresh
    await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include" as any
    });
    const c = await cookies();
    c.delete(ACCESS_COOKIE);
    c.delete("u_name");
    return { ok: true };
}
