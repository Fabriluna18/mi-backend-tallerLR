import db from "../config/db.js";

// ── GET /api/clientes ──────────────────────────────────
export const getClientes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        c.id_cliente AS id,
        c.nombre, c.dni, c.telefono, c.email,
        c.fecha_registro, c.activo,
        v.id_vehiculo, v.marca, v.modelo, v.anio, v.patente, v.notas AS nota_vehiculo
       FROM clientes c
       LEFT JOIN vehiculos v 
         ON v.id_cliente = c.id_cliente AND v.activo = 1
       ORDER BY c.activo DESC, c.fecha_registro DESC`
    );

    const clientesMap = new Map();

    rows.forEach((row) => {
      if (!clientesMap.has(row.id)) {
        clientesMap.set(row.id, {
          id: row.id,
          nombre: row.nombre,
          dni: row.dni,
          telefono: row.telefono,
          email: row.email,
          activo: !!row.activo,
          vehiculos: [],
        });
      }

      if (row.id_vehiculo) {
        clientesMap.get(row.id).vehiculos.push({
          id: row.id_vehiculo,
          marca: row.marca || "",
          modelo: row.modelo || "",
          anio: row.anio ? String(row.anio) : "",
          patente: row.patente || "",
          notas: row.nota_vehiculo || "",
        });
      }
    });

    const data = Array.from(clientesMap.values());

    res.json(data);
  } catch (error) {
    console.error("Error getClientes:", error);
    res.status(500).json({ message: "Error al obtener clientes" });
  }
};
// ── POST /api/clientes ─────────────────────────────────
export const createCliente = async (req, res) => {
  const { nombre, dni, telefono, email, vehiculo } = req.body;

  if (req.usuario.rol === "admin") {
    return res.status(403).json({
      message: "No autorizado",
    });
  }

  if (!nombre || !dni || !telefono || !email) {
    return res.status(400).json({ message: "Campos requeridos incompletos" });
  }

  try {
    const [existe] = await db.query(
      "SELECT id_cliente FROM clientes WHERE dni = ?", [dni]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "Ya existe un cliente con ese DNI" });
    }

    const [result] = await db.query(
      `INSERT INTO clientes (nombre, dni, telefono, email, fecha_registro, activo)
       VALUES (?, ?, ?, ?, CURDATE(), 1)`,
      [nombre, dni, telefono, email]
    );
    const clienteId = result.insertId;

    if (vehiculo && (vehiculo.marca || vehiculo.modelo || vehiculo.patente)) {
      await db.query(
        `INSERT INTO vehiculos (id_cliente, marca, modelo, anio, patente, notas, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          clienteId,
          vehiculo.marca   || "",
          vehiculo.modelo  || "",
          vehiculo.anio    ? parseInt(vehiculo.anio) : null,
          vehiculo.patente || "",
          vehiculo.notas   || "",
        ]
      );
    }

    res.status(201).json({
      id: clienteId,
      nombre, dni, telefono, email,
      activo: true,
      vehiculo: {
        marca:   vehiculo?.marca   || "",
        modelo:  vehiculo?.modelo  || "",
        anio:    vehiculo?.anio    || "",
        patente: vehiculo?.patente || "",
        notas:   vehiculo?.notas   || "",
      },
      ordenes: [],
    });
  } catch (error) {
    console.error("Error createCliente:", error);
    res.status(500).json({ message: "Error al crear cliente" });
  }
};

