FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    curl \
    git \
    gh \
    zsh \
    && rm -rf /var/lib/apt/lists/*

# Claude Code
RUN curl -fsSL https://cli.anthropic.com/install.sh | sh
