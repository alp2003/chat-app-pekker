import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Chat App", description: "…" };

export default function RootLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="h-screen">
            <body className="h-screen overflow-hidden">{children}</body>
        </html>
    );
}
