export interface WkRadarTokenResponse {
  type: string;
  token: string;
  /** Segundos até a expiração, a partir do momento da emissão. */
  expiresIn: number;
  expiration: string;
  expirationBrazil: string;
}
