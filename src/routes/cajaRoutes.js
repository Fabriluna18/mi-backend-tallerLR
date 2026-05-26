import { Router } from "express";

import {
  getCajaHoy,
  abrirCaja,
  getMovimientosResumen,
  registrarMovimiento,
  cerrarCaja,
  reabrirCaja,
} from "../controllers/cajaController.js";

import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

// Obtener caja
router.get(
  "/caja/hoy",
  verificarToken,
  getCajaHoy
);

// Abrir caja
router.post(
  "/caja/abrir",
  verificarToken,
  abrirCaja
);

// Reabrir caja
router.post(
  "/caja/reabrir",
  verificarToken,
  reabrirCaja
);

// Registrar movimiento
router.post(
  "/caja/movimiento",
  verificarToken,
  registrarMovimiento
);

// Resumen movimientos
router.get(
  "/caja/movimientos/resumen",
  verificarToken,
  getMovimientosResumen
);

// Cerrar caja
router.post(
  "/caja/cerrar",
  verificarToken,
  cerrarCaja
);

export default router;