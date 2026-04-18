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
