import { NextResponse } from "next/server";
import { z } from "zod";

const demoSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    practiceName: z.string().min(1),
    specialty: z.string().min(1),
    practiceSize: z.string(),
    message: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validated = demoSchema.parse(body);

        // TODO: Send email to Gmail
        // In a real production app, you'd use Resend, SendGrid, or Nodemailer here.
        // Example logic:
        // await resend.emails.send({
        //   from: 'SpecScribe <onboarding@resend.dev>',
        //   to: 'your-gmail@gmail.com',
        //   subject: `Demo Request: ${validated.name} - ${validated.practiceName}`,
        //   text: `New Demo Request\n\nName: ${validated.name}\nEmail: ${validated.email}\nPractice: ${validated.practiceName}\nSpecialty: ${validated.specialty}\nSize: ${validated.practiceSize}\n\nMessage: ${validated.message || 'No message provided'}`
        // });

        console.log("DEMO REQUEST RECEIVED:", validated);

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DEMO_API_ERROR:", error);
        return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
}
