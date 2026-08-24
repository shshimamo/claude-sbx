#!/bin/bash
# sbx セットアップスクリプトの参考例
#
# 使い方:
#   1. このファイルをコピーして自分の環境に合わせて編集
#   2. clone_base 配下に配置（sbx から参照可能にする）
#   3. config.json で設定:
#      "sbx": { "post_create_cmds": [["/path/to/sbx-setup.sh"]] }

# ------------------------
# --- dotfiles の設定例 ---
# ------------------------

# default_mounts で dotfiles をマウントしておく
DOTFILES="$HOME/dotfiles"

if [ -d "$DOTFILES" ]; then
  ln -sf "$DOTFILES/.zshrc" ~/.zshrc
fi

# -------------------------------------------
# --- Claude Code hooks (Linux 用) の設定例 ---
# -------------------------------------------

# 将来の hooks 設定をここに追加

echo "setup complete"
