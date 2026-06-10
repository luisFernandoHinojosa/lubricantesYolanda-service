
import { saveAuditEvent } from '../modules/audit/audit.service.js';

export const auditMiddleware = (action) => (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    const event = {
      action,
      method: req.method,
      url: req.originalUrl,
      userId: req.user ? req.user.id : null,
      requestBody: JSON.stringify(req.body),
      responseStatus: res.statusCode,
    };

    saveAuditEvent(event);
    originalSend.call(this, body);
  };

  next();
};