// ── PUT /api/clientes/:id ──────────────────────────────
export const updateCliente = async (req, res) => {
  const { id } = req.params;
  const { nombre, dni, telefono, email, vehiculo } = req.body;

  if (!nombre || !dni || !telefono || !email) {
    return res.status(400).json({ message: "Campos requeridos incompletos" });
  }

  try {
    const [existe] = await db.query(
      "SELECT id_cliente FROM clientes WHERE dni = ? AND id_cliente != ?",
      [dni, id]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "Ya existe otro cliente con ese DNI" });
    }

    await db.query(
      "UPDATE clientes SET nombre=?, dni=?, telefono=?, email=? WHERE id_cliente=?",
      [nombre, dni, telefono, email, id]
    );

    if (vehiculo) {
      const [veh] = await db.query(
        "SELECT id_vehiculo FROM vehiculos WHERE id_cliente = ? ORDER BY id_vehiculo LIMIT 1", 
        [id]
      );
      if (veh.length > 0) {
        await db.query(
          `UPDATE vehiculos SET marca=?, modelo=?, anio=?, patente=?, notas=?
           WHERE id_vehiculo=?`,
          [
            vehiculo.marca   || "",
            vehiculo.modelo  || "",
            vehiculo.anio    ? parseInt(vehiculo.anio) : null,
            vehiculo.patente || "",
            vehiculo.notas   || "",
            veh[0].id_vehiculo,
          ]
        );
      } else {
        await db.query(
          `INSERT INTO vehiculos (id_cliente, marca, modelo, anio, patente, notas, activo)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            id,
            vehiculo.marca   || "",
            vehiculo.modelo  || "",
            vehiculo.anio    ? parseInt(vehiculo.anio) : null,
            vehiculo.patente || "",
            vehiculo.notas   || "",
          ]
        );
      }
    }

    res.json({ message: "Cliente actualizado correctamente" });
  } catch (error) {
    console.error("Error updateCliente:", error);
    res.status(500).json({ message: "Error al actualizar cliente" });
  }
};

// ── PATCH /api/clientes/:id/desactivar ────────────────
export const desactivarCliente = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE clientes SET activo = 0 WHERE id_cliente = ?", [id]);
    res.json({ message: "Cliente desactivado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al desactivar cliente" });
  }
};

// ── PATCH /api/clientes/:id/reactivar ─────────────────
export const reactivarCliente = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE clientes SET activo = 1 WHERE id_cliente = ?", [id]);
    res.json({ message: "Cliente reactivado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al reactivar cliente" });
  }
};

// ═══════════════════════════════════════════════════════
// NUEVOS ENDPOINTS PARA MÚLTIPLES VEHÍCULOS
// ═══════════════════════════════════════════════════════

// ── GET /api/clientes/:id/vehiculos ────────────────────
export const getVehiculosCliente = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [vehiculos] = await db.query(
      `SELECT 
        id_vehiculo AS id,
        marca, 
        modelo, 
        anio, 
        patente, 
        notas
       FROM vehiculos 
       WHERE id_cliente = ? AND activo = 1
       ORDER BY id_vehiculo ASC`,
      [id]
    );

    const data = vehiculos.map(v => ({
      id: v.id,
      marca: v.marca || "",
      modelo: v.modelo || "",
      anio: v.anio ? String(v.anio) : "",
      patente: v.patente || "",
      notas: v.notas || "",
    }));

    res.json(data);
  } catch (error) {
    console.error("Error getVehiculosCliente:", error);
    res.status(500).json({ message: "Error al obtener vehículos del cliente" });
  }
};

// ── POST /api/clientes/:id/vehiculos ───────────────────
export const addVehiculoCliente = async (req, res) => {
  const { id } = req.params;
  const { marca, modelo, anio, patente, notas } = req.body;

  if (!marca || !modelo || !patente) {
    return res.status(400).json({ 
      message: "Marca, modelo y patente son requeridos" 
    });
  }

  try {
    // Verificar que el cliente existe
    const [cliente] = await db.query(
      "SELECT id_cliente FROM clientes WHERE id_cliente = ?", 
      [id]
    );
    
    if (cliente.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar que no exista un vehículo con la misma patente
    const [existe] = await db.query(
      "SELECT id_vehiculo FROM vehiculos WHERE patente = ? AND activo = 1",
      [patente]
    );

    if (existe.length > 0) {
      return res.status(400).json({ 
        message: "Ya existe un vehículo con esa patente" 
      });
    }

    // Insertar el vehículo
    const [result] = await db.query(
      `INSERT INTO vehiculos (id_cliente, marca, modelo, anio, patente, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        marca,
        modelo,
        anio ? parseInt(anio) : null,
        patente,
        notas || "",
      ]
    );

    res.status(201).json({
      id: result.insertId,
      marca,
      modelo,
      anio: anio || "",
      patente,
      notas: notas || "",
    });
  } catch (error) {
    console.error("Error addVehiculoCliente:", error);
    res.status(500).json({ message: "Error al agregar vehículo" });
  }
};

// ── DELETE /api/vehiculos/:id ──────────────────────────
export const deleteVehiculo = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que el vehículo existe
    const [vehiculo] = await db.query(
      "SELECT id_vehiculo, id_cliente FROM vehiculos WHERE id_vehiculo = ?",
      [id]
    );

    if (vehiculo.length === 0) {
      return res.status(404).json({ message: "Vehículo no encontrado" });
    }

    // Verificar que el cliente tenga más de un vehículo activo
    const [count] = await db.query(
      "SELECT COUNT(*) as total FROM vehiculos WHERE id_cliente = ? AND activo = 1",
      [vehiculo[0].id_cliente]
    );

    if (count[0].total <= 1) {
      return res.status(400).json({ 
        message: "No se puede eliminar el único vehículo del cliente" 
      });
    }

    // Soft delete - marcar como inactivo
    await db.query(
      "UPDATE vehiculos SET activo = 0 WHERE id_vehiculo = ?",
      [id]
    );

    res.json({ message: "Vehículo eliminado correctamente" });
  } catch (error) {
    console.error("Error deleteVehiculo:", error);
    res.status(500).json({ message: "Error al eliminar vehículo" });
  }
};