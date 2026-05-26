import db from "../config/db.js";

export const getDashboard = async (req, res) => {
  try {
    const { periodo = "semana" } = req.query; // hoy, semana, mes
    const hoy = new Date().toISOString().split("T")[0];

    // Mes actual
    const ahora     = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
    const mesAnterior = ahora.getMonth() === 0
      ? `${ahora.getFullYear() - 1}-12`
      : `${ahora.getFullYear()}-${String(ahora.getMonth()).padStart(2, "0")}`;

    // ── Ingresos y gastos del mes actual ──
    const [[cajaMes]] = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
      FROM caja
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ? AND activo = 1`,
      [mesActual]
    );

    // ── Ingresos mes anterior (para % variación) ──
    const [[cajaMesAnt]] = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
      FROM caja
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ? AND activo = 1`,
      [mesAnterior]
    );

    const ingresos       = parseFloat(cajaMes.ingresos)    || 0;
    const gastos         = parseFloat(cajaMes.gastos)      || 0;
    const ganancia       = ingresos - gastos;
    const ingresosAnt    = parseFloat(cajaMesAnt.ingresos) || 0;
    const gastosAnt      = parseFloat(cajaMesAnt.gastos)   || 0;
    const pctIngresos    = ingresosAnt > 0 ? (((ingresos - ingresosAnt) / ingresosAnt) * 100).toFixed(1) : 0;
    const pctGastos      = gastosAnt   > 0 ? (((gastos   - gastosAnt)   / gastosAnt)   * 100).toFixed(1) : 0;

    // ── Órdenes del mes ──
    const [[ordenesMes]] = await db.query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio
       WHERE DATE_FORMAT(fecha_ingreso, '%Y-%m') = ? AND activo = 1`,
      [mesActual]
    );

    const [[ordenesMesAnt]] = await db.query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio
       WHERE DATE_FORMAT(fecha_ingreso, '%Y-%m') = ? AND activo = 1`,
      [mesAnterior]
    );

    const serviciosMes    = ordenesMes.total    || 0;
    const serviciosMesAnt = ordenesMesAnt.total || 0;
    const pctServicios    = serviciosMesAnt > 0
      ? (((serviciosMes - serviciosMesAnt) / serviciosMesAnt) * 100).toFixed(1) : 0;

    // ── Clientes atendidos este mes (únicos) ──
    const [[clientesMes]] = await db.query(
      `SELECT COUNT(DISTINCT v.id_cliente) AS total
       FROM ordenes_servicio o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       WHERE DATE_FORMAT(o.fecha_ingreso, '%Y-%m') = ? AND o.activo = 1`,
      [mesActual]
    );

    const [[clientesMesAnt]] = await db.query(
      `SELECT COUNT(DISTINCT v.id_cliente) AS total
       FROM ordenes_servicio o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       WHERE DATE_FORMAT(o.fecha_ingreso, '%Y-%m') = ? AND o.activo = 1`,
      [mesAnterior]
    );

    const clientesAtendidos    = clientesMes.total    || 0;
    const clientesAtendidosAnt = clientesMesAnt.total || 0;
    const pctClientes          = clientesAtendidosAnt > 0
      ? (((clientesAtendidos - clientesAtendidosAnt) / clientesAtendidosAnt) * 100).toFixed(1) : 0;

    // ── Órdenes por estado ──
    const [estadosRows] = await db.query(
      `SELECT estado, COUNT(*) AS total
       FROM ordenes_servicio
       WHERE activo = 1
       GROUP BY estado`
    );

    const estados = { finalizado: 0, en_proceso: 0, pendiente: 0 };
    for (const r of estadosRows) estados[r.estado] = r.total;

    // ── Resumen de hoy ──
    const [[serviciosHoyRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio
       WHERE DATE(fecha_ingreso) = ? AND activo = 1`,
      [hoy]
    );

    const [[clientesHoyRow]] = await db.query(
      `SELECT COUNT(DISTINCT v.id_cliente) AS total
       FROM ordenes_servicio o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       WHERE DATE(o.fecha_ingreso) = ? AND o.activo = 1`,
      [hoy]
    );

    const [[turnosPendientesRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio
       WHERE DATE(fecha_ingreso) = ? AND estado = 'pendiente' AND activo = 1`,
      [hoy]
    );

    // Tiempo promedio de hoy (en horas)
    const [[tiempoRow]] = await db.query(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, fecha_ingreso, fecha_finalizacion)) AS promedio
       FROM ordenes_servicio
       WHERE DATE(fecha_ingreso) = ? AND fecha_finalizacion IS NOT NULL AND activo = 1`,
      [hoy]
    );
    // ── Gráfico según período ──
    let chartQuery, chartParams;

    if (periodo === "hoy") {
      // Últimas 12 horas del día actual
      chartQuery = `
        SELECT
          HOUR(fecha) AS hora,
          COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
        FROM caja
        WHERE DATE(fecha) = ? AND activo = 1
        GROUP BY HOUR(fecha)
        ORDER BY hora ASC
      `;
      chartParams = [hoy];
    } else if (periodo === "semana") {
      // Últimos 7 días
      chartQuery = `
        SELECT
          DATE(fecha) AS dia,
          DAYNAME(fecha) AS nombre_dia,
          COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
        FROM caja
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND activo = 1
        GROUP BY DATE(fecha), DAYNAME(fecha)
        ORDER BY dia ASC
      `;
      chartParams = [];
    } else {
      // Último mes (30 días agrupados por semana)
      chartQuery = `
        SELECT
          WEEK(fecha, 1) AS semana,
          CONCAT('Semana ', WEEK(fecha, 1) - WEEK(DATE_SUB(NOW(), INTERVAL 30 DAY), 1) + 1) AS label,
          COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
        FROM caja
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND activo = 1
        GROUP BY WEEK(fecha, 1)
        ORDER BY semana ASC
      `;
      chartParams = [];
    }

    const [chartRows] = await db.query(chartQuery, chartParams);

    const DIAS_ES = {
      Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié",
      Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
    };

    let chartData = [];
    if (periodo === "hoy") {
      chartData = chartRows.map(r => ({
        dia:      `${r.hora}:00`,
        ingresos: parseFloat(r.ingresos) || 0,
        gastos:   parseFloat(r.gastos)   || 0,
      }));
    } else if (periodo === "semana") {
      chartData = chartRows.map(r => ({
        dia:      DIAS_ES[r.nombre_dia] || r.nombre_dia,
        ingresos: parseFloat(r.ingresos) || 0,
        gastos:   parseFloat(r.gastos)   || 0,
      }));
    } else {
      chartData = chartRows.map(r => ({
        dia:      r.label,
        ingresos: parseFloat(r.ingresos) || 0,
        gastos:   parseFloat(r.gastos)   || 0,
      }));
    }

    // ── Próximas órdenes de hoy ──
    const [proximasRows] = await db.query(
    `SELECT
      o.id_orden,
      o.estado,
      o.fecha_ingreso,
      c.nombre AS cliente,
      s.nombre AS servicio,
      v.modelo AS vehiculo,
      v.marca,
      u.nombre AS empleado
    FROM ordenes_servicio o
    JOIN vehiculos v  ON v.id_vehiculo  = o.id_vehiculo
    JOIN clientes  c  ON c.id_cliente   = v.id_cliente
    LEFT JOIN servicios  s ON s.id_servicio = o.id_servicio
    LEFT JOIN usuarios   u ON u.id_usuario  = o.creado_por
    WHERE o.activo = 1
    ORDER BY
    FIELD(o.estado, 'pendiente', 'en_proceso', 'finalizado'),
    o.fecha_ingreso ASC
    LIMIT 10`
  );

    const proximosTurnos = proximasRows.map(r => ({
      hora:     new Date(r.fecha_ingreso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      cliente:  r.cliente,
      servicio: r.servicio || "Sin servicio",
      vehiculo: `${r.marca} ${r.vehiculo}`,
      empleado: r.empleado || "Sin asignar",
      estado:   r.estado,
    }));

    // ── Empleados destacados del mes (por cantidad de órdenes) ──
    const [empRows] = await db.query(
      `SELECT
        u.nombre,
        COUNT(o.id_orden) AS servicios
       FROM ordenes_servicio o
       JOIN usuarios u ON u.id_usuario = o.creado_por
       WHERE DATE_FORMAT(o.fecha_ingreso, '%Y-%m') = ? AND o.activo = 1
       GROUP BY u.id_usuario, u.nombre
       ORDER BY servicios DESC`,
      [mesActual]
    );

    const maxServicios = empRows.length > 0 ? empRows[0].servicios : 1;
    const empleadosDestacados = empRows.map(e => ({
      nombre:    e.nombre,
      servicios: e.servicios,
      pct:       Math.round((e.servicios / maxServicios) * 100),
    }));

    // ── Alertas ── stock bajo + órdenes atrasadas
    const alertas = [];

    const [stockBajo] = await db.query(
      `SELECT COUNT(*) AS total FROM inventario
       WHERE stock <= stock_minimo AND activo = 1 AND stock_minimo > 0`
    );
    if (stockBajo[0].total > 0) {
      alertas.push({
        tipo: "warning",
        texto: `Stock bajo en ${stockBajo[0].total} producto${stockBajo[0].total > 1 ? "s" : ""}`,
        sub: "Revisar inventario",
        tiempo: "Ahora",
      });
    }

    const [atrasadas] = await db.query(
      `SELECT COUNT(*) AS total FROM ordenes_servicio
       WHERE estado = 'en_proceso' AND fecha_ingreso < DATE_SUB(NOW(), INTERVAL 2 DAY) AND activo = 1`
    );
    if (atrasadas[0].total > 0) {
      alertas.push({
        tipo: "danger",
        texto: `${atrasadas[0].total} servicio${atrasadas[0].total > 1 ? "s" : ""} atrasado${atrasadas[0].total > 1 ? "s" : ""}`,
        sub: "Revisar agenda del taller",
        tiempo: "Ahora",
      });
    }

    res.json({
      // Stats cards
      ingresos,
      gastos,
      ganancia,
      servicios: serviciosMes,
      clientes:  clientesAtendidos,
      pctIngresos,
      pctGastos,
      pctServicios,
      pctClientes,

      // Pie chart
      completados: estados.finalizado || 0,
      enProceso:   estados.en_proceso || 0,
      pendientes:  estados.pendiente  || 0,

      // Resumen hoy
      serviciosHoy:     serviciosHoyRow.total     || 0,
      clientesHoy:      clientesHoyRow.total      || 0,
      turnosPendientes: turnosPendientesRow.total || 0,

      // Chart
      chartData,

      // Tablas
      proximosTurnos,
      empleadosDestacados,
      alertas,
    });
  } catch (error) {
    console.error("Error getDashboard:", error);
    res.status(500).json({ message: "Error al obtener datos del dashboard" });
  }
};