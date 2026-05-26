import { Router } from "express";
import { getDashboard } from "../controllers/dashboardAdminController.js";
import { getDashboardDueno } from "../controllers/dashboardDuenoController.js";
import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

router.get("/admin", verificarToken, getDashboard);
router.get("/dueno", getDashboardDueno);

export default router;