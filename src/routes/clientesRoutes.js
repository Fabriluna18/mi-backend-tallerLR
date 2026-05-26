import express from "express";
import { 
  getClientes, 
  createCliente, 
  updateCliente, 
  desactivarCliente, 
  reactivarCliente,
  // NUEVOS
  getVehiculosCliente,
  addVehiculoCliente,
  deleteVehiculo
} from "../controllers/clientesController.js";

const router = express.Router();

// Rutas existentes
router.get("/clientes", getClientes);
router.post("/clientes", createCliente);
router.put("/clientes/:id", updateCliente);
router.patch("/clientes/:id/desactivar", desactivarCliente);
router.patch("/clientes/:id/reactivar", reactivarCliente);

// NUEVAS RUTAS para múltiples vehículos
router.get("/clientes/:id/vehiculos", getVehiculosCliente);
router.post("/clientes/:id/vehiculos", addVehiculoCliente);
router.delete("/vehiculos/:id", deleteVehiculo);

export default router;