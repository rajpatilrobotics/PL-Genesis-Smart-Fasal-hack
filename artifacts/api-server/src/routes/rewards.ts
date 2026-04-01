import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rewardTransactionsTable, walletProfileTable } from "@workspace/db";
import { desc, eq, sum } from "drizzle-orm";
import {
  ConnectWalletBody,
  AddRewardPointsBody,
  GetRewardsResponse,
  ConnectWalletResponse,
  AddRewardPointsResponse,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

const DEFAULT_WALLET = "0xDEMO_WALLET_ADDRESS";

async function getOrCreateProfile(walletAddress?: string | null) {
  if (!walletAddress) {
    // Return aggregate for unconnected user
    const transactions = await db
      .select()
      .from(rewardTransactionsTable)
      .orderBy(desc(rewardTransactionsTable.createdAt))
      .limit(20);

    const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);
    const badges = totalPoints > 200 ? ["Top Contributor", "Sustainable Farmer"] :
                   totalPoints > 100 ? ["Sustainable Farmer"] :
                   totalPoints > 50 ? ["Active Farmer"] : [];

    return {
      walletAddress: null,
      totalPoints,
      badges,
      transactions,
    };
  }

  const [profile] = await db
    .select()
    .from(walletProfileTable)
    .where(eq(walletProfileTable.walletAddress, walletAddress));

  const transactions = await db
    .select()
    .from(rewardTransactionsTable)
    .where(eq(rewardTransactionsTable.walletAddress, walletAddress))
    .orderBy(desc(rewardTransactionsTable.createdAt))
    .limit(20);

  const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);
  const badges = profile?.badges || (
    totalPoints > 200 ? ["Top Contributor", "Sustainable Farmer"] :
    totalPoints > 100 ? ["Sustainable Farmer"] :
    totalPoints > 50 ? ["Active Farmer"] : []
  );

  return { walletAddress, totalPoints, badges, transactions };
}

router.get("/rewards", async (_req, res): Promise<void> => {
  const data = await getOrCreateProfile();
  res.json(GetRewardsResponse.parse(data));
});

router.post("/rewards/connect-wallet", async (req, res): Promise<void> => {
  const parsed = ConnectWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { walletAddress } = parsed.data;

  // Upsert wallet profile
  const existing = await db
    .select()
    .from(walletProfileTable)
    .where(eq(walletProfileTable.walletAddress, walletAddress));

  if (existing.length === 0) {
    await db.insert(walletProfileTable).values({
      walletAddress,
      totalPoints: 10,
      badges: [],
    });

    // Welcome reward
    await db.insert(rewardTransactionsTable).values({
      walletAddress,
      activity: "wallet_connect",
      points: 10,
    });

    await logEvent("rewards", `Wallet connected: ${walletAddress} - Welcome bonus: +10 FLOW points`);
  }

  const data = await getOrCreateProfile(walletAddress);
  res.json(ConnectWalletResponse.parse(data));
});

router.post("/rewards/add", async (req, res): Promise<void> => {
  const parsed = AddRewardPointsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { activity, points, walletAddress } = parsed.data;

  await db.insert(rewardTransactionsTable).values({
    walletAddress: walletAddress ?? undefined,
    activity,
    points,
  });

  await logEvent("rewards", `Reward points added: +${points} FLOW for ${activity}${walletAddress ? ` to ${walletAddress}` : ""}`);

  const data = await getOrCreateProfile(walletAddress);
  res.json(AddRewardPointsResponse.parse(data));
});

export default router;
