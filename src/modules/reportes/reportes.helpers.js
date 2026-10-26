import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { aFechaLocal, fechaLocal, inicioDelMes, inicioDelDia, finDelDia } from '../../utils/fechas.js';

dayjs.extend(utc);

/**
 * Normaliza un rango de fechas a días completos en hora de Bolivia.
 * Si no se proveen, usa el mes actual.
 */
export const parseDateRange = (desde, hasta) => {
    const start = inicioDelDia(desde ? aFechaLocal(desde) : inicioDelMes());
    const end = finDelDia(hasta ? aFechaLocal(hasta) : fechaLocal());

    return { start, end };
};

/**
 * Calcula el periodo equivalente anterior para comparaciones.
 * Ej: si el rango es 1-31 marzo, retorna 1-28 febrero.
 */
export const getPeriodoAnterior = (desde, hasta) => {
    // La aritmética de días se hace sobre fechas de calendario ('YYYY-MM-DD'),
    // y recién al final se convierte a instantes en hora de Bolivia.
    const start = dayjs.utc(aFechaLocal(desde));
    const end = dayjs.utc(aFechaLocal(hasta));
    const diffDays = end.diff(start, 'day');

    const anteriorEnd = start.subtract(1, 'day').format('YYYY-MM-DD');
    const anteriorStart = start.subtract(diffDays + 1, 'day').format('YYYY-MM-DD');

    return { start: inicioDelDia(anteriorStart), end: finDelDia(anteriorEnd) };
};

/**
 * Calcula porcentaje de variación entre dos valores.
 */
export const calcularVariacion = (actual, anterior) => {
    if (!anterior || anterior === 0) return actual > 0 ? 100 : 0;
    return parseFloat((((actual - anterior) / anterior) * 100).toFixed(2));
};

/**
 * Formatea un número a 2 decimales.
 */
export const formatCurrency = (value) => {
    return parseFloat(parseFloat(value || 0).toFixed(2));
};

/**
 * Retorna la función SQL de agrupamiento temporal según granularidad.
 * @param {'dia'|'semana'|'mes'} agruparPor
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} columnName
 */
export const getGroupByExpression = (agruparPor, sequelize, columnName = 'createdAt') => {
    switch (agruparPor) {
        case 'semana':
            return [
                sequelize.fn('DATE_TRUNC', 'week', sequelize.col(columnName)),
                'fecha'
            ];
        case 'mes':
            return [
                sequelize.fn('DATE_TRUNC', 'month', sequelize.col(columnName)),
                'fecha'
            ];
        case 'dia':
        default:
            return [
                sequelize.fn('DATE', sequelize.col(columnName)),
                'fecha'
            ];
    }
};

/**
 * Calcula porcentaje seguro (evita NaN/Infinity).
 */
export const porcentaje = (parte, total) => {
    if (!total || total === 0) return 0;
    return formatCurrency((parte / total) * 100);
};
