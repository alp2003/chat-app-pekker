import SocketProviderShell from "./SocketProviderShell";

export default function ProtectedLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return <SocketProviderShell>{children}</SocketProviderShell>;
}
