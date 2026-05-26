import { Router } from "express";
import {
  getEmpleados,
  getTodosEmpleados,
  createEmpleado,
  cambiarCodigo,
  desactivarEmpleado,
  reactivarEmpleado,
  registrarAsistencia,
  getAsistenciasHoy,
} from "../controllers/empleadosController.js";
import verificarToken from "../middleware/authMiddleware.js";

const router = Router();

// Rutas específicas ANTES de las rutas con :id
router.get(  "/empleados/asistencias-hoy",  verificarToken, getAsistenciasHoy);
router.get(  "/empleados/todos",            verificarToken, getTodosEmpleados);
router.post( "/empleados/registrar",        verificarToken, registrarAsistencia);

// Rutas generales
router.get(  "/empleados",                  verificarToken, getEmpleados);
router.post( "/empleados",                  verificarToken, createEmpleado);

// Rutas con :id
router.patch("/empleados/:id/codigo",       verificarToken, cambiarCodigo);
router.patch("/empleados/:id/desactivar",   verificarToken, desactivarEmpleado);
router.patch("/empleados/:id/reactivar",    verificarToken, reactivarEmpleado);

export default router;