import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getBaseUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost:8080";
  return `${proto}://${host}`;
}

function getGoogleCallbackUrl(req: any): string {
  return `${getBaseUrl(req)}/api/auth/google/callback`;
}

function safeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, googleId: _gi, ...safe } = user;
  return safe;
}

// ─── Email / Password ────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Email, password, and full name are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim() })
      .returning();

    req.session.userId = user.id;
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[POST /auth/register]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    req.session.userId = user.id;
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.json({ user: null });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google sign-in is not configured. Add GOOGLE_CLIENT_ID." });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleCallbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error: googleError } = req.query as Record<string, string>;

  const frontendBase = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "";

  if (googleError || !code) {
    res.redirect(`${frontendBase}/?auth_error=google_denied`);
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: getGoogleCallbackUrl(req),
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as any;
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("[Google OAuth] Token exchange failed:", tokens);
      res.redirect(`${frontendBase}/?auth_error=google_token`);
      return;
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json() as any;

    if (!googleUser.email) {
      res.redirect(`${frontendBase}/?auth_error=google_no_email`);
      return;
    }

    const email = googleUser.email.toLowerCase();
    const googleId = googleUser.id as string;

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, email), eq(usersTable.googleId, googleId)));

    let user: typeof usersTable.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(usersTable)
        .set({ googleId, updatedAt: new Date() })
        .where(eq(usersTable.id, existing.id))
        .returning();
      user = updated;
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({
          email,
          googleId,
          fullName: googleUser.name || email.split("@")[0],
          avatarUrl: googleUser.picture || null,
          passwordHash: null,
        })
        .returning();
      user = created;
    }

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    const redirectTo = user.profileComplete ? frontendBase || "/" : `${frontendBase}/onboarding`;
    res.redirect(redirectTo);
  } catch (err) {
    console.error("[Google OAuth] Callback error:", err);
    res.redirect(`${frontendBase}/?auth_error=google_failed`);
  }
});

export default router;
