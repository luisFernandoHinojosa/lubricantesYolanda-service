export const BUSINESS_CONSTANTS = {
    TOLERANCIA_PESO_BALANZA_KG: 0.05,
    UMBRAL_DEUDA_MINIMA_MONEDA: 0.5,
};

export const pathImgUsuario = 'public/images/imgUsuario.webp'
export const pathImgProduct = 'public/images/imgProducto.webp'
export const urlImgUsuario = 'https://firebasestorage.googleapis.com/v0/b/supermarketeym.appspot.com/o/usuario%2Fdefault-2a29c29c-1a25-4bcc-a3c9-66d0c328e825.png?alt=media&token=89977280-a879-4837-a44b-216afbfc5955'
export const urlImgProduct = 'https://firebasestorage.googleapis.com/v0/b/supermarketeym.appspot.com/o/producccion%2Fsupermarketeym%2Fdefault-d6ddb8b3-48f1-449a-a4cd-f336c7295ad5.png?alt=media&token=2146e04c-afba-4186-b460-1f2beb6386c0'

// Tipos de documento de identidad del SIAT (codigoClasificador)
export const TIPO_DOCUMENTO_IDENTIDAD = {
    CI: 1,  // Cédula de identidad
    CEX: 2, // Cédula de identidad de extranjero
    PAS: 3, // Pasaporte
    OD: 4,  // Otro documento de identidad
    NIT: 5, // Número de identificación tributaria
};

export const TIPOS_DOCUMENTO_IDENTIDAD_VALIDOS = Object.values(TIPO_DOCUMENTO_IDENTIDAD);

// Métodos de pago del SIAT: código que envía el frontend → codigoClasificador
export const METODO_PAGO_SIAT = {
    EFECTIVO: 1,
    TARJETA: 2,
    CHEQUE: 3,
    VALES: 4,
    OTROS: 5,
    QR: 7,       // Transferencia bancaria (QR)
    DEPOSITO: 8, // Depósito en cuenta
};

export const METODOS_PAGO_VALIDOS = Object.keys(METODO_PAGO_SIAT);

// CI del cliente genérico ("Público General") al que se asignan las ventas sin cliente
export const CI_CLIENTE_GENERICO = '000000';

// Correo que se asigna al cliente cuando no se envía uno (la factura del SIAT lo usa)
export const CORREO_CLIENTE_POR_DEFECTO = 'lubricantesyolanda@gmail.com';
