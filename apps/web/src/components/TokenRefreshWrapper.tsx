"use client";

import { useEffect, useState } from "react";
import { subscribeToTokenRefresh } from "@/lib/api";
import TokenRefreshLoading from "./ui/TokenRefreshLoading";

interface TokenRefreshWrapperProps {
    children: React.ReactNode;
}

export default function TokenRefreshWrapper({
    children
}: TokenRefreshWrapperProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState(
        "Refreshing authentication..."
    );

    useEffect(() => {
        const unsubscribe = subscribeToTokenRefresh((isRefreshing, message) => {
            setIsRefreshing(isRefreshing);
            if (message) {
                setRefreshMessage(message);
            }
        });

        return unsubscribe;
    }, []);

    return (
        <>
            {children}
            <TokenRefreshLoading
                isVisible={isRefreshing}
                message={refreshMessage}
            />
        </>
    );
}
