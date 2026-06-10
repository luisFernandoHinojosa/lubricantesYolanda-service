import { productosService } from './productos.service.js';
import { generatePhotoURL } from '../../plugins/generateURL_Image.js';
import { categoriasService } from '../categorias/categorias.service.js';
import { unidadMedidasService } from '../unidad_medidas/unidad_medidas.service.js';
import { marcasService } from '../marcas/marcas.service.js';
import { ConflictError } from '../../errors/AppError.js';

export class ProductoController {

  list = async (req, res, next) => {
    try {
      const result = await productosService.list(req.query);
      const categorias = await categoriasService.listFull();
      const unidades_medida = await unidadMedidasService.listFull();
      const marcas = await marcasService.listFull();

      res.status(200).json({
        status: 'success',
        data: result,
        extraData: {
          categorias,
          unidades_medida,
          marcas,
        }
      });
    } catch (err) {
      next(err);
    }
  };

  exportarExcel = async (req, res, next) => {
    try {
      const buffer = await productosService.exportarExcel();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=InventarioLotes.xlsx');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };

  getHistorialCostos = async (req, res, next) => {
    try {
      const { id_producto } = req.params;
      console.log('ID recibido en el Backend:', id_producto);
      const historial = await productosService.getHistorialCostos(id_producto);
      console.log('Historial encontrado en BD:', historial.length);
      return res.status(200).json({
        status: 'success',
        data: historial
      });
    } catch (error) {
      console.log('Error en Backend:', error.message);
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const producto = req.producto ?? await productosService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: producto });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const id_usuario = req.user ? req.user.id : null;

      const producto = await productosService.create({
        ...req.body,
        imagen_url: null,
      }, id_usuario);

      res.status(201).json({
        status: 'success',
        message: 'Producto creado correctamente.',
        data: producto,
      });

      // Subir foto a Cloudinary en segundo plano (no bloquea la respuesta)
      if (req.file) {
        generatePhotoURL(req.file)
          .then((imagen_url) => productosService.update(producto.id, { imagen_url }))
          .catch((err) => console.error(`[Cloudinary] Error subiendo foto para producto ${producto.id}:`, err));
      }

    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        const campo = err.errors?.[0]?.path || Object.keys(err.fields ?? {}).join(', ');
        const valor = err.errors?.[0]?.value || '';
        return next(new ConflictError(`Ya existe un producto con ese valor en "${campo}"${valor ? `: "${valor}"` : ''}.`));
      }
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      if (req.file) {
        req.body.imagen_url = await generatePhotoURL(req.file);
      }
      const updatedProducto = await productosService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: updatedProducto });
    } catch (err) {
      next(err);
    }
  };

  generateBarcode = async (req, res, next) => {
    try {
      const barcode = await productosService.generateUniqueBarcode();
      res.status(200).json({
        status: 'success',
        data: barcode
      });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await productosService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getLotesByProductoId = async (req, res, next) => {
    try {
      const { id_producto } = req.params;
      const producto = await productosService.getDetalleStockById(id_producto);
      res.status(200).json({
        status: 'success',
        data: producto,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const productosController = new ProductoController();