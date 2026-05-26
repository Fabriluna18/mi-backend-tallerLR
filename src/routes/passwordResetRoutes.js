import express from "express";
import {
  solicitarRecuperacion,
  verificarToken,
  restablecerPassword,
} from "../controllers/passwordResetController.js";

const router = express.Router();

// POST /api/password-reset/request - Solicitar recuperación
router.post("/request", solicitarRecuperacion);

// GET /api/password-reset/verify/:token - Verificar token
router.get("/verify/:token", verificarToken);

// POST /api/password-reset/reset/:token - Restablecer contraseña
router.post("/reset/:token", restablecerPassword);

export default router;