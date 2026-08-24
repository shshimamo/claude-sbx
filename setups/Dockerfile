FROM docker/sandbox-templates:claude-code

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    zsh \
    curl \
    jq \
    make \
    vim \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN chsh -s /usr/bin/zsh agent

USER agent
