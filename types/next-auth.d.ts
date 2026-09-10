import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      ownerKind: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    ownerKind?: string | null;
    remember?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    ownerKind?: string | null;
    remember?: boolean;
  }
}
