export class EmailBudgetExhaustedError extends Error {
  constructor() {
    super("Het gezamenlijke e-maildagbudget is bereikt. Probeer het morgen opnieuw.");
    this.name = "EmailBudgetExhaustedError";
  }
}
