import db from "../config/db.js";

export const getDashboardDueno = async (req, res) => {
  try {
    const { periodo = "semana" } = req.query;
    const hoy = new Date().toISOString().split("T")[0];

    const ahora = new Date();

    const mesActual = `${ahora.getFullYear()}-${String(
      ahora.getMonth() + 1
    ).padStart(2, "0")}`;

    const mesAnterior =
      ahora.getMonth() === 0
        ? `${ahora.getFullYear() - 1}-12`
        : `${ahora.getFullYear()}-${String(ahora.getMonth()).padStart(2, "0")}`;

    // ═══════════════════════════════════════════════
    // MÉTRICAS PRINCIPALES
    // ═══════════════════════════════════════════════

    const [[cajaMes]] = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN tipo IN ('apertura','venta') THEN monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
      FROM caja
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      AND activo = 1
    `,
      [mesActual]
    );

    const [[cajaMesAnt]] = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN tipo IN ('apertura','venta') THEN monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END), 0) AS gastos
      FROM caja
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      AND activo = 1
    `,
      [mesAnterior]
    );

    const ingresosTotales = parseFloat(cajaMes?.ingresos) || 0;
    const gastosTotales = parseFloat(cajaMes?.gastos) || 0;

    const ingresosAnt = parseFloat(cajaMesAnt?.ingresos) || 0;
    const gastosAnt = parseFloat(cajaMesAnt?.gastos) || 0;

    const gananciaNeta = ingresosTotales - gastosTotales;
    const gananciaMesAnt = ingresosAnt - gastosAnt;

    const pctIngresos =
      ingresosAnt > 0
        ? (
            ((ingresosTotales - ingresosAnt) / ingresosAnt) *
            100
          ).toFixed(1)
        : 0;

    const pctGastos =
      gastosAnt > 0
        ? (((gastosTotales - gastosAnt) / gastosAnt) * 100).toFixed(1)
        : 0;

    const pctGanancia =
      gananciaMesAnt > 0
        ? (
            ((gananciaNeta - gananciaMesAnt) / gananciaMesAnt) *
            100
          ).toFixed(1)
        : 0;

    // ═══════════════════════════════════════════════
    // SERVICIOS
    // ═══════════════════════════════════════════════

    const [[serviciosMes]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ordenes_servicio
      WHERE DATE_FORMAT(fecha_ingreso, '%Y-%m') = ?
      AND activo = 1
    `,
      [mesActual]
    );

    const [[serviciosMesAnt]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ordenes_servicio
      WHERE DATE_FORMAT(fecha_ingreso, '%Y-%m') = ?
      AND activo = 1
    `,
      [mesAnterior]
    );

    const serviciosRealizados = serviciosMes?.total || 0;
    const serviciosRealizadosAnt = serviciosMesAnt?.total || 0;

    const pctServicios =
      serviciosRealizadosAnt > 0
        ? (
            ((serviciosRealizados - serviciosRealizadosAnt) /
              serviciosRealizadosAnt) *
            100
          ).toFixed(1)
        : 0;

    // ═══════════════════════════════════════════════
    // HORAS TRABAJADAS
    // ═══════════════════════════════════════════════

    const [[horasMes]] = await db.query(
      `
      SELECT
        COALESCE(
          SUM(TIMESTAMPDIFF(MINUTE, hora_entrada, hora_salida)),
          0
        ) AS minutos_totales
      FROM asistencias
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      AND hora_salida IS NOT NULL
    `,
      [mesActual]
    );

    const [[horasMesAnt]] = await db.query(
      `
      SELECT
        COALESCE(
          SUM(TIMESTAMPDIFF(MINUTE, hora_entrada, hora_salida)),
          0
        ) AS minutos_totales
      FROM asistencias
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      AND hora_salida IS NOT NULL
    `,
      [mesAnterior]
    );

    const minutosTotal = parseInt(horasMes?.minutos_totales) || 0;
    const minutosTotalAnt =
      parseInt(horasMesAnt?.minutos_totales) || 0;

    const horasTotales = Math.floor(minutosTotal / 60);
    const minutosRestantes = minutosTotal % 60;

    const horasFormateadas = `${horasTotales}h ${minutosRestantes}m`;

    const pctHoras =
      minutosTotalAnt > 0
        ? (
            ((minutosTotal - minutosTotalAnt) /
              minutosTotalAnt) *
            100
          ).toFixed(1)
        : 0;

    // ═══════════════════════════════════════════════
    // GRÁFICO
    // ═══════════════════════════════════════════════

    let chartQuery = "";
    let chartParams = [];

    if (periodo === "hoy") {
      chartQuery = `
        SELECT
          HOUR(fecha) AS hora,
          COALESCE(SUM(CASE WHEN tipo IN ('apertura','venta') THEN monto ELSE 0 END),0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END),0) AS gastos
        FROM caja
        WHERE DATE(fecha) = ?
        AND activo = 1
        GROUP BY HOUR(fecha)
        ORDER BY hora ASC
      `;
      chartParams = [hoy];
    } else if (periodo === "semana") {
      chartQuery = `
        SELECT
          DATE(fecha) AS dia,
          DAYNAME(fecha) AS nombre_dia,
          COALESCE(SUM(CASE WHEN tipo IN ('apertura','venta') THEN monto ELSE 0 END),0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END),0) AS gastos
        FROM caja
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND activo = 1
        GROUP BY DATE(fecha), DAYNAME(fecha)
        ORDER BY dia ASC
      `;
    } else {
      chartQuery = `
        SELECT
          WEEK(fecha,1) AS semana,
          CONCAT('Semana ', WEEK(fecha,1)) AS label,
          COALESCE(SUM(CASE WHEN tipo IN ('apertura','venta') THEN monto ELSE 0 END),0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo IN ('gasto','retiro') THEN monto ELSE 0 END),0) AS gastos
        FROM caja
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND activo = 1
        GROUP BY WEEK(fecha,1)
        ORDER BY semana ASC
      `;
    }

    const [chartRows] = await db.query(chartQuery, chartParams);

    const DIAS_ES = {
      Monday: "Lun",
      Tuesday: "Mar",
      Wednesday: "Mié",
      Thursday: "Jue",
      Friday: "Vie",
      Saturday: "Sáb",
      Sunday: "Dom",
    };

    const chartData = chartRows.map((r) => ({
      dia:
        periodo === "hoy"
          ? `${r.hora}:00`
          : periodo === "semana"
          ? DIAS_ES[r.nombre_dia] || r.nombre_dia
          : r.label,

      ingresos: parseFloat(r.ingresos) || 0,
      gastos: parseFloat(r.gastos) || 0,

      ganancia:
        (parseFloat(r.ingresos) || 0) -
        (parseFloat(r.gastos) || 0),
    }));

    // ═══════════════════════════════════════════════
    // DISTRIBUCIÓN INGRESOS
    // ═══════════════════════════════════════════════

    const [[dist]] = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END),0) AS servicios,
        COALESCE(SUM(CASE WHEN LOWER(concepto) LIKE '%repuesto%' THEN monto ELSE 0 END),0) AS repuestos
      FROM caja
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      AND activo = 1
    `,
      [mesActual]
    );

    const ingresosServicios = parseFloat(dist?.servicios) || 0;
    const ingresosRepuestos = parseFloat(dist?.repuestos) || 0;

    const ingresosOtros = Math.max(
      0,
      ingresosTotales - ingresosServicios - ingresosRepuestos
    );

    const totalDistribucion = ingresosTotales || 1;

    // ═══════════════════════════════════════════════
    // MOVIMIENTOS DINERO
    // ═══════════════════════════════════════════════

    const [ultimosMovimientos] = await db.query(`
      SELECT
        c.fecha,
        c.tipo,
        c.concepto,
        c.monto,
        c.metodo,
        u.nombre AS usuario
      FROM caja c
      LEFT JOIN usuarios u
      ON u.id_usuario = c.usuario_id
      WHERE c.activo = 1
      ORDER BY c.fecha DESC
      LIMIT 5
    `);

    const movimientosDinero = ultimosMovimientos.map((m) => {
      const esIngreso = ["apertura", "venta"].includes(m.tipo);

      return {
        fecha: new Date(m.fecha).toLocaleString("es-AR"),
        tipo: m.tipo,
        descripcion: m.concepto,
        entrada: esIngreso ? parseFloat(m.monto) : 0,
        salida: !esIngreso ? parseFloat(m.monto) : 0,
        metodo: m.metodo || "N/A",
      };
    });

    // ═══════════════════════════════════════════════
    // MOVIMIENTOS REPUESTOS
    // ═══════════════════════════════════════════════

    const [movimientosRepuestos] = await db.query(`
      SELECT
        im.fecha,
        im.tipo,
        i.nombre AS producto,
        im.cantidad,
        im.stock_resultante
      FROM inventario_movimientos im
      JOIN inventario i
      ON i.id_producto = im.id_producto
      ORDER BY im.fecha DESC
      LIMIT 5
    `);

    const repuestosMovimientos = movimientosRepuestos.map((m) => ({
      fecha: new Date(m.fecha).toLocaleString("es-AR"),
      tipo: m.tipo,
      producto: m.producto,
      cantidad: m.cantidad,
      stockActual: m.stock_resultante,
      responsable: "Sistema",
    }));

    // ═══════════════════════════════════════════════
    // HORAS PERSONAL
    // ═══════════════════════════════════════════════

    const [horasPersonal] = await db.query(
      `
      SELECT
        u.nombre AS empleado,
        a.hora_entrada,
        a.hora_salida,
        CASE
          WHEN a.hora_salida IS NULL THEN NULL
          ELSE TIMESTAMPDIFF(MINUTE, a.hora_entrada, a.hora_salida)
        END AS minutos_trabajados
      FROM asistencias a
      JOIN usuarios u
      ON u.id_usuario = a.usuario_id
      WHERE a.fecha = ?
      ORDER BY a.hora_entrada DESC
      LIMIT 10
    `,
      [hoy]
    );

    const horasPersonalDetalle = horasPersonal.map((h) => {
      let horasTrabajadas = "--";
      let estado = "En trabajo";

      if (h.minutos_trabajados !== null) {
        const hrs = Math.floor(h.minutos_trabajados / 60);
        const mins = h.minutos_trabajados % 60;

        horasTrabajadas = `${hrs}h ${mins}m`;
        estado = "Completo";
      }

      return {
        empleado: h.empleado,
        entrada: h.hora_entrada
          ? new Date(h.hora_entrada).toLocaleTimeString("es-AR")
          : "--",

        salida: h.hora_salida
          ? new Date(h.hora_salida).toLocaleTimeString("es-AR")
          : "En trabajo",

        horasTrabajadas,
        estado,
      };
    });

    // ═══════════════════════════════════════════════
    // SERVICIOS RECIENTES
    // ═══════════════════════════════════════════════

    const [serviciosRecientes] = await db.query(`
      SELECT
        o.fecha_ingreso,
        c.nombre AS cliente,
        CONCAT(v.marca, ' ', v.modelo) AS vehiculo,
        s.nombre AS servicio,
        u.nombre AS tecnico,
        o.precio_final AS total,
        o.estado
      FROM ordenes_servicio o
      JOIN vehiculos v
      ON v.id_vehiculo = o.id_vehiculo
      JOIN clientes c
      ON c.id_cliente = v.id_cliente
      LEFT JOIN servicios s
      ON s.id_servicio = o.id_servicio
      LEFT JOIN usuarios u
      ON u.id_usuario = o.creado_por
      WHERE o.activo = 1
      ORDER BY o.fecha_ingreso DESC
      LIMIT 10
    `);

    const serviciosHistorial = serviciosRecientes.map((s) => ({
      fecha: new Date(s.fecha_ingreso).toLocaleString("es-AR"),
      cliente: s.cliente,
      vehiculo: s.vehiculo,
      servicio: s.servicio || "Sin servicio",
      tecnico: s.tecnico || "Sin asignar",
      total: parseFloat(s.total) || 0,
      estado: s.estado,
    }));

    // ═══════════════════════════════════════════════
    // RESUMEN NEGOCIO
    // ═══════════════════════════════════════════════

    const [[clientesTotal]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM clientes
      WHERE activo = 1
    `);

    const [[ticketPromedio]] = await db.query(
      `
      SELECT AVG(precio_final) AS promedio
      FROM ordenes_servicio
      WHERE DATE_FORMAT(fecha_ingreso, '%Y-%m') = ?
      AND activo = 1
      AND precio_final > 0
    `,
      [mesActual]
    );

    const [[repuestosStock]] = await db.query(`
      SELECT
        COUNT(*) AS productos,
        COALESCE(SUM(stock * precio),0) AS valor_total
      FROM inventario
      WHERE activo = 1
    `);

    const [[personalActivo]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM usuarios
      WHERE activo = 1
    `);

    // ═══════════════════════════════════════════════
    // RESPUESTA FINAL
    // ═══════════════════════════════════════════════

    res.json({
      ingresosTotales,
      gastosTotales,
      gananciaNeta,

      serviciosRealizados,

      horasTrabajadas: horasFormateadas,

      pctIngresos,
      pctGastos,
      pctGanancia,
      pctServicios,
      pctHoras,

      chartData,

      distribucionIngresos: {
        servicios: ingresosServicios,
        repuestos: ingresosRepuestos,
        otros: ingresosOtros,

        pctServicios: (
          (ingresosServicios / totalDistribucion) *
          100
        ).toFixed(1),

        pctRepuestos: (
          (ingresosRepuestos / totalDistribucion) *
          100
        ).toFixed(1),

        pctOtros: (
          (ingresosOtros / totalDistribucion) *
          100
        ).toFixed(1),
      },

      movimientosDinero,

      movimientosRepuestos: repuestosMovimientos,

      horasPersonal: horasPersonalDetalle,

      serviciosRecientes: serviciosHistorial,

      resumenNegocio: {
        totalClientes: clientesTotal.total || 0,

        serviciosEsteMes: serviciosRealizados,

        ticketPromedio:
          parseFloat(ticketPromedio?.promedio) || 0,

        repuestosStock:
          repuestosStock?.productos || 0,

        valorStock:
          parseFloat(repuestosStock?.valor_total) || 0,

        personalActivo:
          personalActivo?.total || 0,
      },
    });
  } catch (error) {
    console.error("ERROR DASHBOARD:", error);

    res.status(500).json({
      message: "Error al obtener dashboard",
      error: error.message,
    });
  }
};