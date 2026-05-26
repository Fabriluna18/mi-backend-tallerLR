import { Router } from "express";
import {
  getInventario,
  createProducto,
  updateProducto,
  moverStock,
  getHistorial,
  desactivarProducto,
  reactivarProducto,
} from "../controllers/inventarioController.js";
import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

router.get(   "/inventario",                    verificarToken, getInventario);
router.post(  "/inventario",                    verificarToken, createProducto);
router.put(   "/inventario/:id",                verificarToken, updateProducto);
router.patch( "/inventario/:id/stock",          verificarToken, moverStock);
router.get(   "/inventario/:id/historial",      verificarToken, getHistorial);
router.patch( "/inventario/:id/desactivar",     verificarToken, desactivarProducto);
router.patch( "/inventario/:id/reactivar",      verificarToken, reactivarProducto);

export default router;