import db from "../config/db.js";

// ── GET /api/ordenes ───────────────────────────────────
export const getOrdenes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        o.id_orden, o.estado, o.fecha_ingreso, o.fecha_finalizacion,
        o.observaciones, o.precio_final, o.activo,
        o.id_vehiculo, o.id_servicio, o.creado_por,
        c.id_cliente, c.nombre AS cliente_nombre, c.telefono,
        v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo,
        v.patente AS vehiculo_patente, v.anio AS vehiculo_anio,
        s.nombre AS servicio_nombre,
        u.nombre AS mecanico_nombre
       FROM ordenes_servicio o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       JOIN clientes c ON c.id_cliente = v.id_cliente
       LEFT JOIN servicios s ON s.id_servicio = o.id_servicio
       LEFT JOIN usuarios u ON u.id_usuario = o.creado_por
       WHERE (o.activo = 1 OR o.estado = 'anulado')
       ORDER BY o.fecha_ingreso DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getOrdenes:", error);
    res.status(500).json({ message: "Error al obtener órdenes" });
  }
};

// ── GET /api/ordenes/cliente/:id ───────────────────────
export const getOrdenesByCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
        o.id_orden, o.estado, o.fecha_ingreso, o.fecha_finalizacion,
        o.observaciones, o.precio_final, o.activo,
        s.nombre AS servicio_nombre,
        u.nombre AS mecanico_nombre
       FROM ordenes_servicio o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       LEFT JOIN servicios s ON s.id_servicio = o.id_servicio
       LEFT JOIN usuarios u ON u.id_usuario = o.creado_por
       WHERE v.id_cliente = ?
       ORDER BY o.fecha_ingreso DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getOrdenesByCliente:", error);
    res.status(500).json({ message: "Error al obtener órdenes del cliente" });
  }
};

// ── POST /api/ordenes ──────────────────────────────────
export const createOrden = async (req, res) => {
  const { id_vehiculo, id_servicio, creado_por, observaciones, estado } = req.body;

  if (!id_vehiculo || !id_servicio) {
    return res.status(400).json({ message: "Vehículo y servicio son requeridos" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO ordenes_servicio 
        (id_vehiculo, id_servicio, creado_por, observaciones, estado, fecha_ingreso, activo)
       VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
      [id_vehiculo, id_servicio, creado_por || null, observaciones || "", estado || "pendiente"]
    );
    res.status(201).json({ id_orden: result.insertId, message: "Orden creada correctamente" });
  } catch (error) {
    console.error("Error createOrden:", error);
    res.status(500).json({ message: "Error al crear orden" });
  }
};

// ── PUT /api/ordenes/:id ───────────────────────────────
export const updateOrden = async (req, res) => {
  const { id } = req.params;
  const { observaciones, estado, creado_por } = req.body;

  try {
    const fechaFin = estado === "Terminado" ? "NOW()" : "fecha_finalizacion";
    await db.query(
      `UPDATE ordenes_servicio 
       SET observaciones=?, estado=?, creado_por=?,
           fecha_finalizacion = ${estado === "Terminado" ? "NOW()" : "fecha_finalizacion"}
       WHERE id_orden=?`,
      [observaciones || "", estado, creado_por || null, id]
    );
    res.json({ message: "Orden actualizada correctamente" });
  } catch (error) {
    console.error("Error updateOrden:", error);
    res.status(500).json({ message: "Error al actualizar orden" });
  }
};

// ── PATCH /api/ordenes/:id/anular ─────────────────────
export const anularOrden = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE ordenes_servicio SET activo = 0, estado = 'Anulado' WHERE id_orden = ?",
      [id]
    );
    res.json({ message: "Orden anulada correctamente" });
  } catch (error) {
    console.error("Error anularOrden:", error);
    res.status(500).json({ message: "Error al anular orden" });
  }
};

// ── PATCH /api/ordenes/:id/reactivar ──────────────────
export const reactivarOrden = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE ordenes_servicio SET activo = 1, estado = 'pendiente' WHERE id_orden = ?",
      [id]
    );
    res.json({ message: "Orden reactivada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al reactivar orden" });
  }
};

// ── GET /api/mecanicos ─────────────────────────────────
export const getMecanicos = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_usuario, nombre FROM usuarios WHERE activo = 1 ORDER BY nombre"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getMecanicos:", error);
    res.status(500).json({ message: "Error al obtener mecánicos" });
  }
};

// ── GET /api/servicios ─────────────────────────────────
export const getServicios = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_servicio, nombre, precio_base FROM servicios WHERE activo = 1 ORDER BY nombre"
    );
    res.json(rows);a
  } catch (error) {
    console.error("Error getServicios:", error);
    res.status(500).json({ message: "Error al obtener servicios" });
  }
};