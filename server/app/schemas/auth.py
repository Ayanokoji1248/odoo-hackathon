from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRead

# bcrypt hard-caps at 72 bytes; cap here so the error is a 400, not a 500.
Password = Annotated[str, Field(min_length=8, max_length=72)]


class RegisterRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    email: EmailStr
    password: Password


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until the access token expires


class AuthResult(BaseModel):
    user: UserRead
    tokens: TokenPair


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Password


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: Password
