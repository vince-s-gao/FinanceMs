import { Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.trimValue(value);
  }

  private trimValue(value: unknown): unknown {
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.trimValue(item));
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(record)) {
        output[key] = this.trimValue(item);
      }
      return output;
    }
    return value;
  }
}
