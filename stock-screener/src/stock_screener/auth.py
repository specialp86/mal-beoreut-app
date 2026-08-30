"""토스증권 Open API OAuth2 client_credentials 인증.

토큰 발급: POST {base_url}/oauth2/token
    body: grant_type=client_credentials&client_id=...&client_secret=...

참고: 기존 사내 스크립트 `toss_api_test.py`의 인증 로직을 재사용하는 것이
원래 스펙이었으나, 해당 파일이 이 저장소/세션 어디에도 존재하지 않아
공개된 토스증권 Open API 문서(OAuth2 Client Credentials Grant, 표준 형식)를
기준으로 새로 작성했다. 실제 토큰 응답 필드명이 다르면 TokenResponse만
수정하면 된다.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import httpx


class AuthError(RuntimeError):
    pass


@dataclass
class TokenResponse:
    access_token: str
    expires_in: int
    token_type: str = "Bearer"
    issued_at: float = 0.0

    @property
    def expires_at(self) -> float:
        return self.issued_at + self.expires_in

    def is_expired(self, skew_seconds: int = 30) -> bool:
        return time.time() >= (self.expires_at - skew_seconds)


class TossAuth:
    """client_credentials 토큰을 발급하고, 만료 전 자동으로 재발급한다."""

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        base_url: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.client_id = client_id or os.environ.get("TOSS_CLIENT_ID")
        self.client_secret = client_secret or os.environ.get("TOSS_CLIENT_SECRET")
        self.base_url = base_url or os.environ.get(
            "TOSS_API_BASE_URL", "https://openapi.tossinvest.com"
        )
        if not self.client_id or not self.client_secret:
            raise AuthError(
                "TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다. "
                ".env.example을 참고해 .env 파일을 만들어주세요."
            )
        self._client = http_client or httpx.Client(timeout=10.0)
        self._owns_client = http_client is None
        self._token: TokenResponse | None = None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "TossAuth":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def get_access_token(self) -> str:
        if self._token is None or self._token.is_expired():
            self._token = self._issue_token()
        return self._token.access_token

    def _issue_token(self) -> TokenResponse:
        url = f"{self.base_url}/oauth2/token"
        resp = self._client.post(
            url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
        )
        if resp.status_code != 200:
            raise AuthError(
                f"토큰 발급 실패 (status={resp.status_code}): {resp.text[:500]}"
            )
        data = resp.json()
        try:
            return TokenResponse(
                access_token=data["access_token"],
                expires_in=int(data.get("expires_in", 3600)),
                token_type=data.get("token_type", "Bearer"),
                issued_at=time.time(),
            )
        except KeyError as e:
            raise AuthError(f"토큰 응답 형식이 예상과 다릅니다: {data}") from e
