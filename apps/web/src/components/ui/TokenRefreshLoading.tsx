import React from "react";
import LoadingSpinner from "./LoadingSpinner";

interface TokenRefreshLoadingProps {
    isVisible: boolean;
    message?: string;
}

export default function TokenRefreshLoading({
    isVisible,
    message = "Refreshing authentication..."
}: TokenRefreshLoadingProps) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full mx-4 text-center">
                <LoadingSpinner size="lg" text="" />
                <h3 className="text-lg font-medium text-gray-900 mt-4 mb-2">
                    Please wait
                </h3>
                <p className="text-gray-600 text-sm">{message}</p>
                <div className="mt-4 text-xs text-gray-500">
                    This should only take a few seconds...
                </div>
            </div>
        </div>
    );
}
