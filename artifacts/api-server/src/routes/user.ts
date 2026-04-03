import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId));
    if (!user) {
      res.json({ exists: false, profile: null });
      return;
    }
    res.json({ exists: true, profile: user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
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
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId));
    const profileData = {
      clerkId: userId,
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

    if (existing) {
      const [updated] = await db.update(usersTable).set(profileData).where(eq(usersTable.clerkId, userId)).returning();
      res.json({ profile: updated });
    } else {
      const [created] = await db.insert(usersTable).values(profileData).returning();
      res.json({ profile: created });
    }
  } catch (err) {
    console.error("[PUT /user/profile] Error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

export default router;
