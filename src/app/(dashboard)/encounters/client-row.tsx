"use client";

import { useRouter } from "next/navigation";
import { ReactNode } from "react";

interface ClientRowProps {
    href: string;
    className?: string;
    children: ReactNode;
}

export function ClientRow({ href, className, children }: ClientRowProps) {
    const router = useRouter();

    return (
        <tr
            className={className}
            onDoubleClick={() => router.push(href)}
            style={{ cursor: "pointer" }}
        >
            {children}
        </tr>
    );
}
