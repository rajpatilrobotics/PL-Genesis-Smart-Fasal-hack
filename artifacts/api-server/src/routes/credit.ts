import { Router, type IRouter } from "express";
import { db, creditSeasonsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logEvent } from "../lib/event-logger.js";
import crypto from "crypto";

const router: IRouter = Router();

function simulateCid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `bafybeig${hash.substring(0, 52)}`;
}

function getRating(score: number): string {
  if (score >= 850) return "Excellent";
  if (score >= 750) return "Very Good";
  if (score >= 650) return "Good";
  if (score >= 550) return "Average";
  return "Poor";
}

router.post("/credit/seasons", async (req, res): Promise<void> => {
  const {
    farmerId = "default",
    season,
    cropGrown,
    acresPlanted,
    yieldKgPerAcre,
    soilHealthScore,
    practicesFollowed = [],
    weatherChallenges,
    inputCostPerAcre,
    revenuePerAcre,
    loanTaken,
    loanRepaid,
  } = req.body;

  if (!season || !cropGrown || acresPlanted == null || yieldKgPerAcre == null || soilHealthScore == null) {
    res.status(400).json({ error: "Missing required fields: season, cropGrown, acresPlanted, yieldKgPerAcre, soilHealthScore" });
    return;
  }

  const previousSeasons = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.farmerId, farmerId))
    .orderBy(desc(creditSeasonsTable.createdAt))
    .limit(5);

  let creditScore = 600;
  let scoreBreakdown = {
    yieldScore: 0,
    soilHealthScore: 0,
    practicesScore: 0,
    consistencyScore: 0,
    repaymentScore: 0,
    summary: "",
  };

  try {
    const historyContext = previousSeasons.length > 0
      ? `Previous seasons: ${previousSeasons.map(s =>
          `${s.season}: ${s.cropGrown}, yield ${s.yieldKgPerAcre} kg/acre, soil health ${s.soilHealthScore}/100, score ${s.creditScore}`
        ).join("; ")}`
      : "No previous seasons recorded.";

    const prompt = `You are a microfinance credit analyst specializing in Indian smallholder farmers. Analyze this farmer's seasonal farming record and compute a credit score.

CURRENT SEASON:
- Season: ${season}
- Crop: ${cropGrown}
- Acres: ${acresPlanted}
- Yield: ${yieldKgPerAcre} kg/acre
- Soil Health Score: ${soilHealthScore}/100
- Sustainable Practices: ${practicesFollowed.length > 0 ? practicesFollowed.join(", ") : "None reported"}
${weatherChallenges ? `- Weather Challenges: ${weatherChallenges}` : ""}
${inputCostPerAcre != null ? `- Input Cost: ₹${inputCostPerAcre}/acre` : ""}
${revenuePerAcre != null ? `- Revenue: ₹${revenuePerAcre}/acre` : ""}
${loanTaken != null ? `- Loan Taken: ₹${loanTaken}` : ""}
${loanRepaid != null ? `- Loan Repaid: ₹${loanRepaid}` : ""}

HISTORY: ${historyContext}

Compute a credit score from 300 to 900 (like CIBIL) based on:
- Yield performance vs crop average for the region (weight: 25%)
- Soil health maintenance and improvement (weight: 20%)
- Sustainable farming practices adopted (weight: 20%)
- Consistency across seasons (weight: 20%)
- Loan repayment if applicable (weight: 15%)

Return a JSON object with exactly:
{
  "creditScore": <integer 300-900>,
  "yieldScore": <0-25>,
  "soilHealthScore": <0-20>,
  "practicesScore": <0-20>,
  "consistencyScore": <0-20>,
  "repaymentScore": <0-15>,
  "summary": "2-3 sentence explanation for a bank officer about this farmer's creditworthiness"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const result = JSON.parse(content);
      creditScore = Math.min(900, Math.max(300, Number(result.creditScore) || 600));
      scoreBreakdown = {
        yieldScore: Number(result.yieldScore) || 0,
        soilHealthScore: Number(result.soilHealthScore) || 0,
        practicesScore: Number(result.practicesScore) || 0,
        consistencyScore: Number(result.consistencyScore) || 0,
        repaymentScore: Number(result.repaymentScore) || 0,
        summary: result.summary || "Credit analysis completed.",
      };
    }
  } catch (err) {
    console.error("Credit scoring AI error:", err);
    const yieldScore = Math.min(25, (yieldKgPerAcre / 40) * 25);
    const soilScore = Math.min(20, (soilHealthScore / 100) * 20);
    const practiceScore = Math.min(20, practicesFollowed.length * 4);
    const consistencyScore = Math.min(20, previousSeasons.length * 4);
    const repaymentScore = loanTaken && loanRepaid ? Math.min(15, (loanRepaid / loanTaken) * 15) : 10;
    creditScore = Math.round(300 + yieldScore * 10 + soilScore * 10 + practiceScore * 10 + consistencyScore * 10 + repaymentScore * 10);
    creditScore = Math.min(900, Math.max(300, creditScore));
    scoreBreakdown = {
      yieldScore,
      soilHealthScore: soilScore,
      practicesScore: practiceScore,
      consistencyScore,
      repaymentScore,
      summary: `Farmer shows ${getRating(creditScore).toLowerCase()} creditworthiness based on ${season} farming data.`,
    };
  }

  const record = {
    farmerId,
    season,
    cropGrown,
    acresPlanted,
    yieldKgPerAcre,
    soilHealthScore,
    practicesFollowed,
    weatherChallenges: weatherChallenges || null,
    inputCostPerAcre: inputCostPerAcre ?? null,
    revenuePerAcre: revenuePerAcre ?? null,
    loanTaken: loanTaken ?? null,
    loanRepaid: loanRepaid ?? null,
    creditScore,
    creditRating: getRating(creditScore),
    scoreBreakdown,
    ipfsCid: "",
    ipfsUrl: "",
  };

  const cidSeed = `credit-${farmerId}-${season}-${cropGrown}-${Date.now()}`;
  const cid = simulateCid(cidSeed);
  record.ipfsCid = cid;
  record.ipfsUrl = `https://ipfs.io/ipfs/${cid}`;

  const [row] = await db.insert(creditSeasonsTable).values(record).returning();

  await logEvent("credit", `Credit record: ${farmerId} | ${season} | ${cropGrown} | Score: ${creditScore} (${getRating(creditScore)}) | CID: ${cid}`);

  res.json(row);
});

