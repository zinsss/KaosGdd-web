class WebPushClient:
    def __init__(self, *, public_key: str, private_key: str, subject: str) -> None:
        self.public_key = public_key
        self.private_key = private_key
        self.subject = subject

    @property
    def is_enabled(self) -> bool:
        return bool(self.public_key and self.private_key and self.subject)

    def send(self, *, subscription_info: dict, payload_json: str) -> None:
        if not self.is_enabled:
            raise ValueError("Web push is not configured")

        from pywebpush import webpush

        webpush(
            subscription_info=subscription_info,
            data=payload_json,
            vapid_private_key=self.private_key,
            vapid_claims={"sub": self.subject},
        )

    @staticmethod
    def summarize_exception(exc: Exception) -> dict:
        exception_type = exc.__class__.__name__
        message = str(exc) or repr(exc)
        status_code = None

        response = getattr(exc, "response", None)
        if response is not None:
            status_code = getattr(response, "status_code", None) or getattr(response, "status", None)
        if status_code is None:
            status_code = getattr(exc, "status_code", None)

        if status_code is not None:
            summary = f"{exception_type}: HTTP {status_code} - {message}"
        else:
            summary = f"{exception_type}: {message}"

        lowered = message.lower()
        is_invalid_subscription = status_code in {404, 410} or any(
            token in lowered
            for token in (
                "subscription no longer valid",
                "invalid subscription",
                "endpoint not found",
                "unsubscribed",
                "expired",
                "gone",
            )
        )

        return {
            "exception_type": exception_type,
            "message": message,
            "status_code": status_code,
            "summary": summary,
            "is_invalid_subscription": is_invalid_subscription,
        }
