export const CLIENT_CONFIG = {
  searchableFields: ['nombre', 'apellido_paterno', 'apellido_materno', 'ci'],
  filterableFields: ['tipo_cliente', 'status'],
  defaultSort: ['nombre', 'ASC']
};

export const COMPRA_CONFIG = {
  searchableFields: [
    '$proveedor.nombre$',
    '$proveedor.razon_social$',
    '$empleado.nombre$',
    '$empleado.apellido_paterno$',
    'numero_comprobante'
  ],
  filterableFields: [
    'id_proveedor',
    'id_empleado',
    'id_sucursal',
    'estado_pago'
  ],
  defaultSort: ['fecha_compra', 'DESC']
};

export const EMPLEADO_CONFIG = {
  searchableFields: ['nombre', 'apellido_paterno', 'apellido_materno', 'ci'],
  filterableFields: ['cargo'],
  defaultSort: ['nombre', 'ASC']
}

export const PROVEEDOR_CONFIG = {
  searchableFields: ['nombre', 'apellido_paterno', 'apellido_materno', 'razon_social', 'nit_ci', 'contacto'],
  defaultSort: ['nombre', 'ASC']
}


export const VENTA_CONFIG = {
  searchableFields: [
    'numero_comprobante',
    '$cliente.nombre$',
    '$cliente.apellido_paterno$',
    '$cajero.nombre$',
    '$cajero.apellido_paterno$'
  ],
  filterableFields: ['id_cliente', 'id_empleado', 'metodo_pago'],
  defaultSort: ['createdAt', 'DESC']
};

export const PRODUCTO_CONFIG = {
  searchableFields: [
    'nombre_comercial',
    'codigo_barras',
    '$categoria.nombre$',
    '$marca.nombre$',
    '$presentaciones.nombre$',
    '$presentaciones.sku$',
    '$presentaciones.codigo_barras$'
  ],
  filterableFields: ['id_categoria', 'id_marca', 'esta_activo', 'maneja_vencimiento'],
  defaultSort: ['nombre_comercial', 'ASC']
};


export const MARCA_CONFIG = {
  searchableFields: ['nombre', 'descripcion'],
  filterableFields: ['esta_activo'],
  defaultSort: ['nombre', 'ASC']
}

export const CATEGORIA_CONFIG = {
  searchableFields: ['nombre', 'descripcion'],
  filterableFields: ['esta_activo'],
  defaultSort: ['nombre', 'ASC']
}


export const UBICACIONES_CONFIG = {
  searchableFields: ['nombre', 'descripcion'],
  filterableFields: ['esta_activo', 'tipo_area'],
  defaultSort: ['nombre', 'ASC']
}

export const UBICACION_FISICA_CONFIG = {
  searchableFields: ['nombre', 'descripcion', '$ubicacion.nombre$'],
  filterableFields: ['esta_activo', 'id_ubicacion'],
  defaultSort: ['nombre', 'ASC']
}

export const UNIDAD_MEDIDA_CONFIG = {
  searchableFields: ['nombre', 'abreviatura'],
  filterableFields: ['esta_activo'],
  defaultSort: ['nombre', 'ASC']
}

export const LOTE_CONFIG = {
  searchableFields: ['codigo_lote', '$producto.nombre_comercial$', '$proveedor.nombre$'],
  filterableFields: ['id_producto', 'id_proveedor'],
  defaultSort: ['fecha_ingreso', 'DESC']
}

export const STOCK_DISTRIBUCION_CONFIG = {
  searchableFields: ['$lote.codigo_lote$', '$lote.producto.nombre_comercial$', '$ubicacion.nombre$'],
  filterableFields: ['id_lote', 'id_ubicacion'],
  defaultSort: ['createdAt', 'DESC']
}

export const PRODUCTOS_SERIES_CONFIG = {
  searchableFields: ['numero_serie', '$lote.producto.nombre_comercial$'],
  filterableFields: ['id_lote', 'id_ubicacion', 'esta_activo'],
  defaultSort: ['numero_serie', 'ASC']
}

export const PRESENTACION_CONFIG = {
  searchableFields: ['nombre', '$producto.nombre_comercial$'],
  filterableFields: ['id_producto', 'esta_activo'],
  defaultSort: ['nombre', 'ASC']
}

export const KARDEX_MOVIMIENTO_CONFIG = {
  searchableFields: ['$lote.codigo_lote$', '$lote.producto.nombre_comercial$'],
  filterableFields: ['id_lote', 'tipo_movimiento', 'id_ubicacion_origen', 'id_ubicacion_destino', 'id_usuario'],
  defaultSort: ['fecha', 'DESC']
}

export const SUCURSAL_CONFIG = {
  searchableFields: ['nombre', 'ciudad', 'responsable'],
  filterableFields: ['esta_activo', 'ciudad'],
  defaultSort: ['nombre', 'ASC']
}

export const CATEGORIA_MOVIMIENTO_CONFIG = {
  searchableFields: ['nombre', 'descripcion'],
  filterableFields: ['esta_activo', 'tipo'],
  defaultSort: ['nombre', 'ASC']
}

export const MOVIMIENTO_CONFIG = {
  searchableFields: ['nombre', 'descripcion', '$categoria_movimiento.nombre$', '$sucursal.nombre$', '$empleado.nombre$', '$empleado.ci$'],
  filterableFields: ['tipo', 'tipoPago', 'divisa', 'categoriaMovimientoId', 'sucursalId', 'empleadoId', 'esta_activo'],
  defaultSort: ['fecha', 'DESC']
}

export const DEVOLUCION_CONFIG = {
  searchableFields: [
    'numero_devolucion',
    '$venta_original.numero_comprobante$',
    '$cliente.nombre$',
    '$cliente.apellido_paterno$',
    '$empleado.nombre$',
    '$empleado.apellido_paterno$'
  ],
  filterableFields: ['tipo', 'esta_activo', 'metodo_reembolso', 'id_sucursal'],
  defaultSort: ['createdAt', 'DESC']
};

