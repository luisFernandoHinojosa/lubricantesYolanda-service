export const getNombreCompleto = (cliente) => {
  const { nombre, apellido_paterno, apellido_materno } = cliente;

  return [
    nombre,
    apellido_paterno,
    apellido_materno
  ].filter(Boolean).join(' ');
};