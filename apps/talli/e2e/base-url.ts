export const motoriPort = process.env.MOTORI_E2E_PORT ?? "3000";
export const talliPort = process.env.TALLI_E2E_PORT ?? "3001";
export const MOTORI_URL = `http://localhost:${motoriPort}`;
export const TALLI_URL = `http://localhost:${talliPort}`;
