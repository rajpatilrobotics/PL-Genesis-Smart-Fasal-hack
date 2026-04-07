import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.json({ exists: false, profile: null });
      return;
    }
    const { passwordHash: _ph, googleId: _gi, ...safeUser } = user;
    res.json({ exists: true, profile: safeUser });
  } catch (err) {
    console.error("[GET /user/profile] Error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const {
    fullName,
    phone,
    village,
    district,
    state,
    farmSizeAcres,
    primaryCrop,
    farmingExperienceYears,
    avatarUrl,
  } = req.body;

  if (!fullName) {
    res.status(400).json({ error: "Full name is required" });
    return;
  }

  try {
    const profileData = {
      fullName,
      phone: phone || null,
      village: village || null,
      district: district || null,
      state: state || null,
      farmSizeAcres: farmSizeAcres ? parseFloat(farmSizeAcres) : null,
      primaryCrop: primaryCrop || null,
      farmingExperienceYears: farmingExperienceYears ? parseFloat(farmingExperienceYears) : null,
      avatarUrl: avatarUrl || null,
      profileComplete: true,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(usersTable)
      .set(profileData)
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { passwordHash: _ph, googleId: _gi, ...safeUser } = updated;
    res.json({ profile: safeUser });
  } catch (err) {
    console.error("[PUT /user/profile] Error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

export default router;
