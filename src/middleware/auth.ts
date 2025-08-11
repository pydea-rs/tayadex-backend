import { Context, Next } from "hono";
import { extractToken, verifyToken } from "../utils/auth";
import { prisma } from "../services/prisma";
import { Avatar, User } from "@prisma/client";

export interface AuthContext extends Context {
    user?: User & {
        avatar?: Avatar | null;
    };
}

export async function authMiddleware(c: AuthContext, next: Next) {
    try {
        const authHeader = c.req.header("Authorization");
        const token = extractToken(authHeader);

        if (!token) {
            return c.json({ error: "Authorization token required" }, 401);
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return c.json({ error: "Invalid or expired token" }, 401);
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { avatar: true },
        });

        if (!user) {
            return c.json({ error: "User not found" }, 401);
        }

        if (user.address.toLowerCase() !== decoded.address.toLowerCase()) {
            return c.json({ error: "Token address mismatch" }, 401);
        }

        c.set("user", user);

        await next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return c.json({ error: "Authentication failed" }, 500);
    }
}

export async function optionalAuthMiddleware(c: AuthContext, next: Next) {
    try {
        const authHeader = c.req.header("Authorization");
        const token = extractToken(authHeader);

        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                });

                if (
                    user &&
                    user.address.toLowerCase() === decoded.address.toLowerCase()
                ) {
                    c.set("user", user);
                } else {
                    c.set("user", null); // prevent any kind of injection
                }
            }
        }

        await next();
    } catch (error) {
        console.error("Optional auth middleware error:", error);
        await next();
    }
}
