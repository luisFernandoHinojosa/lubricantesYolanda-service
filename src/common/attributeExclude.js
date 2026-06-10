const EXCLUDE_BASE = ['createdAt', 'updatedAt', 'esta_activo'];

export const PROVEEDOR_EXCLUDED = [...EXCLUDE_BASE, 'telefono', 'direccion', 'empresa'];

export const EMPLEADO_EXCLUDED = [...EXCLUDE_BASE, 'salario_base', 'telefono', 'direccion', 'cargo', 'fecha_nacimiento', 'fecha_contratacion', 'usuario_id', 'ci'];

export const ZONA_EXCLUDED = [...EXCLUDE_BASE];

export const PRODUCTO_EXCLUDED = [...EXCLUDE_BASE, 'unidad_medida', 'precio_base_sugerido', 'descripcion'];

export const COMPRA_EXCLUDED = [...EXCLUDE_BASE, 'proveedor_id', 'chofer_id', 'ayudante_id', 'fecha_compra', 'peso_neto_total_kg', 'precio_por_kg', 'costo_total', 'monto_pagado', 'saldo_pendiente', 'estado_pago'];

export const DETALLE_COMPRA_EXCLUDED = [...EXCLUDE_BASE];

export const DETALLE_DESPACHO_EXCLUDED = [...EXCLUDE_BASE];

export const EVENTO_FAENADO_EXCLUDED = [...EXCLUDE_BASE];

export const USUARIO_EXCLUDED = [...EXCLUDE_BASE, 'password_hash', 'password_reset_token', 'password_reset_expires'];

export const ROLE_EXCLUDE = [...EXCLUDE_BASE, 'descripcion',]

export const UNIDAD_MEDIDA_EXCLUDED = [...EXCLUDE_BASE];

export const MARCA_EXCLUDED = [...EXCLUDE_BASE];

export const CATEGORIA_EXCLUDED = [...EXCLUDE_BASE];

export const UBICACION_EXCLUDED = [...EXCLUDE_BASE];

export const CATEGORIA_MOVIMIENTO_EXCLUDED = [...EXCLUDE_BASE, 'descripcion'];

export const MOVIMIENTO_EXCLUDED = [...EXCLUDE_BASE, 'categoriaMovimientoId', 'sucursalId', 'empleadoId'];

