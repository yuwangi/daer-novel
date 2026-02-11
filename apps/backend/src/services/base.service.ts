export class BaseService {
  constructor(protected readonly serviceName: string) {}

  protected log(message: string, ...args: any[]) {
    console.log(`[${this.serviceName}] ${message}`, ...args);
  }

  protected error(message: string, error?: any) {
    console.error(`[${this.serviceName}] ${message}`, error);
  }
}
