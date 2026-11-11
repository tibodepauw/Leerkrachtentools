/**
 * Fouten waarvan de Nederlandse melding veilig aan de gebruiker getoond mag
 * worden. De geïsoleerde documentworker geeft alleen deze meldingen door; elke
 * andere fout wordt een generieke melding.
 */
export class DocumentUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentUserError";
  }
}
