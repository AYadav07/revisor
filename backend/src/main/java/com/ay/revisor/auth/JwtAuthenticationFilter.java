package com.ay.revisor.auth;

import com.ay.revisor.shared.AuthenticatedUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.time.Clock;
import java.util.List;

/**
 * Authenticates a request from its {@code accessToken} cookie. A missing, expired or invalid
 * token simply leaves the request unauthenticated; the security chain's entry point turns that
 * into a 401 for protected endpoints, which is the frontend's cue to call /auth/refresh.
 * Deliberately not a {@code @Component}: Boot would register it as a servlet filter a second time.
 */
class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final AccessTokenVerifier verifier;
    private final Clock clock;

    JwtAuthenticationFilter(AccessTokenVerifier verifier, Clock clock) {
        this.verifier = verifier;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Cookie cookie = WebUtils.getCookie(request, AuthCookies.ACCESS);
        if (cookie != null) {
            verifier.verify(cookie.getValue(), clock.instant()).ifPresent(this::authenticate);
        }
        chain.doFilter(request, response);
    }

    private void authenticate(AuthenticatedUser user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))));
        SecurityContextHolder.setContext(context);
    }
}
