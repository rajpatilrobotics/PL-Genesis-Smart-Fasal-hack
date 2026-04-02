import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sensorRouter from "./sensor";
import aiRouter from "./ai";
import weatherRouter from "./weather";
import insuranceRouter from "./insurance";
import marketRouter from "./market";
import communityRouter from "./community";
import filecoinRouter from "./filecoin";
import rewardsRouter from "./rewards";
import analyticsRouter from "./analytics";
import creditRouter from "./credit";
import litRouter from "./lit";
import diseaseIntelRouter from "./disease-intel";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sensorRouter);
router.use(aiRouter);
router.use(weatherRouter);
router.use(insuranceRouter);
router.use(marketRouter);
router.use(communityRouter);
router.use(filecoinRouter);
router.use(rewardsRouter);
router.use(analyticsRouter);
router.use(creditRouter);
router.use(litRouter);
router.use(diseaseIntelRouter);

export default router;
