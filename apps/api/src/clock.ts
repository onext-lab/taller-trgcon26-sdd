/** Reloj inyectado (DEC-09): los servicios piden la hora a `now()` para que los tests la puedan fijar. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