router.get("/credit/seasons", async (req, res): Promise<void> => {
  const farmerId = (req.query.farmerId as string) || "default";
  const rows = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.farmerId, farmerId))
    .orderBy(desc(creditSeasonsTable.createdAt));
  res.json(rows);
});

router.get("/credit/profile", async (req, res): Promise<void> => {
  const farmerId = (req.query.farmerId as string) || "default";
  const seasons = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.farmerId, farmerId))
    .orderBy(desc(creditSeasonsTable.createdAt));

  if (seasons.length === 0) {
    res.json({
      farmerId,
      overallScore: 0,
      overallRating: "No History",
      totalSeasons: 0,
      averageYield: 0,
      averageSoilHealth: 0,
      seasons: [],
      trend: "No data",
      loanEligibility: "Submit at least one season to get loan eligibility",
    });
    return;
  }

  const overallScore = Math.round(seasons.reduce((a, s) => a + s.creditScore, 0) / seasons.length);
  const averageYield = seasons.reduce((a, s) => a + s.yieldKgPerAcre, 0) / seasons.length;
  const averageSoilHealth = seasons.reduce((a, s) => a + s.soilHealthScore, 0) / seasons.length;

  let trend = "Stable";
  if (seasons.length >= 2) {
    const recent = seasons[0].creditScore;
    const older = seasons[seasons.length - 1].creditScore;
    trend = recent > older + 20 ? "Improving" : recent < older - 20 ? "Declining" : "Stable";
  }

  let loanEligibility = "";
  if (overallScore >= 750) loanEligibility = "Eligible for loans up to ₹5,00,000 at competitive rates";
  else if (overallScore >= 650) loanEligibility = "Eligible for loans up to ₹2,00,000";
  else if (overallScore >= 550) loanEligibility = "Eligible for small loans up to ₹50,000 with guarantor";
  else loanEligibility = "Build more history to improve loan eligibility";

  res.json({
    farmerId,
    overallScore,
    overallRating: getRating(overallScore),
    totalSeasons: seasons.length,
    averageYield: Math.round(averageYield * 10) / 10,
    averageSoilHealth: Math.round(averageSoilHealth * 10) / 10,
    seasons,
    trend,
    loanEligibility,
  });
});

router.get("/credit/verify/:cid", async (req, res): Promise<void> => {
  const { cid } = req.params;
  const rows = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.ipfsCid, cid));

  if (rows.length === 0) {
    res.status(404).json({ error: "No record found for this CID" });
    return;
  }

  res.json(rows[0]);
});

export default router;
