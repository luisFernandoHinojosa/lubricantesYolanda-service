import { productosSeriesService } from './productos_series.service.js';

export const checkProductoSerieExists = async (req, _res, next) => {
  try {
    const productoSerie = await productosSeriesService.getById(req.params.id);
    req.productoSerie = productoSerie;
    next();
  } catch (err) {
    next(err);
  }
};
