import React from "react";

export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Clean "S" lettermark */}
            <path
                d="M68 28C68 14 56 8 46 8C36 8 26 15 26 28C26 40 38 46 50 50C62 54 74 60 74 72C74 85 64 92 54 92C44 92 32 85 32 72"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
