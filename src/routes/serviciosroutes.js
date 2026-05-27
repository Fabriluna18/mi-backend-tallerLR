import { Router } from "express";
import {
  getServicios,
  getAllServicios,
  createServicio,
  updateServicio,
  desactivarServicio,
  reactivarServicio,
} from "../controllers/servicioscontroller.js";
import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

router.get(   "/servicios",                  verificarToken, getServicios);
router.get(   "/servicios/all",              verificarToken, getAllServicios);
router.post(  "/servicios",                  verificarToken, createServicio);
router.put(   "/servicios/:id",              verificarToken, updateServicio);
router.patch( "/servicios/:id/desactivar",   verificarToken, desactivarServicio);
router.patch( "/servicios/:id/reactivar",     verificarToken, reactivarServicio);
export default router;

console.log("")