package com.ay.revisor.auth;

/** What an {@link EmailToken} may be redeemed for. A token only works for its own purpose. */
public enum EmailTokenPurpose {
    VERIFY_EMAIL,
    RESET_PASSWORD
}
