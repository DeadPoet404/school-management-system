import { Router } from "express";
import { TimetableController } from "./timetable.controller";

const router = Router();
const controller = new TimetableController();

router.get("/matrix", controller.getMatrix);
router.post("/matrix", controller.saveMatrix);

export default router;