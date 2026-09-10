import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "holydays-dev-secret",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;
        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user?.passwordHash) return null;
          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            ownerKind: user.ownerKind,
            remember: credentials?.remember !== "false",
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: user.email.toLowerCase(),
            name: user.name || "Guest",
            image: user.image,
            googleId: account.providerAccountId,
            role: "TRAVELER",
            emailVerified: new Date(),
          },
        });
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: existing.googleId ?? account.providerAccountId,
            image: user.image ?? existing.image,
            emailVerified: existing.emailVerified ?? new Date(),
          },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role ?? "TRAVELER";
        token.ownerKind = user.ownerKind ?? null;
        const remember = (user as { remember?: boolean }).remember;
        token.remember = remember !== false;
        if (remember === false) {
          token.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
        }
      }
      const email = user?.email || token.email;
      if (email) {
        try {
          const db = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
          if (db) {
            token.id = db.id;
            token.email = db.email;
            token.role = db.role;
            token.ownerKind = db.ownerKind;
          }
        } catch {
          /* keep token if the database is briefly unavailable */
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = String(token.role ?? "TRAVELER");
        session.user.ownerKind = (token.ownerKind as string | null) ?? null;
      }
      return session;
    },
  },
};
