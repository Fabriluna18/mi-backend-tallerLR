import { Router } from "express";
import {
  getOrdenes,
  getOrdenesByCliente,
  createOrden,
  updateOrden,
  anularOrden,
  getMecanicos,
  getServicios,
  reactivarOrden,
} from "../controllers/ordenesController.js";
import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

router.get(   "/ordenes",                    verificarToken, getOrdenes);
router.get(   "/ordenes/cliente/:id",        verificarToken, getOrdenesByCliente);
router.post(  "/ordenes",                    verificarToken, createOrden);
router.put(   "/ordenes/:id",                verificarToken, updateOrden);
router.patch( "/ordenes/:id/anular",         verificarToken, anularOrden);
router.patch( "/ordenes/:id/reactivar",      verificarToken, reactivarOrden);
router.get(   "/mecanicos",                  verificarToken, getMecanicos);
router.get(   "/servicios",                  verificarToken, getServicios);

export default router;