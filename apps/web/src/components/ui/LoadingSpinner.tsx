import React from "react";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    text?: string;
}

export default function LoadingSpinner({
    size = "md",
    className = "",
    text = "Loading..."
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-8 h-8",
        lg: "w-12 h-12"
    };

    const textSizeClasses = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg"
    };

    return (
        <div
            className={`flex flex-col items-center justify-center gap-2 ${className}`}
        >
            <div
                className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-blue-600`}
            />
            {text && (
                <p className={`text-gray-600 ${textSizeClasses[size]}`}>
                    {text}
                </p>
            )}
        </div>
    );
}
