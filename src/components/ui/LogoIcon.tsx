import React from "react";

// ORIGINAL LOGO — two parallel Z-zigzag paths.
// To revert: replace the return below with this block.
//
// return (
//   <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
//     <g transform="translate(17.5, 10)">
//       <path d="M 50 10 L 20 10 L 10 40 L 40 40 L 30 70 L 0 70" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="square" />
//       <path d="M 65 10 L 35 10 L 25 40 L 55 40 L 45 70 L 15 70" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="square" />
//     </g>
//   </svg>
// );

export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
    // NEW LOGO — geometric fountain-pen nib.
    // Two tines (evolved from the original two-path DNA) spread outward from a
    // flat top bar then converge to a sharp point, with a center slit — the
    // defining feature of a nib. Directly encodes "Scribe" (precision writing
    // instrument) while remaining angular and modern.
    return (
        <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Left tine: spreads out left then angles back to tip */}
            <path d="M 34 13 L 7 51 L 50 88" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Right tine: mirrors left */}
            <path d="M 66 13 L 93 51 L 50 88" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Top bar: flat head of the nib */}
            <line x1="27" y1="13" x2="73" y2="13" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            {/* Center slit: the nib slit, visible at mid-to-large sizes */}
            <line x1="50" y1="57" x2="50" y2="84" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
    );
}
