import React from "react";

export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(17.5, 10)">
                <path d="M 50 10 L 20 10 L 10 40 L 40 40 L 30 70 L 0 70" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="square" />
                <path d="M 65 10 L 35 10 L 25 40 L 55 40 L 45 70 L 15 70" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="square" />
            </g>
        </svg>
    );
}
