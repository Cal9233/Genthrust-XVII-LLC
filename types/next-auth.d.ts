import NextAuth, { type DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "internal" | "client"
      mfaEnabled?: boolean
      companyId?: number | null
      companyName?: string | null
      erpContactId?: number | null
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "internal" | "client"
    mfaEnabled?: boolean
    companyId?: number | null
    companyName?: string | null
    erpContactId?: number | null
  }
}
