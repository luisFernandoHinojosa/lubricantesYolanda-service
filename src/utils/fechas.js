// Zona horaria del negocio. Bolivia no usa horario de verano, el offset es fijo.
export const ZONA_HORARIA = 'America/La_Paz';
export const UTC_OFFSET = '-04:00';

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

// Fecha local de Bolivia en formato 'YYYY-MM-DD' (toISOString() devuelve la fecha en UTC)
export const fechaLocal = (date = new Date()) => formatoFecha.format(date);

// Fecha local de Bolivia en formato 'YYYYMMDD', usada en los correlativos
export const fechaCompacta = (date = new Date()) => fechaLocal(date).replace(/-/g, '');

// Primer día del mes local de Bolivia en formato 'YYYY-MM-DD'
export const inicioDelMes = (date = new Date()) => `${fechaLocal(date).slice(0, 7)}-01`;

// Normaliza el valor de un filtro a 'YYYY-MM-DD' local de Bolivia.
//   '2026-10-21'               → '2026-10-21' (ya es una fecha local)
//   '2026-10-22T01:00:00.000Z' → '2026-10-21' (es un instante: se convierte a hora de Bolivia)
export const aFechaLocal = (valor) => {
    const texto = String(valor).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : fechaLocal(new Date(texto));
};

// Instantes de inicio y fin de un día 'YYYY-MM-DD' en hora de Bolivia
export const inicioDelDia = (fecha) => new Date(`${aFechaLocal(fecha)}T00:00:00.000${UTC_OFFSET}`);
export const finDelDia = (fecha) => new Date(`${aFechaLocal(fecha)}T23:59:59.999${UTC_OFFSET}`);
