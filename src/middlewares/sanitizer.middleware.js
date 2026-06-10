import sanitizer from 'perfect-express-sanitizer';

export const sanitizeInput = sanitizer.clean(
    {
        xss: true,
        noSql: true,
        sql: true
    },
    [],
    ["body", "params", "query"]
);

