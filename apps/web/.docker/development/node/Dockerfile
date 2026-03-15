FROM node:24.12.0

LABEL maintainer="KingNNT"

ARG UID_HOST_USER
ARG GID_HOST_USER
ARG NAME_CONTAINER_GROUP=group_container
ARG NAME_CONTAINER_USER=user_container

RUN apt update

RUN userdel -r node
RUN echo UID_HOST_USER = ${UID_HOST_USER} - GID_HOST_USER = ${GID_HOST_USER}
RUN if ! getent group ${GID_HOST_USER}; then \
      addgroup --system --gid ${GID_HOST_USER} ${NAME_CONTAINER_GROUP}; \
    else \
      NAME_CONTAINER_GROUP=$(getent group ${GID_HOST_USER} | cut -d: -f1); \
    fi
RUN adduser --system --uid ${UID_HOST_USER} --home /home/${NAME_CONTAINER_USER} --disabled-password ${NAME_CONTAINER_USER}
RUN adduser ${NAME_CONTAINER_USER} $(getent group ${GID_HOST_USER} | cut -d: -f1)
RUN usermod -aG sudo ${NAME_CONTAINER_USER}

# Enable and prepare Yarn stable (v4)
RUN corepack enable && corepack prepare yarn@stable --activate

ENV PATH=$PATH:/home/${NAME_CONTAINER_USER}/.yarn/bin

WORKDIR /app

# Set ownership of /app directory
RUN chown -R ${UID_HOST_USER}:${GID_HOST_USER} /app

# Copy package files and Yarn configuration
ADD --chown=${UID_HOST_USER}:${GID_HOST_USER} package.json .
ADD --chown=${UID_HOST_USER}:${GID_HOST_USER} yarn.lock .
ADD --chown=${UID_HOST_USER}:${GID_HOST_USER} .yarnrc.yml .
ADD --chown=${UID_HOST_USER}:${GID_HOST_USER} .yarn .yarn

USER ${NAME_CONTAINER_USER}

# Install dependencies during build
RUN yarn install

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
