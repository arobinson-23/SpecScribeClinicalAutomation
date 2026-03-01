import type { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { AuthSession, PracticeId, UserId } from "@/types/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_IDLE_SECONDS = 15 * 60;   // 15 minutes
const SESSION_MAX_SECONDS = 24 * 60 * 60; // 24 hours

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_SECONDS },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "MOCK_CLIENT_SECRET",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { practice: { select: { id: true, subscriptionTier: true } } },
        });

        if (!user || !user.active || user.deletedAt) return null;

        // Check lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const passwordMatch = await compare(password, user.passwordHash);

        if (!passwordMatch) {
          // Increment failed login count
          const newCount = user.failedLoginCount + 1;
          const lockedUntil = newCount >= 5
            ? new Date(Date.now() + 30 * 60 * 1000) // 30-minute lockout
            : null;

          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: newCount, lockedUntil },
          });
          return null;
        }

        // Reset failed count on successful password check
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          practiceId: user.practiceId,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          mfaVerified: false, // must complete MFA step
        } as User & { practiceId: string; role: string; mfaEnabled: boolean; mfaVerified: boolean };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as User & {
          practiceId: string;
          role: string;
          mfaEnabled: boolean;
          mfaVerified: boolean;
        };
        token.practiceId = u.practiceId;
        token.role = u.role;
        token.mfaEnabled = u.mfaEnabled;
        token.mfaVerified = u.mfaVerified;
        token.lastActivity = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as unknown as AuthSession & Session).userId = token.sub as UserId;
        (session as unknown as AuthSession & Session).practiceId = token.practiceId as PracticeId;
        (session as unknown as { role: string }).role = token.role as string;
        (session as unknown as { mfaVerified: boolean }).mfaVerified = token.mfaVerified as boolean;
      }
      return session;
    },
  },
};
