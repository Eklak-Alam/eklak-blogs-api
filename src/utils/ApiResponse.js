class ApiResponse {
  // Added optional 'meta' for pagination payloads
  constructor(statusCode, data, message = 'Success', meta = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  send(res) {
    const payload = {
      success: this.success,
      message: this.message,
      data: this.data,
    };
    if (this.meta) payload.meta = this.meta;

    return res.status(this.statusCode).json(payload);
  }
}

export default ApiResponse;