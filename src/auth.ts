import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string }
        });
        
        if (!user) return null;
        
        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
        
        if (!isPasswordValid) return null;
        
        return {
          id: user.id.toString(),
          name: user.name,
          username: user.username,
          role: user.role
        } as any;
      }
    })
  ]
})
