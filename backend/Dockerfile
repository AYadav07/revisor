# syntax=docker/dockerfile:1
# Backend image (DEPLOYMENT.md): multi-stage, so the final image carries a JRE and the app only — no
# JDK, Gradle or sources. Tests are not run here; CI runs them before building the image.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /src

# Build files first: the dependency download is cached until build.gradle or the wrapper changes.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew --no-daemon --quiet dependencies > /dev/null

COPY src src
RUN ./gradlew --no-daemon --quiet bootJar \
    && find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} app.jar \; \
    && java -Djarmode=tools -jar app.jar extract --layers --launcher --destination /extracted

FROM eclipse-temurin:25-jre
# A fixed, unprivileged uid: the JWT private key mounted from the host must be readable by exactly
# this user (see deploy/README.md).
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app
WORKDIR /app

# Spring Boot's layers, least to most frequently changing, so a code-only change re-ships only the
# small last layer.
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./

USER app
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
