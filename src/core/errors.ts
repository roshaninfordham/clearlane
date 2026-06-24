export class ClearLaneError extends Error {
  readonly code: string;
  readonly causeValue?: unknown;

  constructor(code: string, message: string, causeValue?: unknown) {
    super(message);
    this.name = "ClearLaneError";
    this.code = code;
    this.causeValue = causeValue;
  }
}
