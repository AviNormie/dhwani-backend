export type PdfOcrErrorKind = "config" | "execution";

export class PdfOcrError extends Error {
  constructor(
    message: string,
    public readonly kind: PdfOcrErrorKind
  ) {
    super(message);
    this.name = "PdfOcrError";
  }
}
