// Simple utility to get cookies on the client side
export function getCookie(name: string): string {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(
        new RegExp(
            "(^| )" + name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&") + "=([^;]+)"
        )
    );
    return match ? decodeURIComponent(match[2]!) : "";
}
