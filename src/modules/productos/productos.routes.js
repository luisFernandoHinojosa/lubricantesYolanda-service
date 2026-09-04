import { Router } from 'express';
import { productosController } from './productos.controller.js';
import { validateCreateProducto, validateUpdateProducto, checkProductoExists } from './productos.middleware.js';
import { sanitizeInput } from '../../middlewares/sanitizer.middleware.js';
import { uploadSingle } from '../../plugins/upload-file.plugin.js';
import { throttleBusqueda, rateLimitBarcode } from '../catalogo_pos/Posthrottle.middleware.js';
import { authenticate } from '../auth/auth.middleware.js';
import { requireSesionAbierta, } from '../ventas/ventas.middleware.js';
import { validateQueryBusqueda, validateBarcode, validateCantidad } from '../catalogo_pos/catalogo_pos.middleware.js';
import { buscarProductos, buscarPorBarcode, getProducto, validarCantidad } from '../catalogo_pos/catalogo_pos.controller.js';

const router = Router();
router.use(authenticate);
router.route('/')
    .get(productosController.list)
    .post(
        uploadSingle('foto'),
        (req, _res, next) => {
            if (typeof req.body.presentaciones === 'string') {
                try {
                    req.body.presentaciones = JSON.parse(req.body.presentaciones);
                } catch { }
            }
            if (typeof req.body.carga_inicial === 'string') {
                try {
                    req.body.carga_inicial = JSON.parse(req.body.carga_inicial);
                } catch { }
            }
            next();
        },
        sanitizeInput,
        validateCreateProducto,
        productosController.create
    );

router.get('/generate-barcode', productosController.generateBarcode);

router.get('/exportar-excel', productosController.exportarExcel);

router.route('/:id')
    .get(checkProductoExists, productosController.getById)
    .put(uploadSingle('foto'), sanitizeInput, checkProductoExists, validateUpdateProducto, productosController.update)
    .delete(checkProductoExists, productosController.remove);

//router.use(requireSesionAbierta);
router.get('/pos/buscar', validateQueryBusqueda, throttleBusqueda, buscarProductos);
router.get('/pos/barcode/:codigo', validateBarcode, rateLimitBarcode, buscarPorBarcode);
router.get('/pos/:id', getProducto);
router.get('/pos/:id/validar-cantidad', validateCantidad, validarCantidad);

router.get('/lotes/:id_producto', productosController.getLotesByProductoId);

router.get('/:id_producto/historial-costos', productosController.getHistorialCostos);

export default router;
