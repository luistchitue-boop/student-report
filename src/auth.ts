import NextAuth from "next-auth"
import { PrismaClient } from "@prisma/client"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

declare global {
  var prismaAuthClient: PrismaClient | undefined;
}

const prisma = globalThis.prismaAuthClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAuthClient = prisma;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "E-mail e palavra-passe",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Palavra-passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("O e-mail e a palavra-passe são obrigatórios")
        }

        const email = String(credentials.email).trim().toLowerCase()

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          return null
        }

        if (!user.password) {
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }

      if (token.id) {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: token.id as string },
          select: { role: true },
        })

        token.role = teacher?.role ?? "COORDENADOR"
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = (token.email as string | undefined) ?? session.user.email
        session.user.name = (token.name as string | undefined) ?? session.user.name
        session.user.role = (token.role as string | undefined) ?? "COORDENADOR"
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
})

