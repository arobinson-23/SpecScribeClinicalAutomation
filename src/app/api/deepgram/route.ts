import { createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
        console.error("DEEPGRAM_API_KEY is not set");
        return NextResponse.json(
            { error: "Deepgram API key not configured" },
            { status: 500 }
        );
    }

    try {
        const deepgram = createClient(apiKey);
        const projectId = process.env.DEEPGRAM_PROJECT_ID;

        // If no project ID is provided, return the master key directly
        if (!projectId) {
            return NextResponse.json({ key: apiKey });
        }

        // Create a temporary, short-lived project key for the client
        const { result, error } = await deepgram.manage.createProjectKey(
            projectId,
            {
                comment: "Temporary browser key for SpecScribe session",
                scopes: ["usage:write"],
                tags: ["clinical-session"],
                time_to_live_in_seconds: 3600, // 1 hour
            }
        );

        if (error) {
            console.error("Error creating Deepgram project key:", error);
            // Fallback: return the master key if scoped key creation fails
            return NextResponse.json({ key: apiKey });
        }

        return NextResponse.json({ key: result.key });
    } catch (err) {
        console.error("Deepgram key generation error:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
