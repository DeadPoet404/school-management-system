import { Router } from "express";
import { GradesController } from "./grades.controller";

const router = Router();
const controller = new GradesController();

router.post("/submit", controller.submitMark);

export default router;