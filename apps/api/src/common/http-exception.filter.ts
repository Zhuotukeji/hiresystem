import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();
    const requestId = this.getRequestId(request);
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.getExceptionBody(exception, status);
    const debugEnabled = this.isDebugEnabled();
    const errorName = exception instanceof Error ? exception.name : "UnknownError";
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    response.setHeader("x-request-id", requestId);

    this.logger.error(
      JSON.stringify({
        requestId,
        status,
        method: request?.method,
        path: request?.originalUrl ?? request?.url,
        errorName,
        errorMessage,
        responseMessage: exceptionBody.message,
        details: exceptionBody.details
      }),
      stack
    );

    response.status(status).json({
      statusCode: status,
      message: exceptionBody.message,
      error: exceptionBody.error ?? errorName,
      requestId,
      path: request?.originalUrl ?? request?.url,
      timestamp: new Date().toISOString(),
      ...(debugEnabled
        ? {
            details: exceptionBody.details ?? errorMessage,
            stack
          }
        : {})
    });
  }

  private getRequestId(request: { headers?: Record<string, string | string[] | undefined> } | undefined) {
    const header = request?.headers?.["x-request-id"];
    if (Array.isArray(header)) return header[0] ?? randomUUID();
    return header || randomUUID();
  }

  private getExceptionBody(exception: unknown, status: number): ErrorResponseBody {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        return {
          statusCode: status,
          message: body,
          error: exception.name
        };
      }
      if (body && typeof body === "object") {
        const object = body as Record<string, unknown>;
        return {
          statusCode: status,
          message: this.pickMessage(object.message) ?? exception.message,
          error: typeof object.error === "string" ? object.error : exception.name,
          details: object
        };
      }
      return {
        statusCode: status,
        message: exception.message,
        error: exception.name
      };
    }

    if (exception instanceof Error) {
      return {
        statusCode: status,
        message: "系统内部错误，请根据错误ID查看 API 日志",
        error: exception.name,
        details: exception.message
      };
    }

    return {
      statusCode: status,
      message: "系统内部错误，请根据错误ID查看 API 日志",
      error: "UnknownError",
      details: String(exception)
    };
  }

  private pickMessage(value: unknown) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => String(item));
    return undefined;
  }

  private isDebugEnabled() {
    const raw = process.env.DEBUG_ERRORS?.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(raw ?? "")) return true;
    return process.env.NODE_ENV !== "production";
  }
}
